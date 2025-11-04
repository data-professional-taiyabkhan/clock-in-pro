/**
 * AWS S3 Storage Service for Face Images
 * Replaces local/base64 storage with cloud storage
 */

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import crypto from "crypto";

// Lazy initialization - clients created on first use
let s3Client: S3Client | null = null;

function getS3Client(): S3Client {
  if (!s3Client) {
    s3Client = new S3Client({
      region: process.env.AWS_REGION || "us-east-1",
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
      },
    });
  }
  return s3Client;
}

function getBucketName(): string {
  return process.env.AWS_S3_BUCKET || "";
}

/**
 * Generate a unique S3 key for a face image
 */
function generateFaceImageKey(userId: number, timestamp?: number): string {
  const ts = timestamp || Date.now();
  const hash = crypto.createHash("md5").update(`${userId}-${ts}`).digest("hex");
  return `faces/user-${userId}/${hash}.jpg`;
}

/**
 * Convert base64 image to buffer
 */
function base64ToBuffer(base64Image: string): {
  buffer: Buffer;
  contentType: string;
} {
  // Extract content type and base64 data
  let contentType = "image/jpeg";
  let base64Data = base64Image;

  if (base64Image.startsWith("data:")) {
    const matches = base64Image.match(/^data:([^;]+);base64,(.+)$/);
    if (matches) {
      contentType = matches[1];
      base64Data = matches[2];
    }
  }

  const buffer = Buffer.from(base64Data, "base64");
  return { buffer, contentType };
}

/**
 * Upload face image to S3
 */
export async function uploadFaceImage(
  userId: number,
  imageBase64: string
): Promise<{
  success: boolean;
  imageUrl?: string;
  s3Key?: string;
  error?: string;
}> {
  try {
    const bucketName = getBucketName();
    if (!bucketName) {
      throw new Error("S3 bucket not configured");
    }

    const { buffer, contentType } = base64ToBuffer(imageBase64);
    const s3Key = generateFaceImageKey(userId);

    // Upload to S3
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: s3Key,
      Body: buffer,
      ContentType: contentType,
      Metadata: {
        userId: userId.toString(),
        uploadedAt: new Date().toISOString(),
      },
      // Server-side encryption
      ServerSideEncryption: "AES256",
    });

    await getS3Client().send(command);

    // Generate the S3 URL (not publicly accessible, will use signed URLs)
    const imageUrl = `s3://${bucketName}/${s3Key}`;

    console.log(`Face image uploaded to S3:`, {
      userId,
      s3Key,
      size: buffer.length,
    });

    return {
      success: true,
      imageUrl,
      s3Key,
    };
  } catch (error) {
    console.error("Error uploading face image to S3:", error);
    return {
      success: false,
      error: `Failed to upload image: ${error.message}`,
    };
  }
}

/**
 * Get a signed URL for accessing a face image
 * Signed URLs expire after a certain time (default 15 minutes)
 */
export async function getSignedFaceImageUrl(
  s3KeyOrUrl: string,
  expiresIn: number = 900 // 15 minutes
): Promise<string | null> {
  try {
    const bucketName = getBucketName();
    if (!bucketName) {
      throw new Error("S3 bucket not configured");
    }

    // Extract S3 key from URL if needed
    let s3Key = s3KeyOrUrl;
    if (s3KeyOrUrl.startsWith("s3://")) {
      s3Key = s3KeyOrUrl.replace(`s3://${getBucketName()}/`, "");
    } else if (s3KeyOrUrl.startsWith("https://")) {
      // Extract key from HTTPS URL
      const url = new URL(s3KeyOrUrl);
      s3Key = url.pathname.substring(1); // Remove leading /
    }

    const command = new GetObjectCommand({
      Bucket: getBucketName(),
      Key: s3Key,
    });

    const signedUrl = await getSignedUrl(getS3Client(), command, { expiresIn });
    return signedUrl;
  } catch (error) {
    console.error("Error generating signed URL:", error);
    return null;
  }
}

/**
 * Download face image from S3 as base64
 * Useful for backward compatibility with existing face recognition code
 */
