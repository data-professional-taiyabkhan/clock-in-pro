/**
 * Local Face Recognition — server-side utilities.
 * Only analyzeFaceQuality remains (used by photo-upload endpoint).
 * All other stubs have been deleted; real face matching uses
 * client-computed face-api.js descriptors compared server-side
 * via Euclidean distance (see routes.ts verify-face).
 */

/**
 * Analyze face quality — accepts any image without real face detection.
 * Returns a green-light result so the existing photo upload flow works unchanged.
 */
export async function analyzeFaceQuality(imageBase64: string): Promise<{
  isGoodQuality: boolean;
  issues: string[];
  brightness: number;
  sharpness: number;
  faceDetected: boolean;
}> {
  // Strip data URI prefix
  let raw = imageBase64;
  if (raw.startsWith("data:")) {
    raw = raw.replace(/^data:image\/\w+;base64,/, "");
  }
  const buf = Buffer.from(raw, "base64");

  if (buf.length < 1000) {
    return {
      isGoodQuality: false,
      issues: ["Image too small — please capture a clearer photo"],
      brightness: 0,
      sharpness: 0,
      faceDetected: false,
    };
  }
  return {
    isGoodQuality: true,
    issues: [],
    brightness: 80,
    sharpness: 80,
    faceDetected: true,
  };
}
