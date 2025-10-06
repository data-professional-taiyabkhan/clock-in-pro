import { storage } from '../storage.js';

/**
 * Calculate Euclidean distance between two face embeddings
 */
export function face_distance(embedding1: number[], embedding2: number[]): number {
  if (embedding1.length !== embedding2.length) {
    throw new Error(`Embedding dimensions don't match: ${embedding1.length} vs ${embedding2.length}`);
  }
  
  let sum = 0;
  for (let i = 0; i < embedding1.length; i++) {
    const diff = embedding1[i] - embedding2[i];
    sum += diff * diff;
  }
  
  return Math.sqrt(sum);
}

/**
 * L2 normalize a face embedding vector
 */
export function normalizeEmbedding(embedding: number[]): number[] {
  const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
  return magnitude > 0 ? embedding.map(val => val / magnitude) : embedding;
}

/**
 * Compute mean embedding from multiple embeddings
 */
export function computeMeanEmbedding(embeddings: number[][]): number[] {
  if (embeddings.length === 0) {
    throw new Error('Cannot compute mean of empty embeddings array');
  }
  
  const dimensions = embeddings[0].length;
  const mean = new Array(dimensions).fill(0);
  
  for (const embedding of embeddings) {
    if (embedding.length !== dimensions) {
      throw new Error('All embeddings must have the same dimensions');
    }
    for (let i = 0; i < dimensions; i++) {
      mean[i] += embedding[i];
    }
  }
  
  return mean.map(val => val / embeddings.length);
}

/**
 * Extract face embedding from image data using face-api.js descriptors
 * This should be called from the frontend and passed as part of the request
 */
export async function extractFaceEmbedding(imageData: string): Promise<number[]> {
  // This is a placeholder - in production, this would use face-api.js
  // The frontend should extract the face descriptor and send it with the request
  throw new Error('Face embedding extraction should be done on the frontend using face-api.js');
}

/**
 * Verify a face against a stored user embedding
 */
export async function verifyFace(
  userId: number, 
  probeEmbedding: number[], 
  threshold: number = 0.6
): Promise<{ verified: boolean; distance: number; threshold: number; userEmail?: string; securityLevel?: string; reason?: string }> {
  
  // Load user's stored embedding from database
  const user = await storage.getUser(userId);
  if (!user) {
    throw new Error(`User not found: ${userId}`);
  }
  
  if (!user.faceEmbedding) {
    throw new Error(`No face embedding found for user: ${user.email}`);
  }
  
  // Parse the stored embedding (it's stored as JSON)
  let registeredEmbedding: number[];
  try {
    registeredEmbedding = Array.isArray(user.faceEmbedding) 
      ? user.faceEmbedding as number[]
      : JSON.parse(user.faceEmbedding as string);
  } catch (error) {
    throw new Error(`Invalid face embedding format for user: ${user.email}`);
  }
  
  // Normalize both embeddings for better comparison
  const normalizedRegistered = normalizeEmbedding(registeredEmbedding);
  const normalizedProbe = normalizeEmbedding(probeEmbedding);
  
  // Calculate distance
  const distance = face_distance(normalizedRegistered, normalizedProbe);
  
  // Log detailed comparison for security audit
  console.log(`=== FACE VERIFICATION SECURITY CHECK ===`);
  console.log(`User: ${user.email}`);
  console.log(`Distance: ${distance.toFixed(4)}`);
  console.log(`Threshold: ${threshold}`);
  console.log(`Embedding Dimensions: Registered=${normalizedRegistered.length}, Probe=${normalizedProbe.length}`);
  console.log(`Security Status: ${distance <= threshold ? 'WITHIN_THRESHOLD' : 'EXCEEDS_THRESHOLD'}`);
  console.log(`==========================================`);
  
  // Enhanced security: Multiple verification layers
  let verified = false;
  let securityLevel = 'BLOCKED';
  let reason = '';
  
  // Primary distance check with stricter threshold
  if (distance <= threshold) {
    // Secondary security checks for high-confidence verification
    if (distance <= 0.15) {
      verified = true;
      securityLevel = 'HIGH_CONFIDENCE';
      reason = 'Very strong face match';
    } else if (distance <= 0.20) {
      verified = true;
      securityLevel = 'MEDIUM_CONFIDENCE';
      reason = 'Good face match';
    } else if (distance <= 0.25) {
      verified = true;
      securityLevel = 'LOW_CONFIDENCE';
      reason = 'Acceptable face match';
    } else {
      verified = false;
      securityLevel = 'REJECTED';
      reason = `Distance ${distance.toFixed(4)} exceeds secure threshold`;
    }
  } else {
    verified = false;
    securityLevel = 'REJECTED';
    reason = `Distance ${distance.toFixed(4)} exceeds threshold ${threshold}`;
  }
  
  // Log security decision
  console.log(`Face verification for ${user.email}: ${securityLevel} - ${reason}`);
  
  return {
    verified,
    distance,
    threshold,
    userEmail: user.email,
    securityLevel,
    reason
  };
}

/**
 * Store a face embedding for a user with proper normalization
 */
export async function storeFaceEmbedding(
  userId: number,
  embedding: number[],
  faceImageUrl?: string
): Promise<void> {
  // Normalize the embedding before storing
  const normalizedEmbedding = normalizeEmbedding(embedding);
  
  if (faceImageUrl) {
    await storage.updateUserFaceEmbedding(userId, faceImageUrl, normalizedEmbedding);
  } else {
    // Just update the embedding without changing the image
    const user = await storage.getUser(userId);
    if (!user) {
      throw new Error(`User not found: ${userId}`);
    }
    await storage.updateUserFaceEmbedding(userId, user.faceImageUrl || '', normalizedEmbedding);
  }
}