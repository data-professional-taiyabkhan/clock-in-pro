/**
 * Face descriptor helpers — pure functions, no database access.
 *
 * A "descriptor" is the 128-dimensional float vector produced in the browser by
 * face-api.js (faceRecognitionNet). Descriptors are compared with plain
 * Euclidean distance on the RAW vectors, and the model's standard decision
 * threshold is 0.6 (same person ≈ 0.3–0.5, different people ≈ 0.75–0.9).
 *
 * Do NOT L2-normalise descriptors before comparing. face-api.js descriptors
 * have a norm of ≈1.4, so normalising shrinks every distance by ≈30% and the
 * 0.6 threshold then accepts different people.
 */

export const DESCRIPTOR_LENGTH = 128;
export const DEFAULT_FACE_MATCH_THRESHOLD = 0.6;

/** Maximum accepted distance; overridable with FACE_MATCH_THRESHOLD. */
export function getFaceMatchThreshold(): number {
  const raw = process.env.FACE_MATCH_THRESHOLD;
  const parsed = raw ? Number.parseFloat(raw) : Number.NaN;
  return Number.isFinite(parsed) && parsed > 0 && parsed < 2 ? parsed : DEFAULT_FACE_MATCH_THRESHOLD;
}

/** True only for an array of exactly 128 finite numbers. */
export function isFaceDescriptor(value: unknown): value is number[] {
  return (
    Array.isArray(value) &&
    value.length === DESCRIPTOR_LENGTH &&
    value.every((v) => typeof v === "number" && Number.isFinite(v))
  );
}

export function euclideanDistance(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(`Descriptor lengths must match (${a.length} vs ${b.length})`);
  }
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const diff = a[i] - b[i];
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}

/** Element-wise mean of several descriptors (the stored "centroid"). */
export function meanDescriptor(descriptors: number[][]): number[] {
  if (descriptors.length === 0) {
    throw new Error("Cannot average an empty descriptor list");
  }
  const mean = new Array<number>(DESCRIPTOR_LENGTH).fill(0);
  for (const d of descriptors) {
    for (let i = 0; i < DESCRIPTOR_LENGTH; i++) mean[i] += d[i];
  }
  return mean.map((v) => v / descriptors.length);
}

export interface RegistrationPayload {
  /** The single embedding to store (centroid of the samples). */
  embedding: number[];
  /** How many valid descriptor samples contributed to it. */
  samples: number;
}

/**
 * Parse the `faceData` string posted to /api/register-face.
 *
 * Accepted shapes:
 *  - `{ type: "advanced-training", poseDescriptors: [{ descriptor }], primaryDescriptor }`
 *  - `{ descriptor: number[] }`
 *  - `number[]`
 *
 * Every descriptor must be exactly 128 finite numbers. Anything else returns
 * null so that malformed data can never be stored and break clock-in later.
 */
export function parseRegistrationPayload(faceData: string): RegistrationPayload | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(faceData);
  } catch {
    return null;
  }

  if (isFaceDescriptor(parsed)) {
    return { embedding: parsed, samples: 1 };
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return null;
  }
  const obj = parsed as Record<string, unknown>;

  if (obj.type === "advanced-training") {
    const poses = Array.isArray(obj.poseDescriptors)
      ? obj.poseDescriptors
          .map((p) => (p && typeof p === "object" ? (p as Record<string, unknown>).descriptor : undefined))
          .filter(isFaceDescriptor)
      : [];
    if (poses.length > 0) {
      return { embedding: meanDescriptor(poses), samples: poses.length };
    }
    if (isFaceDescriptor(obj.primaryDescriptor)) {
      return { embedding: obj.primaryDescriptor, samples: 1 };
    }
    return null;
  }

  if (isFaceDescriptor(obj.descriptor)) {
    return { embedding: obj.descriptor, samples: 1 };
  }

  return null;
}
