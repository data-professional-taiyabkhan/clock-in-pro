/** Resize an image file in the browser and return a data URI, keeping uploads small enough to store in the database. */
export async function fileToResizedDataUrl(
  file: File,
  opts: { maxSize: number; mime?: "image/png" | "image/jpeg" | "image/webp"; quality?: number; maxBytes?: number }
): Promise<string> {
  const { maxSize, mime = "image/webp", quality = 0.85, maxBytes } = opts;
  const bitmap = await loadImage(file);
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

  let q = quality;
  let out = canvas.toDataURL(mime, q);
  // Step quality down until under the byte budget (data URI ≈ 4/3 of bytes)
  while (maxBytes && out.length > (maxBytes * 4) / 3 && q > 0.4 && mime !== "image/png") {
    q -= 0.1;
    out = canvas.toDataURL(mime, q);
  }
  if (maxBytes && out.length > (maxBytes * 4) / 3) {
    throw new Error(`Image is too large even after resizing. Try a smaller image (max ${Math.round(maxBytes / 1024)}KB).`);
  }
  return out;
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("That file doesn't look like an image"));
    };
    img.src = url;
  });
}
