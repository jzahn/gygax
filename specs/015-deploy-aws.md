# Spec 015: AWS Deployment

Deploy Gygax on AWS with a single EC2 instance running Docker Compose, using S3 for file storage and SES for email.

## Cost Estimate

| Service | Purpose | Cost |
|---------|---------|------|
| EC2 t3.small | App server (Docker Compose) | ~$15/month |
| S3 | File uploads (avatars, backdrops, maps) | ~$1/month |
| SES | Transactional email | Free tier (62k/month) |
| Elastic IP | Static public IP | Free when attached |
| Route 53 | DNS (optional) | $0.50/month per zone |

**Estimated total: ~$17/month** (less with free tier credits)

## Prerequisites

### AWS Account
- AWS account with billing enabled
- IAM user with admin access (or specific permissions below)
- AWS CLI installed and configured locally

### Domain
- Domain name with DNS access
- Ability to create/modify A records

### Local Tools
```bash
# Verify AWS CLI
aws --version

# Configure credentials
aws configure
# Enter: Access Key ID, Secret Access Key, Region (e.g., us-east-1)
```

---

## 1. AWS Infrastructure Setup

### 1.1 Choose a Region

Pick a region close to your players:

| Region | Location |
|--------|----------|
| us-east-1 | N. Virginia |
| us-west-2 | Oregon |
| eu-west-1 | Ireland |
| ap-northeast-1 | Tokyo |

```bash
# Set your region (used in all following commands)
export AWS_REGION=us-east-1
```

### 1.2 Create Security Group

```bash
# Create security group
aws ec2 create-security-group \
  --group-name gygax-sg \
  --description "Gygax VTT security group" \
  --region $AWS_REGION

# Note the GroupId returned (sg-xxxxxxxxx)
export SG_ID=sg-xxxxxxxxx

# Allow SSH (port 22)
aws ec2 authorize-security-group-ingress \
  --group-id $SG_ID \
  --protocol tcp \
  --port 22 \
  --cidr 0.0.0.0/0 \
  --region $AWS_REGION

# Allow HTTP (port 80)
aws ec2 authorize-security-group-ingress \
  --group-id $SG_ID \
  --protocol tcp \
  --port 80 \
  --cidr 0.0.0.0/0 \
  --region $AWS_REGION

# Allow HTTPS (port 443)
aws ec2 authorize-security-group-ingress \
  --group-id $SG_ID \
  --protocol tcp \
  --port 443 \
  --cidr 0.0.0.0/0 \
  --region $AWS_REGION
```

### 1.3 Create SSH Key Pair

```bash
# Create key pair
aws ec2 create-key-pair \
  --key-name gygax-key \
  --query 'KeyMaterial' \
  --output text \
  --region $AWS_REGION > ~/.ssh/gygax-key.pem

# Secure the key
chmod 400 ~/.ssh/gygax-key.pem
```

### 1.4 Launch EC2 Instance

```bash
# Get latest Amazon Linux 2023 AMI ID
AMI_ID=$(aws ec2 describe-images \
  --owners amazon \
  --filters "Name=name,Values=al2023-ami-2023*-x86_64" \
  --query 'Images | sort_by(@, &CreationDate) | [-1].ImageId' \
  --output text \
  --region $AWS_REGION)

echo "Using AMI: $AMI_ID"

# Launch t3.small instance
aws ec2 run-instances \
  --image-id $AMI_ID \
  --instance-type t3.small \
  --key-name gygax-key \
  --security-group-ids $SG_ID \
  --block-device-mappings '[{"DeviceName":"/dev/xvda","Ebs":{"VolumeSize":30,"VolumeType":"gp3"}}]' \
  --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=gygax-server}]' \
  --region $AWS_REGION

# Note the InstanceId returned (i-xxxxxxxxx)
export INSTANCE_ID=i-xxxxxxxxx
```

### 1.5 Allocate Elastic IP