export async function downloadFaceImageAsBase64(
  s3KeyOrUrl: string
): Promise<string | null> {
  try {
    const bucketName = getBucketName();
    if (!bucketName) {
      throw new Error("S3 bucket not configured");
    }

    // Extract S3 key from URL if needed
    let s3Key = s3KeyOrUrl;
    if (s3KeyOrUrl.startsWith("s3://")) {
      s3Key = s3KeyOrUrl.replace(`s3://${getBucketName()}/`, "");
    }

    const command = new GetObjectCommand({
      Bucket: getBucketName(),
      Key: s3Key,
    });

    const response = await s3Client.send(command);

    if (!response.Body) {
      return null;
    }

    // Convert stream to buffer
    const chunks: Uint8Array[] = [];
    for await (const chunk of response.Body as any) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);

    // Convert to base64 with data URL prefix
    const contentType = response.ContentType || "image/jpeg";
    const base64 = buffer.toString("base64");
    return `data:${contentType};base64,${base64}`;
  } catch (error) {
    console.error("Error downloading face image from S3:", error);
    return null;
  }
}

/**
 * Delete face image from S3
 */
export async function deleteFaceImage(s3KeyOrUrl: string): Promise<boolean> {
  try {
    const bucketName = getBucketName();
    if (!bucketName) {
      throw new Error("S3 bucket not configured");
    }

    // Extract S3 key from URL if needed
    let s3Key = s3KeyOrUrl;
    if (s3KeyOrUrl.startsWith("s3://")) {
      s3Key = s3KeyOrUrl.replace(`s3://${getBucketName()}/`, "");
    }

    const command = new DeleteObjectCommand({
      Bucket: getBucketName(),
      Key: s3Key,
    });

    await getS3Client().send(command);

    console.log(`Face image deleted from S3:`, { s3Key });
    return true;
  } catch (error) {
    console.error("Error deleting face image from S3:", error);
    return false;
  }
}

/**
 * Delete all face images for a user
 */
export async function deleteUserFaceImages(userId: number): Promise<number> {
  try {
    const bucketName = getBucketName();
    if (!bucketName) {
      throw new Error("S3 bucket not configured");
    }

    const { ListObjectsV2Command, DeleteObjectsCommand } = await import(
      "@aws-sdk/client-s3"
    );

    // List all objects with the user's prefix
    const prefix = `faces/user-${userId}/`;
    const listCommand = new ListObjectsV2Command({
      Bucket: getBucketName(),
      Prefix: prefix,
    });

    const listResponse = await s3Client.send(listCommand);

    if (!listResponse.Contents || listResponse.Contents.length === 0) {
      return 0;
    }

    // Delete all objects
    const objectsToDelete = listResponse.Contents.map((obj) => ({
      Key: obj.Key,
    }));

    const deleteCommand = new DeleteObjectsCommand({
      Bucket: BUCKET_NAME,
      Delete: {
        Objects: objectsToDelete,
      },
    });

    const deleteResponse = await s3Client.send(deleteCommand);
    const deletedCount = deleteResponse.Deleted?.length || 0;

    console.log(`Deleted ${deletedCount} face images for user ${userId}`);
    return deletedCount;
  } catch (error) {
    console.error("Error deleting user face images:", error);
    return 0;
  }
}

/**
 * Check if a face image exists in S3
 */
export async function faceImageExists(s3KeyOrUrl: string): Promise<boolean> {
  try {
    const bucketName = getBucketName();
    if (!bucketName) {
      throw new Error("S3 bucket not configured");
    }

    // Extract S3 key from URL if needed
    let s3Key = s3KeyOrUrl;
    if (s3KeyOrUrl.startsWith("s3://")) {
      s3Key = s3KeyOrUrl.replace(`s3://${getBucketName()}/`, "");
    }

    const command = new HeadObjectCommand({
      Bucket: getBucketName(),
      Key: s3Key,
    });

    await getS3Client().send(command);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Get bucket statistics
 */
export async function getBucketStats(): Promise<{
  bucketName: string;
  region: string;
  configured: boolean;
}> {
  return {
    bucketName: getBucketName(),
    region: process.env.AWS_REGION || "us-east-1",
    configured: Boolean(getBucketName()),
  };
}

/**
 * Upload multiple face images for a user (for training with multiple angles)
 */
export async function uploadMultipleFaceImages(
  userId: number,
  imageBase64Array: string[]
): Promise<{
  success: boolean;
  uploadedUrls: string[];
  errors: string[];
}> {
  const uploadedUrls: string[] = [];
  const errors: string[] = [];

  for (let i = 0; i < imageBase64Array.length; i++) {
    const result = await uploadFaceImage(userId, imageBase64Array[i]);
    if (result.success && result.imageUrl) {
      uploadedUrls.push(result.imageUrl);
    } else {
      errors.push(result.error || `Failed to upload image ${i + 1}`);
    }
  }

  return {
    success: errors.length === 0,
    uploadedUrls,
    errors,
  };
}

