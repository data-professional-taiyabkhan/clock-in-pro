/**
 * AWS Rekognition Service for Face Recognition
 * Replaces the Python DeepFace implementation
 */

import {
  RekognitionClient,
  IndexFacesCommand,
  SearchFacesByImageCommand,
  CompareFacesCommand,
  DeleteFacesCommand,
  ListFacesCommand,
  DetectFacesCommand,
} from "@aws-sdk/client-rekognition";
import { S3Client } from "@aws-sdk/client-s3";

// Lazy initialization - clients created on first use
let rekognitionClient: RekognitionClient | null = null;

function getRekognitionClient(): RekognitionClient {
  if (!rekognitionClient) {
    rekognitionClient = new RekognitionClient({
      region: process.env.AWS_REGION || "us-east-1",
      credentials: {
        accessKeyId: process.env.AWS_REKOGNITION_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID || "",
        secretAccessKey: process.env.AWS_REKOGNITION_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY || "",
      },
    });
  }
  return rekognitionClient;
}

function getCollectionId(): string {
  return process.env.AWS_REKOGNITION_COLLECTION || "attendance-faces";
}

// Thresholds
const SIMILARITY_THRESHOLD = 80; // AWS Rekognition uses percentage (0-100)
const FACE_MATCH_THRESHOLD = 80;

export interface FaceRegistrationResult {
  success: boolean;
  faceId?: string;
  confidence?: number;
  boundingBox?: any;
  imageQuality?: {
    brightness: number;
    sharpness: number;
  };
  error?: string;
}

export interface FaceVerificationResult {
  verified: boolean;
  similarity?: number;
  confidence?: number;
  faceMatches?: any[];
  details?: any;
  error?: string;
  recommendations?: string[];
}

/**
 * Convert base64 image to buffer
 */
function base64ToBuffer(base64Image: string): Buffer {
  // Remove data URL prefix if present
  const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, "");
  return Buffer.from(base64Data, "base64");
}

/**
 * Analyze face quality before registration
 */
export async function analyzeFaceQuality(imageBase64: string): Promise<{
  isGoodQuality: boolean;
  issues: string[];
  brightness: number;
  sharpness: number;
  faceDetected: boolean;
}> {
  try {
    const imageBuffer = base64ToBuffer(imageBase64);

    const command = new DetectFacesCommand({
      Image: {
        Bytes: imageBuffer,
      },
      Attributes: ["ALL"],
    });

    const response = await getRekognitionClient().send(command);

    if (!response.FaceDetails || response.FaceDetails.length === 0) {
      return {
        isGoodQuality: false,
        issues: ["No face detected in the image"],
        brightness: 0,
        sharpness: 0,
        faceDetected: false,
      };
    }

    const faceDetails = response.FaceDetails[0];
    const issues: string[] = [];

    // Check brightness
    const brightness = faceDetails.Quality?.Brightness || 0;
    if (brightness < 40) {
      issues.push("Image is too dark");
    } else if (brightness > 80) {
      issues.push("Image is too bright");
    }

    // Check sharpness
    const sharpness = faceDetails.Quality?.Sharpness || 0;
    if (sharpness < 50) {
      issues.push("Image is blurry");
    }

    // Check if face is too small or too large
    const boundingBox = faceDetails.BoundingBox;
    if (boundingBox) {
      const faceWidth = boundingBox.Width || 0;
      if (faceWidth < 0.2) {
        issues.push("Face is too small in the image");
      } else if (faceWidth > 0.9) {
        issues.push("Face is too close to camera");
      }
    }

    // Check pose
    const pose = faceDetails.Pose;
    if (pose) {
      if (Math.abs(pose.Yaw || 0) > 30) {
        issues.push("Face is turned too much to the side");
      }
      if (Math.abs(pose.Pitch || 0) > 30) {
        issues.push("Face is tilted too much");
      }
    }

    // Check if eyes are visible
    if (faceDetails.Sunglasses?.Value) {
      issues.push("Please remove sunglasses");
    }

    // Check confidence
    const confidence = faceDetails.Confidence || 0;
    if (confidence < 90) {
      issues.push("Face detection confidence is low");
    }

    return {
      isGoodQuality: issues.length === 0,
      issues,
      brightness,
      sharpness,
      faceDetected: true,
    };
  } catch (error) {
    console.error("Error analyzing face quality:", error);
    return {
      isGoodQuality: false,
      issues: [`Analysis failed: ${error.message}`],
      brightness: 0,
      sharpness: 0,
      faceDetected: false,
    };
  }
}

/**
 * Register a face in AWS Rekognition collection
 * This is called when a manager uploads an employee's face image
 */