```bash
# Allocate Elastic IP
aws ec2 allocate-address \
  --domain vpc \
  --region $AWS_REGION

# Note the AllocationId (eipalloc-xxxxxxxxx) and PublicIp
export EIP_ALLOC=eipalloc-xxxxxxxxx
export PUBLIC_IP=x.x.x.x

# Wait for instance to be running
aws ec2 wait instance-running --instance-ids $INSTANCE_ID --region $AWS_REGION

# Associate Elastic IP with instance
aws ec2 associate-address \
  --instance-id $INSTANCE_ID \
  --allocation-id $EIP_ALLOC \
  --region $AWS_REGION

echo "Your server is at: $PUBLIC_IP"
```

---

## 2. S3 Bucket Setup

### 2.1 Create Bucket

```bash
# Choose a unique bucket name (must be globally unique)
export BUCKET_NAME=gygax-uploads-$(openssl rand -hex 4)

# Create bucket
aws s3api create-bucket \
  --bucket $BUCKET_NAME \
  --region $AWS_REGION \
  --create-bucket-configuration LocationConstraint=$AWS_REGION

# Note: For us-east-1, omit the LocationConstraint:
# aws s3api create-bucket --bucket $BUCKET_NAME --region us-east-1

echo "Bucket created: $BUCKET_NAME"
```

### 2.2 Configure Bucket for Public Read

```bash
# Disable block public access (required for public uploads)
aws s3api put-public-access-block \
  --bucket $BUCKET_NAME \
  --public-access-block-configuration \
  "BlockPublicAcls=false,IgnorePublicAcls=false,BlockPublicPolicy=false,RestrictPublicBuckets=false"

# Set bucket policy for public read
aws s3api put-bucket-policy \
  --bucket $BUCKET_NAME \
  --policy "{
    \"Version\": \"2012-10-17\",
    \"Statement\": [
      {
        \"Sid\": \"PublicReadGetObject\",
        \"Effect\": \"Allow\",
        \"Principal\": \"*\",
        \"Action\": \"s3:GetObject\",
        \"Resource\": \"arn:aws:s3:::$BUCKET_NAME/*\"
      }
    ]
  }"
```

### 2.3 Configure CORS

```bash
aws s3api put-bucket-cors \
  --bucket $BUCKET_NAME \
  --cors-configuration '{
    "CORSRules": [
      {
        "AllowedHeaders": ["*"],
        "AllowedMethods": ["GET", "PUT", "POST"],
        "AllowedOrigins": ["https://your-domain.com"],
        "ExposeHeaders": ["ETag"],
        "MaxAgeSeconds": 3600
      }
    ]
  }'
```

**Note:** Replace `your-domain.com` with your actual domain.

### 2.4 Create IAM User for S3 Access

```bash
# Create IAM user
aws iam create-user --user-name gygax-s3-user

# Create access key
aws iam create-access-key --user-name gygax-s3-user

# Note the AccessKeyId and SecretAccessKey returned
# You'll need these for the .env.prod file

# Create and attach policy
aws iam put-user-policy \
  --user-name gygax-s3-user \
  --policy-name GygaxS3Access \
  --policy-document "{
    \"Version\": \"2012-10-17\",
    \"Statement\": [
      {
        \"Effect\": \"Allow\",
        \"Action\": [
          \"s3:PutObject\",
          \"s3:GetObject\",
          \"s3:DeleteObject\",
          \"s3:ListBucket\"
        ],
        \"Resource\": [
          \"arn:aws:s3:::$BUCKET_NAME\",
          \"arn:aws:s3:::$BUCKET_NAME/*\"
        ]
      }
    ]
  }"
```

---

## 3. Amazon SES Setup

### 3.1 Verify Domain

```bash
# Request domain verification
aws ses verify-domain-identity \
  --domain your-domain.com \
  --region $AWS_REGION

# Get DKIM tokens
aws ses verify-domain-dkim \
  --domain your-domain.com \
  --region $AWS_REGION
```

This returns DNS records you must add to your domain:

1. **TXT record** for domain verification:
   - Name: `_amazonses.your-domain.com`
   - Value: (returned verification token)

