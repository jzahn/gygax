# Spec 014: Raspberry Pi Deployment

Deploy Gygax on a Raspberry Pi 4B (4GB+ RAM) with internet-exposed SSL/HTTPS.

## Prerequisites

### Hardware
- Raspberry Pi 4B with 8GB RAM
- External USB 3.0 SSD (for PostgreSQL data and uploads)
- Reliable power supply (official 15W USB-C recommended)
- Ethernet connection (preferred) or stable WiFi

### Software
- PiOS Lite 64-bit (Bookworm or later)
- SSH access configured

### Network
- Domain name pointing to your public IP (or Dynamic DNS)
- Router port forwarding configured (ports 80, 443)
- SMTP for email (Gmail works well for personal use)

---

## 1. Pi Preparation

### 1.1 Initial Setup

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install essential tools
sudo apt install -y git curl ufw fail2ban

# Set timezone
sudo timedatectl set-timezone America/Chicago  # Adjust to your timezone
```

### 1.2 SSH Hardening (Optional)

If you want to disable password authentication (key-only login):

```bash
# Ensure key auth works first before running this!
sudo sed -i 's/#PasswordAuthentication yes/PasswordAuthentication no/' /etc/ssh/sshd_config
sudo sed -i 's/PasswordAuthentication yes/PasswordAuthentication no/' /etc/ssh/sshd_config
sudo systemctl restart ssh
```

Skip this step if you prefer to keep password authentication enabled.

### 1.3 SSD & Swap Verification

Building on the Pi requires an SSD and swap space. If you already have an SSD mounted at `/mnt/ssd` with swap configured, verify your setup:

```bash
# Verify SSD is mounted
df -h /mnt/ssd
# Should show your SSD with available space

# Verify swap is active (need 4GB+ for builds)
free -h
# Should show ~4GB swap

# Create gygax directories
sudo mkdir -p /mnt/ssd/gygax/{postgres,uploads,backups}
sudo chown -R 1000:1000 /mnt/ssd/gygax
```

If your SSD and swap are already configured, skip to Section 2.

### 1.4 SSD Setup (Fresh Install Only)

Skip this section if your SSD is already mounted at `/mnt/ssd`.

```bash
# Find your SSD (usually /dev/sda)
lsblk

# Create partition if needed (skip if already partitioned)
sudo fdisk /dev/sda
# n (new), p (primary), 1, enter, enter, w (write)

# Format as ext4
sudo mkfs.ext4 /dev/sda1

# Create mount point
sudo mkdir -p /mnt/ssd

# Get UUID for fstab
sudo blkid /dev/sda1
# Note the UUID value

# Add to fstab (replace UUID with yours)
echo 'UUID=your-uuid-here /mnt/ssd ext4 defaults,noatime 0 2' | sudo tee -a /etc/fstab

# Mount now
sudo mount -a
```

### 1.5 Swap Setup (Fresh Install Only)

Skip this section if you already have 4GB+ swap on your SSD.

```bash
# Disable default swap
sudo dphys-swapfile swapoff
sudo systemctl disable dphys-swapfile

# Create 4GB swap file on SSD
sudo fallocate -l 4G /mnt/ssd/swapfile
sudo chmod 600 /mnt/ssd/swapfile
sudo mkswap /mnt/ssd/swapfile
sudo swapon /mnt/ssd/swapfile

# Make permanent
echo '/mnt/ssd/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

---

## 2. Security Hardening

### 2.1 Firewall (ufw)

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable

# Verify
sudo ufw status
```

### 2.2 Fail2ban

```bash
# Create jail config
sudo tee /etc/fail2ban/jail.local << 'EOF'
[DEFAULT]
bantime = 1h
findtime = 10m
maxretry = 5

[sshd]
enabled = true
port = ssh
filter = sshd
logpath = /var/log/auth.log
maxretry = 3
bantime = 24h
EOF

sudo systemctl enable fail2ban
sudo systemctl restart fail2ban
```

### 2.3 Automatic Security Updates

```bash
sudo apt install -y unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades
```

---

## 3. Docker Setup

### 3.1 Install Docker

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# Log out and back in, then verify
docker --version
docker compose version
```

### 3.2 Move Docker Data to SSD

```bash
# Stop Docker
sudo systemctl stop docker

# Create Docker directory on SSD
sudo mkdir -p /mnt/ssd/docker

# Configure Docker to use SSD
sudo tee /etc/docker/daemon.json << 'EOF'
{
  "data-root": "/mnt/ssd/docker",
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  }
}
EOF

# Start Docker
sudo systemctl start docker
sudo systemctl enable docker

# Verify
docker info | grep "Docker Root Dir"
```

---