export async function registerFace(
  imageBase64: string,
  userId: number
): Promise<FaceRegistrationResult> {
  try {
    // First, analyze face quality
    const qualityCheck = await analyzeFaceQuality(imageBase64);
    if (!qualityCheck.isGoodQuality) {
      return {
        success: false,
        error: `Poor image quality: ${qualityCheck.issues.join(", ")}`,
      };
    }

    const imageBuffer = base64ToBuffer(imageBase64);

    // Index the face in the collection
    const command = new IndexFacesCommand({
      CollectionId: getCollectionId(),
      Image: {
        Bytes: imageBuffer,
      },
      ExternalImageId: `user-${userId}`, // Link face to user ID
      DetectionAttributes: ["ALL"],
      MaxFaces: 1, // Only register the most prominent face
      QualityFilter: "AUTO", // Automatically filter low-quality faces
    });

    const response = await getRekognitionClient().send(command);

    if (!response.FaceRecords || response.FaceRecords.length === 0) {
      return {
        success: false,
        error: "No face detected in the image. Please ensure face is clearly visible.",
      };
    }

    const faceRecord = response.FaceRecords[0];
    const faceId = faceRecord.Face?.FaceId;
    const confidence = faceRecord.Face?.Confidence || 0;

    console.log(`Face registered successfully:`, {
      userId,
      faceId,
      confidence: confidence.toFixed(2),
      imageQuality: faceRecord.FaceDetail?.Quality,
    });

    return {
      success: true,
      faceId,
      confidence,
      boundingBox: faceRecord.FaceDetail?.BoundingBox,
      imageQuality: {
        brightness: faceRecord.FaceDetail?.Quality?.Brightness || 0,
        sharpness: faceRecord.FaceDetail?.Quality?.Sharpness || 0,
      },
    };
  } catch (error) {
    console.error("Error registering face:", error);
    return {
      success: false,
      error: `Failed to register face: ${error.message}`,
    };
  }
}

/**
 * Verify a face against registered faces in the collection
 * This is called during clock-in/clock-out
 */
export async function verifyFace(
  capturedImageBase64: string,
  expectedUserId?: number
): Promise<FaceVerificationResult> {
  try {
    const imageBuffer = base64ToBuffer(capturedImageBase64);

    // Search for matching faces in the collection
    const command = new SearchFacesByImageCommand({
      CollectionId: getCollectionId(),
      Image: {
        Bytes: imageBuffer,
      },
      MaxFaces: 5, // Get top 5 matches
      FaceMatchThreshold: FACE_MATCH_THRESHOLD,
    });

    const response = await getRekognitionClient().send(command);

    if (!response.FaceMatches || response.FaceMatches.length === 0) {
      return {
        verified: false,
        error: "No matching face found. Please ensure your face is clearly visible.",
        recommendations: [
          "Ensure good lighting",
          "Face the camera directly",
          "Remove any obstructions (glasses, masks)",
          "Contact your manager if issue persists",
        ],
      };
    }

    // Get the best match
    const bestMatch = response.FaceMatches[0];
    const similarity = bestMatch.Similarity || 0;
    const matchedUserId = bestMatch.Face?.ExternalImageId
      ? parseInt(bestMatch.Face.ExternalImageId.replace("user-", ""))
      : null;

    console.log(`Face verification result:`, {
      similarity: similarity.toFixed(2),
      matchedUserId,
      expectedUserId,
      confidence: bestMatch.Face?.Confidence,
    });

    // If we expect a specific user, verify it matches
    if (expectedUserId && matchedUserId !== expectedUserId) {
      return {
        verified: false,
        similarity,
        error: "Face does not match the expected user",
        recommendations: [
          "Ensure you are the correct person",
          "Try better lighting",
          "Contact your manager if this is an error",
        ],
      };
    }

    // Check if similarity meets threshold
    if (similarity < SIMILARITY_THRESHOLD) {
      return {
        verified: false,
        similarity,
        error: `Face similarity too low (${similarity.toFixed(1)}% < ${SIMILARITY_THRESHOLD}%)`,
        recommendations: [
          "Try better lighting",
          "Ensure face is clearly visible",
          "Face the camera directly",
        ],
      };
    }

    return {
      verified: true,
      similarity,
      confidence: bestMatch.Face?.Confidence || 0,
      faceMatches: response.FaceMatches.map((match) => ({
        userId: match.Face?.ExternalImageId?.replace("user-", ""),
        similarity: match.Similarity,
        confidence: match.Face?.Confidence,
      })),
      details: {
        matchedUserId,
        threshold: SIMILARITY_THRESHOLD,
        engine: "aws_rekognition",
      },
    };
  } catch (error) {
    console.error("Error verifying face:", error);
    return {
      verified: false,
      error: `Face verification failed: ${error.message}`,
      recommendations: ["Please try again", "Contact support if issue persists"],
    };
  }
}