2. **CNAME records** for DKIM (3 records):
   - Name: `(token1)._domainkey.your-domain.com`
   - Value: `(token1).dkim.amazonses.com`
   - (repeat for token2 and token3)

### 3.2 Check Verification Status

```bash
# Wait a few minutes for DNS propagation, then check
aws ses get-identity-verification-attributes \
  --identities your-domain.com \
  --region $AWS_REGION
```

### 3.3 Create SMTP Credentials

```bash
# Create IAM user for SES
aws iam create-user --user-name gygax-ses-user

# Create access key
aws iam create-access-key --user-name gygax-ses-user

# Attach SES send policy
aws iam put-user-policy \
  --user-name gygax-ses-user \
  --policy-name GygaxSESSend \
  --policy-document '{
    "Version": "2012-10-17",
    "Statement": [
      {
        "Effect": "Allow",
        "Action": "ses:SendRawEmail",
        "Resource": "*"
      }
    ]
  }'
```

**Important:** The SMTP password is NOT the IAM secret key. You must convert it:

```bash
# Use this script to convert IAM secret to SMTP password
# Replace YOUR_SECRET_ACCESS_KEY with the SecretAccessKey from create-access-key

python3 << 'EOF'
import hmac
import hashlib
import base64

SMTP_REGIONS = {
    'us-east-1': 'email-smtp.us-east-1.amazonaws.com',
    'us-west-2': 'email-smtp.us-west-2.amazonaws.com',
    'eu-west-1': 'email-smtp.eu-west-1.amazonaws.com',
}

def calculate_key(secret_access_key, region):
    date = "11111111"
    service = "ses"
    terminal = "aws4_request"
    message = "SendRawEmail"
    version = 0x04

    signature = hmac.new(
        ("AWS4" + secret_access_key).encode('utf-8'),
        date.encode('utf-8'),
        hashlib.sha256
    ).digest()
    signature = hmac.new(signature, region.encode('utf-8'), hashlib.sha256).digest()
    signature = hmac.new(signature, service.encode('utf-8'), hashlib.sha256).digest()
    signature = hmac.new(signature, terminal.encode('utf-8'), hashlib.sha256).digest()
    signature = hmac.new(signature, message.encode('utf-8'), hashlib.sha256).digest()

    signature_and_version = bytes([version]) + signature
    return base64.b64encode(signature_and_version).decode('utf-8')

# Replace with your values
secret_key = "YOUR_SECRET_ACCESS_KEY"
region = "us-east-1"

print(f"SMTP Host: {SMTP_REGIONS.get(region, 'email-smtp.' + region + '.amazonaws.com')}")
print(f"SMTP Port: 587")
print(f"SMTP User: (use the AccessKeyId)")
print(f"SMTP Password: {calculate_key(secret_key, region)}")
EOF
```

### 3.4 Request Production Access (If Needed)

By default, SES is in sandbox mode (can only send to verified emails). For production:

1. Go to AWS Console > SES > Account dashboard
2. Click "Request production access"
3. Fill out the form (use case: transactional email for web app)
4. Wait 24-48 hours for approval

For testing, you can verify individual recipient emails:
```bash
aws ses verify-email-identity \
  --email-address test@example.com \
  --region $AWS_REGION
```

---

## 4. EC2 Instance Setup

### 4.1 Connect to Instance

```bash
ssh -i ~/.ssh/gygax-key.pem ec2-user@$PUBLIC_IP
```

### 4.2 Initial System Setup

```bash
# Update system
sudo dnf update -y

# Install essential tools
sudo dnf install -y git curl fail2ban

# Set timezone
sudo timedatectl set-timezone America/Chicago  # Adjust to your timezone

# Enable fail2ban
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

### 4.3 Install Docker

```bash
# Install Docker
sudo dnf install -y docker

# Start and enable Docker
sudo systemctl start docker
sudo systemctl enable docker

# Add user to docker group
sudo usermod -aG docker ec2-user

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Create symlink for 'docker compose' command
sudo ln -sf /usr/local/bin/docker-compose /usr/libexec/docker/cli-plugins/docker-compose 2>/dev/null || true

