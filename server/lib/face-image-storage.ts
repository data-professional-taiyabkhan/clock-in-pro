/**
 * Local Face Image Storage — replaces AWS S3.
 * Stores face images as base64 data URIs in the database (via faceImageUrl field).
 * No external storage dependency.
 */
import crypto from "crypto";

/**
 * Generate a unique key for a face image (used as a reference ID).
 */
export function generateFaceImageKey(userId: number, timestamp?: number): string {
  const ts = timestamp || Date.now();
  const hash = crypto.createHash("sha256").update(`${userId}-${ts}`).digest("hex").slice(0, 16);
  return `face-${userId}-${hash}`;
}

/**
 * Convert base64 image string to a Buffer + content type.
 */
export function base64ToBuffer(base64Image: string): { buffer: Buffer; contentType: string } {
  let base64Data = base64Image;
  let contentType = "image/jpeg";

  if (base64Image.startsWith("data:")) {
    const match = base64Image.match(/^data:(image\/\w+);base64,/);
    if (match) {
      contentType = match[1];
    }
    base64Data = base64Image.replace(/^data:image\/\w+;base64,/, "");
  }

  return { buffer: Buffer.from(base64Data, "base64"), contentType };
}

/**
 * "Upload" face image — returns the base64 data URI directly (no S3).
 * The data URI is stored in the user's faceImageUrl field.
 */
export async function uploadFaceImage(
  userId: number,
  imageBase64: string
): Promise<{ success: boolean; imageUrl?: string; s3Key?: string; error?: string }> {
  try {
    // Ensure it's a proper data URI
    let dataUri = imageBase64;
    if (!dataUri.startsWith("data:")) {
      dataUri = `data:image/jpeg;base64,${imageBase64}`;
    }

    const key = generateFaceImageKey(userId);

    return {
      success: true,
      imageUrl: dataUri,
      s3Key: key,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || "Failed to process face image",
    };
  }
}

/**
 * Get a "signed" URL for a face image — just returns the stored URL/data URI directly.
 */
export async function getSignedFaceImageUrl(
  s3KeyOrUrl: string,
  _expiresIn: number = 900
): Promise<string | null> {
  // If it's already a data URI or URL, return it directly
  if (s3KeyOrUrl && (s3KeyOrUrl.startsWith("data:") || s3KeyOrUrl.startsWith("http"))) {
    return s3KeyOrUrl;
  }
  return null;
}

/**
 * Download face image as base64 — extracts base64 from a data URI.
 */
export async function downloadFaceImageAsBase64(s3KeyOrUrl: string): Promise<string | null> {
  if (!s3KeyOrUrl) return null;

  if (s3KeyOrUrl.startsWith("data:image")) {
    // Extract raw base64 from data URI
    const base64Part = s3KeyOrUrl.replace(/^data:image\/\w+;base64,/, "");
    return base64Part;
  }

  // If it's already raw base64
  if (!s3KeyOrUrl.startsWith("http")) {
    return s3KeyOrUrl;
  }

  return null;
}

/**
 * Delete a face image — no-op in local mode (data is in DB, cleared via storage.clearUserFaceData).
 */
export async function deleteFaceImage(_s3KeyOrUrl: string): Promise<boolean> {
  return true;
}

/**
 * Delete all face images for a user — no-op (handled by storage layer).
 */
export async function deleteUserFaceImages(_userId: number): Promise<number> {
  return 0;
}

/**
 * Check if a face image exists.
 */
export async function faceImageExists(s3KeyOrUrl: string): Promise<boolean> {
  return !!(s3KeyOrUrl && (s3KeyOrUrl.startsWith("data:") || s3KeyOrUrl.length > 10));
}

/**
 * Get storage stats.
 */
export async function getBucketStats(): Promise<{ bucketName: string; region: string; configured: boolean }> {
  return { bucketName: "local-storage", region: "local", configured: true };
}

/**
 * Upload multiple face images.
 */
export async function uploadMultipleFaceImages(
  userId: number,
  imageBase64Array: string[]
): Promise<{ success: boolean; uploadedUrls: string[]; errors: string[] }> {
  const urls: string[] = [];
  const errors: string[] = [];

  for (const img of imageBase64Array) {
    const result = await uploadFaceImage(userId, img);
    if (result.success && result.imageUrl) {
      urls.push(result.imageUrl);
    } else {
      errors.push(result.error || "Upload failed");
    }
  }

  return { success: errors.length === 0, uploadedUrls: urls, errors };
}