## 4. Clone and Configure

### 4.1 Clone Repository

```bash
cd /mnt/ssd/gygax
git clone https://github.com/YOUR_USERNAME/gygax.git app
cd app
```

### 4.2 Configure Environment

```bash
cp .env.prod.example .env.prod

# Edit with your values
nano .env.prod
```

Required environment variables:

| Variable | Description | Example |
|----------|-------------|---------|
| `DOMAIN` | Your domain name | `gygax.example.com` |
| `DATABASE_URL` | PostgreSQL connection | `postgresql://gygax:SECURE_PASSWORD@db:5432/gygax` |
| `POSTGRES_PASSWORD` | Database password | Generate with `openssl rand -base64 32` |
| `JWT_SECRET` | JWT signing key (32+ chars) | Generate with `openssl rand -base64 48` |
| `SMTP_HOST` | SMTP server | `smtp.gmail.com` |
| `SMTP_PORT` | SMTP port | `587` |
| `SMTP_USER` | Gmail address | `yourname@gmail.com` |
| `SMTP_PASSWORD` | Gmail App Password | See below |
| `SMTP_FROM` | From address | `yourname@gmail.com` |

#### Gmail App Password Setup

1. Enable 2-Step Verification on your Google account (required)
2. Go to https://myaccount.google.com/apppasswords
3. Select "Mail" and "Other (Custom name)", enter "Gygax"
4. Copy the 16-character password (no spaces) to `SMTP_PASSWORD`

Note: Gmail has a 500 emails/day limit, which is plenty for personal use.

---

## 5. Build and Deploy

### 5.1 Initial Build

First build takes 15-30 minutes on Pi 4B:

```bash
docker compose -f docker-compose.prod.yml build
```

### 5.2 Start Services

```bash
docker compose -f docker-compose.prod.yml up -d

# Check status
docker compose -f docker-compose.prod.yml ps

# View logs
docker compose -f docker-compose.prod.yml logs -f
```

### 5.3 Verify Deployment

```bash
# Check health endpoint
curl -k https://localhost/api/health

# Check SSL certificate
curl -I https://your-domain.com
```

---

## 6. DNS & Networking

### 6.1 Static IP (Recommended)

If your ISP provides a static IP, create an A record:

```
gygax.example.com.  A  YOUR_PUBLIC_IP
```

### 6.2 Dynamic DNS

For dynamic IPs, use a DDNS service:

**Cloudflare (free tier):**
```bash
# Install cloudflare-ddns
docker run -d \
  --name cloudflare-ddns \
  --restart unless-stopped \
  -e API_KEY=your_cloudflare_api_token \
  -e ZONE=example.com \
  -e SUBDOMAIN=gygax \
  oznu/cloudflare-ddns
```

**DuckDNS (free):**
```bash
# Add to crontab
(crontab -l 2>/dev/null; echo "*/5 * * * * curl -s 'https://www.duckdns.org/update?domains=YOUR_SUBDOMAIN&token=YOUR_TOKEN' >/dev/null") | crontab -
```

### 6.3 Router Port Forwarding

Forward these ports to your Pi's local IP:
- Port 80 (HTTP) → Pi:80
- Port 443 (HTTPS) → Pi:443

---

## 7. Backups

### 7.1 Database Backup Script

```bash
sudo tee /mnt/ssd/gygax/backup.sh << 'EOF'
#!/bin/bash
set -e

BACKUP_DIR="/mnt/ssd/gygax/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=7

# Create backup
docker compose -f /mnt/ssd/gygax/app/docker-compose.prod.yml exec -T db \
  pg_dump -U gygax gygax | gzip > "$BACKUP_DIR/gygax_$TIMESTAMP.sql.gz"

# Delete old backups
find "$BACKUP_DIR" -name "gygax_*.sql.gz" -mtime +$RETENTION_DAYS -delete

echo "Backup completed: gygax_$TIMESTAMP.sql.gz"
EOF

chmod +x /mnt/ssd/gygax/backup.sh
```

### 7.2 Schedule Daily Backups

```bash
# Run at 3 AM daily
(crontab -l 2>/dev/null; echo "0 3 * * * /mnt/ssd/gygax/backup.sh >> /mnt/ssd/gygax/backups/backup.log 2>&1") | crontab -
```

### 7.3 Restore from Backup

```bash
gunzip -c /mnt/ssd/gygax/backups/gygax_TIMESTAMP.sql.gz | \
  docker compose -f docker-compose.prod.yml exec -T db psql -U gygax gygax
```

---

## 8. Monitoring & Maintenance

### 8.1 Health Check Cron