# Log out and back in for group changes
exit
```

Reconnect:
```bash
ssh -i ~/.ssh/gygax-key.pem ec2-user@$PUBLIC_IP

# Verify Docker
docker --version
docker compose version
```

---

## 5. Deploy Application

### 5.1 Clone Repository

```bash
# Create app directory
mkdir -p ~/gygax
cd ~/gygax

# Clone repository
git clone https://github.com/YOUR_USERNAME/gygax.git app
cd app
```

### 5.2 Configure Environment

```bash
cp .env.prod.example .env.prod
nano .env.prod
```

Required environment variables:

| Variable | Description | Example |
|----------|-------------|---------|
| `DOMAIN` | Your domain name | `gygax.example.com` |
| `DATABASE_URL` | PostgreSQL connection | `postgresql://gygax:SECURE_PASSWORD@db:5432/gygax` |
| `POSTGRES_PASSWORD` | Database password | Generate with `openssl rand -base64 32` |
| `JWT_SECRET` | JWT signing key (32+ chars) | Generate with `openssl rand -base64 48` |
| `SMTP_HOST` | SES SMTP endpoint | `email-smtp.us-east-1.amazonaws.com` |
| `SMTP_PORT` | SMTP port | `587` |
| `SMTP_USER` | SES SMTP username (IAM AccessKeyId) | `AKIAXXXXXXXX` |
| `SMTP_PASSWORD` | SES SMTP password (converted) | See Section 3.3 |
| `SMTP_FROM` | From address (verified domain) | `noreply@your-domain.com` |
| `AWS_ACCESS_KEY_ID` | S3 access key | From Section 2.4 |
| `AWS_SECRET_ACCESS_KEY` | S3 secret key | From Section 2.4 |
| `AWS_REGION` | AWS region | `us-east-1` |
| `S3_BUCKET` | S3 bucket name | `gygax-uploads-xxxx` |

### 5.3 Build and Start

```bash
# Build (takes 5-10 minutes on t3.small)
docker compose -f docker-compose.prod.yml build

# Start services
docker compose -f docker-compose.prod.yml up -d

# Check status
docker compose -f docker-compose.prod.yml ps

# View logs
docker compose -f docker-compose.prod.yml logs -f
```

### 5.4 Verify Deployment

```bash
# Check health endpoint
curl http://localhost:3000/api/health

# From your local machine, test public access
curl -I https://your-domain.com
```

---

## 6. DNS Configuration

### 6.1 Create A Record

Add an A record pointing to your Elastic IP:

```
gygax.example.com.  A  YOUR_ELASTIC_IP
```

If using Route 53:
```bash
# Get hosted zone ID
aws route53 list-hosted-zones

export ZONE_ID=ZXXXXXXXXXX

# Create A record
aws route53 change-resource-record-sets \
  --hosted-zone-id $ZONE_ID \
  --change-batch "{
    \"Changes\": [{
      \"Action\": \"UPSERT\",
      \"ResourceRecordSet\": {
        \"Name\": \"gygax.example.com\",
        \"Type\": \"A\",
        \"TTL\": 300,
        \"ResourceRecords\": [{\"Value\": \"$PUBLIC_IP\"}]
      }
    }]
  }"
```

### 6.2 Verify SSL

Caddy automatically obtains SSL certificates from Let's Encrypt. After DNS propagates:

```bash
# Test HTTPS
curl -I https://gygax.example.com

# Should show HTTP/2 200 with valid certificate
```

---

## 7. Backups

### 7.1 Create Backup Script