/**
 * Compare two faces directly (useful for testing)
 */
export async function compareTwoFaces(
  sourceImageBase64: string,
  targetImageBase64: string
): Promise<{
  isMatch: boolean;
  similarity: number;
  confidence: number;
  details?: any;
}> {
  try {
    const sourceBuffer = base64ToBuffer(sourceImageBase64);
    const targetBuffer = base64ToBuffer(targetImageBase64);

    const command = new CompareFacesCommand({
      SourceImage: {
        Bytes: sourceBuffer,
      },
      TargetImage: {
        Bytes: targetBuffer,
      },
      SimilarityThreshold: SIMILARITY_THRESHOLD,
    });

    const response = await getRekognitionClient().send(command);

    if (!response.FaceMatches || response.FaceMatches.length === 0) {
      return {
        isMatch: false,
        similarity: 0,
        confidence: 0,
      };
    }

    const match = response.FaceMatches[0];
    const similarity = match.Similarity || 0;

    return {
      isMatch: similarity >= SIMILARITY_THRESHOLD,
      similarity,
      confidence: match.Face?.Confidence || 0,
      details: {
        threshold: SIMILARITY_THRESHOLD,
        engine: "aws_rekognition",
      },
    };
  } catch (error) {
    console.error("Error comparing faces:", error);
    throw new Error(`Failed to compare faces: ${error.message}`);
  }
}

/**
 * Delete a face from the collection (when user is deleted)
 */
export async function deleteFace(faceId: string): Promise<boolean> {
  try {
    const command = new DeleteFacesCommand({
      CollectionId: getCollectionId(),
      FaceIds: [faceId],
    });

    const response = await getRekognitionClient().send(command);
    return (response.DeletedFaces?.length || 0) > 0;
  } catch (error) {
    console.error("Error deleting face:", error);
    return false;
  }
}

/**
 * Delete all faces for a user (in case of multiple registrations)
 */
export async function deleteUserFaces(userId: number): Promise<number> {
  try {
    // First, list all faces with this user ID
    const listCommand = new ListFacesCommand({
      CollectionId: getCollectionId(),
      MaxResults: 1000,
    });

    const listResponse = await getRekognitionClient().send(listCommand);
    const userFaceIds =
      listResponse.Faces?.filter(
        (face) => face.ExternalImageId === `user-${userId}`
      ).map((face) => face.FaceId as string) || [];

    if (userFaceIds.length === 0) {
      return 0;
    }

    // Delete all matching faces
    const deleteCommand = new DeleteFacesCommand({
      CollectionId: getCollectionId(),
      FaceIds: userFaceIds,
    });

    const deleteResponse = await getRekognitionClient().send(deleteCommand);
    return deleteResponse.DeletedFaces?.length || 0;
  } catch (error) {
    console.error("Error deleting user faces:", error);
    return 0;
  }
}

/**
 * Initialize Rekognition collection (run once during setup)
 */
export async function initializeCollection(): Promise<boolean> {
  try {
    const { CreateCollectionCommand, ListCollectionsCommand } = await import(
      "@aws-sdk/client-rekognition"
    );

    // Check if collection already exists
    const listCommand = new ListCollectionsCommand({});
    const listResponse = await getRekognitionClient().send(listCommand);

    const collectionId = getCollectionId();
    if (listResponse.CollectionIds?.includes(collectionId)) {
      console.log(`Collection ${collectionId} already exists`);
      return true;
    }

    // Create new collection
    const createCommand = new CreateCollectionCommand({
      CollectionId: collectionId,
    });

    await getRekognitionClient().send(createCommand);
    console.log(`Collection ${collectionId} created successfully`);
    return true;
  } catch (error) {
    console.error("Error initializing collection:", error);
    return false;
  }
}

/**
 * Get collection statistics
 */
export async function getCollectionStats(): Promise<{
  faceCount: number;
  collectionId: string;
}> {
  try {
    const { DescribeCollectionCommand } = await import(
      "@aws-sdk/client-rekognition"
    );

    const collectionId = getCollectionId();
    const command = new DescribeCollectionCommand({
      CollectionId: collectionId,
    });

    const response = await getRekognitionClient().send(command);

    return {
      faceCount: response.FaceCount || 0,
      collectionId: collectionId,
    };
  } catch (error) {
    console.error("Error getting collection stats:", error);
    const collectionId = getCollectionId();
    return {
      faceCount: 0,
      collectionId: collectionId,
    };
  }
}