```bash
sudo tee /mnt/ssd/gygax/healthcheck.sh << 'EOF'
#!/bin/bash
HEALTH_URL="http://localhost:3000/api/health"
LOG_FILE="/mnt/ssd/gygax/backups/health.log"

response=$(curl -s -o /dev/null -w "%{http_code}" "$HEALTH_URL" --max-time 10)

if [ "$response" != "200" ]; then
  echo "$(date): Health check failed (HTTP $response)" >> "$LOG_FILE"
  # Restart services
  docker compose -f /mnt/ssd/gygax/app/docker-compose.prod.yml restart
  echo "$(date): Services restarted" >> "$LOG_FILE"
fi
EOF

chmod +x /mnt/ssd/gygax/healthcheck.sh

# Run every 5 minutes
(crontab -l 2>/dev/null; echo "*/5 * * * * /mnt/ssd/gygax/healthcheck.sh") | crontab -
```

### 8.2 Disk Space Monitoring

```bash
sudo tee /mnt/ssd/gygax/diskcheck.sh << 'EOF'
#!/bin/bash
THRESHOLD=85
USAGE=$(df /mnt/ssd | tail -1 | awk '{print $5}' | sed 's/%//')

if [ "$USAGE" -gt "$THRESHOLD" ]; then
  echo "$(date): Disk usage at ${USAGE}% - above ${THRESHOLD}% threshold" >> /mnt/ssd/gygax/backups/disk.log
fi
EOF

chmod +x /mnt/ssd/gygax/diskcheck.sh

# Run hourly
(crontab -l 2>/dev/null; echo "0 * * * * /mnt/ssd/gygax/diskcheck.sh") | crontab -
```

### 8.3 View Logs

```bash
# All services
docker compose -f docker-compose.prod.yml logs -f

# Specific service
docker compose -f docker-compose.prod.yml logs -f server
docker compose -f docker-compose.prod.yml logs -f caddy

# Caddy access logs
docker compose -f docker-compose.prod.yml exec caddy cat /var/log/caddy/access.log
```

### 8.4 Updates

```bash
cd /mnt/ssd/gygax/app

# Pull latest code
git pull

# Rebuild and restart
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d

# Clean old images
docker image prune -f
```

---

## 9. Troubleshooting

### SSL Certificate Issues

```bash
# Check Caddy logs
docker compose -f docker-compose.prod.yml logs caddy

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

### WebSocket Connection Issues

```bash
# Test WebSocket locally
curl -i -N -H "Connection: Upgrade" -H "Upgrade: websocket" \
  -H "Sec-WebSocket-Version: 13" -H "Sec-WebSocket-Key: test" \
  http://localhost:3000/ws/
```

### Memory Issues

```bash
# Check memory usage
free -h

# Check Docker memory
docker stats --no-stream

# If OOM, increase swap (temporarily)
sudo fallocate -l 8G /mnt/ssd/swapfile2
sudo chmod 600 /mnt/ssd/swapfile2
sudo mkswap /mnt/ssd/swapfile2
sudo swapon /mnt/ssd/swapfile2
```

---

## 10. Security Checklist

- [ ] SSH access secured (key-only auth recommended but optional)
- [ ] Firewall enabled (ufw: 22, 80, 443 only)
- [ ] Fail2ban running
- [ ] Automatic security updates enabled
- [ ] Strong database password (32+ characters)
- [ ] Strong JWT secret (48+ characters)
- [ ] HTTPS enforced (Caddy auto-redirect)
- [ ] Security headers configured (HSTS, X-Frame-Options, etc.)
- [ ] Docker containers run as non-root

---

## Files Created

| File | Purpose |
|------|---------|
| `docker/Dockerfile.server.prod` | Multi-stage production server build |
| `docker/Dockerfile.client.prod` | Multi-stage production client build with Caddy |
| `docker/entrypoint.server.prod.sh` | Production entrypoint (migrations, seeding) |
| `docker/Caddyfile` | Reverse proxy with auto-SSL |
| `docker-compose.prod.yml` | Production orchestration |
| `.env.prod.example` | Environment variable template |

---

## Architecture

```
Internet
    │
    ▼
[Router :80/:443] ──► [Pi :80/:443]
                           │
                      ┌────┴────┐
                      │  Caddy  │  (auto-SSL, reverse proxy)
                      └────┬────┘
                           │
           ┌───────────────┼───────────────┐
           │               │               │
           ▼               ▼               ▼
      /api/*          /ws/*         /* (static)
           │               │               │
           └───────┬───────┘               │
                   ▼                       │
              [Server]                     │
              (Fastify)                    │
                   │                       │
                   ▼                       │
              [Database]              [Caddy]
              (PostgreSQL)         (static files)
              /mnt/ssd/             from build
```