```bash
sudo tee ~/gygax/backup.sh << 'EOF'
#!/bin/bash
set -e

BACKUP_DIR="$HOME/gygax/backups"
S3_BUCKET="YOUR_BUCKET_NAME"  # Replace with your bucket
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=7

mkdir -p "$BACKUP_DIR"

# Create database backup
docker compose -f ~/gygax/app/docker-compose.prod.yml exec -T db \
  pg_dump -U gygax gygax | gzip > "$BACKUP_DIR/gygax_$TIMESTAMP.sql.gz"

# Upload to S3
aws s3 cp "$BACKUP_DIR/gygax_$TIMESTAMP.sql.gz" "s3://$S3_BUCKET/backups/"

# Delete local backups older than retention period
find "$BACKUP_DIR" -name "gygax_*.sql.gz" -mtime +$RETENTION_DAYS -delete

# Delete S3 backups older than retention period
aws s3 ls "s3://$S3_BUCKET/backups/" | while read -r line; do
  file_date=$(echo "$line" | awk '{print $1}')
  file_name=$(echo "$line" | awk '{print $4}')
  if [[ $(date -d "$file_date" +%s) -lt $(date -d "-$RETENTION_DAYS days" +%s) ]]; then
    aws s3 rm "s3://$S3_BUCKET/backups/$file_name"
  fi
done

echo "$(date): Backup completed: gygax_$TIMESTAMP.sql.gz"
EOF

chmod +x ~/gygax/backup.sh
```

### 7.2 Schedule Daily Backups

```bash
# Run at 3 AM daily
mkdir -p ~/gygax/backups
(crontab -l 2>/dev/null; echo "0 3 * * * ~/gygax/backup.sh >> ~/gygax/backups/backup.log 2>&1") | crontab -
```

### 7.3 Restore from Backup

```bash
# From S3
aws s3 cp s3://YOUR_BUCKET/backups/gygax_TIMESTAMP.sql.gz ~/gygax/backups/

# Restore
gunzip -c ~/gygax/backups/gygax_TIMESTAMP.sql.gz | \
  docker compose -f ~/gygax/app/docker-compose.prod.yml exec -T db psql -U gygax gygax
```

---

## 8. Monitoring

### 8.1 Health Check Script

```bash
sudo tee ~/gygax/healthcheck.sh << 'EOF'
#!/bin/bash
HEALTH_URL="http://localhost:3000/api/health"
LOG_FILE="$HOME/gygax/backups/health.log"

response=$(curl -s -o /dev/null -w "%{http_code}" "$HEALTH_URL" --max-time 10)

if [ "$response" != "200" ]; then
  echo "$(date): Health check failed (HTTP $response)" >> "$LOG_FILE"
  # Restart services
  docker compose -f ~/gygax/app/docker-compose.prod.yml restart
  echo "$(date): Services restarted" >> "$LOG_FILE"
fi
EOF

chmod +x ~/gygax/healthcheck.sh

# Run every 5 minutes
(crontab -l 2>/dev/null; echo "*/5 * * * * ~/gygax/healthcheck.sh") | crontab -
```

### 8.2 CloudWatch Basic Monitoring

EC2 instances have basic CloudWatch monitoring enabled by default:
- CPU utilization
- Network in/out
- Disk read/write

For alerts, create a CloudWatch alarm:

```bash
# Create CPU alarm (alert if > 80% for 5 minutes)
aws cloudwatch put-metric-alarm \
  --alarm-name gygax-cpu-high \
  --alarm-description "CPU utilization exceeds 80%" \
  --metric-name CPUUtilization \
  --namespace AWS/EC2 \
  --statistic Average \
  --period 300 \
  --threshold 80 \
  --comparison-operator GreaterThanThreshold \
  --dimensions "Name=InstanceId,Value=$INSTANCE_ID" \
  --evaluation-periods 2 \
  --region $AWS_REGION
```

### 8.3 View Logs

```bash
# All services
docker compose -f ~/gygax/app/docker-compose.prod.yml logs -f

# Specific service
docker compose -f ~/gygax/app/docker-compose.prod.yml logs -f server
docker compose -f ~/gygax/app/docker-compose.prod.yml logs -f caddy
```

---

## 9. Updates

```bash
cd ~/gygax/app

# Pull latest code
git pull

# Rebuild and restart
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d

# Clean old images
docker image prune -f
```

---

## 10. Troubleshooting

### SSL Certificate Issues

