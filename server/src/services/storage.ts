import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
  CreateBucketCommand,
  PutBucketPolicyCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3'

const s3Client = new S3Client({
  endpoint: process.env.S3_ENDPOINT,
  region: 'us-east-1',
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY!,
    secretAccessKey: process.env.S3_SECRET_KEY!,
  },
  forcePathStyle: true,
})

const bucket = process.env.S3_BUCKET || 'gygax-uploads'
const publicUrl = process.env.S3_PUBLIC_URL || 'http://localhost:9000/gygax-uploads'

export async function initializeBucket(): Promise<void> {
  try {
    await s3Client.send(new HeadBucketCommand({ Bucket: bucket }))
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'name' in error && error.name === 'NotFound') {
      await s3Client.send(new CreateBucketCommand({ Bucket: bucket }))

      const policy = {
        Version: '2012-10-17',
        Statement: [
          {
            Sid: 'PublicRead',
            Effect: 'Allow',
            Principal: '*',
            Action: ['s3:GetObject'],
            Resource: [`arn:aws:s3:::${bucket}/*`],
          },
        ],
      }

      await s3Client.send(
        new PutBucketPolicyCommand({
          Bucket: bucket,
          Policy: JSON.stringify(policy),
        })
      )
    } else {
      throw error
    }
  }
}

export async function uploadFile(key: string, body: Buffer, contentType: string): Promise<string> {
  await s3Client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  )

  return getPublicUrl(key)
}

export async function deleteFile(key: string): Promise<void> {
  await s3Client.send(
    new DeleteObjectCommand({
      Bucket: bucket,
      Key: key,
    })
  )
}

export async function deleteFolder(prefix: string): Promise<void> {
  const listResponse = await s3Client.send(
    new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: prefix,
    })
  )

  if (listResponse.Contents) {
    for (const object of listResponse.Contents) {
      if (object.Key) {
        await deleteFile(object.Key)
      }
    }
  }
}

export function getPublicUrl(key: string): string {
  return `${publicUrl}/${key}`
}

export function extractKeyFromUrl(url: string): string | null {
  if (!url.startsWith(publicUrl)) {
    return null
  }
  return url.slice(publicUrl.length + 1)
}