```bash
# Check Caddy logs
docker compose -f docker-compose.prod.yml logs caddy

# Verify DNS resolution
dig gygax.example.com

# Force certificate renewal
docker compose -f docker-compose.prod.yml exec caddy caddy reload --config /etc/caddy/Caddyfile
```

### Database Connection Issues

```bash
# Check if database is running
docker compose -f docker-compose.prod.yml ps db

# Check database logs
docker compose -f docker-compose.prod.yml logs db

# Connect to database
docker compose -f docker-compose.prod.yml exec db psql -U gygax gygax
```

### S3 Upload Issues

```bash
# Test S3 access
aws s3 ls s3://YOUR_BUCKET/

# Check bucket policy
aws s3api get-bucket-policy --bucket YOUR_BUCKET

# Test upload
echo "test" > /tmp/test.txt
aws s3 cp /tmp/test.txt s3://YOUR_BUCKET/test.txt
aws s3 rm s3://YOUR_BUCKET/test.txt
```

### SES Email Issues

```bash
# Check SES sending statistics
aws ses get-send-statistics --region $AWS_REGION

# Check if still in sandbox
aws ses get-account-sending-enabled --region $AWS_REGION

# Send test email
aws ses send-email \
  --from noreply@your-domain.com \
  --to test@example.com \
  --subject "Test" \
  --text "Test email" \
  --region $AWS_REGION
```

### WebSocket Connection Issues

```bash
# Test WebSocket locally
curl -i -N -H "Connection: Upgrade" -H "Upgrade: websocket" \
  -H "Sec-WebSocket-Version: 13" -H "Sec-WebSocket-Key: test" \
  http://localhost:3000/ws/
```

---

## 11. Security Checklist

- [ ] Security Group allows only ports 22, 80, 443
- [ ] SSH key pair stored securely (not shared)
- [ ] Fail2ban running on EC2
- [ ] Strong database password (32+ characters)
- [ ] Strong JWT secret (48+ characters)
- [ ] HTTPS enforced (Caddy auto-redirect)
- [ ] S3 bucket policy is least-privilege
- [ ] IAM users have minimal permissions
- [ ] SES verified domain (not just email)
- [ ] CloudWatch alarms configured

---

## 12. Cost Optimization Tips

1. **Use Reserved Instances**: For long-term use, reserved instances save ~30-40%
2. **S3 Lifecycle Policies**: Move old backups to Glacier after 30 days
3. **Spot Instances**: For non-production/testing environments
4. **Right-size EC2**: Start with t3.small, upgrade only if needed
5. **Free Tier**: New AWS accounts get 12 months of free tier (750 hrs t3.micro/month)

---

## Architecture

```
Internet
    |
    v
[Elastic IP] -----> [EC2 t3.small]
                          |
                     +----+----+
                     |  Caddy  |  (auto-SSL via Let's Encrypt)
                     +----+----+
                          |
          +---------------+---------------+
          |               |               |
          v               v               v
     /api/*          /ws/*         /* (static)
          |               |               |
          +-------+-------+               |
                  v                       |
             [Server]                     |
             (Fastify)                    |
                  |                       |
                  v                       |
             [PostgreSQL]            [Caddy]
             (in Docker)          (static files)

[S3 Bucket] <---- File uploads (avatars, backdrops, maps)

[Amazon SES] <---- Transactional email
```

---

## Comparison: AWS vs Raspberry Pi

| Aspect | Raspberry Pi (014) | AWS (015) |
|--------|-------------------|-----------|
| **Cost** | Hardware only (~$100 one-time) | ~$17/month |
| **Storage** | Local SSD | S3 (scalable, durable) |
| **Email** | Gmail SMTP (500/day limit) | SES (62k/month free tier) |
| **Static IP** | Router port forwarding | Elastic IP (no router config) |
| **Backups** | Local script | Script + S3 (off-site) |
| **Maintenance** | Physical access needed | Remote management |
| **Scaling** | Limited by hardware | Vertical scaling (change instance type) |
| **Reliability** | Depends on home power/internet | AWS SLA (99.99% uptime) |
| **Best for** | Home/LAN games, cost-conscious | Remote players, reliability critical |
