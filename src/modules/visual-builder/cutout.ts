/** Pixels below this alpha count as transparent. */
const TRANSPARENT_ALPHA = 16;
const ANALYSIS_EDGE = 160;

/**
 * A cut-out figure has a clearly transparent surrounding: a noticeable share of transparent pixels overall and
 * on the image border. Finished creatives and photos are opaque; rounded corners alone do not qualify.
 */
export function isCutoutPixels(rgba: ArrayLike<number>, width: number, height: number): boolean {
  if (width <= 0 || height <= 0 || rgba.length < width * height * 4) return false;
  let transparent = 0;
  let border = 0;
  let borderTransparent = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const clear = rgba[(y * width + x) * 4 + 3] < TRANSPARENT_ALPHA;
      if (clear) transparent += 1;
      if (x === 0 || y === 0 || x === width - 1 || y === height - 1) {
        border += 1;
        if (clear) borderTransparent += 1;
      }
    }
  }
  return transparent / (width * height) >= 0.05 && borderTransparent / border >= 0.25;
}

const UPLOAD_LIMIT = 3.9 * 1024 * 1024;
const UPLOAD_EDGE = 2400;

/**
 * Browser only: scales an image down until it fits the upload limit. Cut-outs stay PNG to keep their transparency,
 * opaque images become JPEG. Small files are returned unchanged.
 */
export async function shrinkForUpload(file: File, image: HTMLImageElement, cutout: boolean): Promise<File> {
  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;
  if (file.size <= UPLOAD_LIMIT && Math.max(width, height) <= UPLOAD_EDGE) return file;
  const type = cutout ? "image/png" : "image/jpeg";
  const base = file.name.replace(/\.[^.]+$/, "");
  let edge = Math.min(UPLOAD_EDGE, Math.max(width, height));
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const factor = edge / Math.max(width, height);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(width * factor));
    canvas.height = Math.max(1, Math.round(height * factor));
    canvas.getContext("2d")?.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.9));
    if (blob && blob.size <= UPLOAD_LIMIT) return new File([blob], `${base}.${cutout ? "png" : "jpg"}`, { type });
    edge = Math.round(edge * 0.8);
  }
  throw new Error("Das Bild ist zu groß.");
}

/** Browser only: analyses a loaded image on a small canvas. Cross-origin images that cannot be read count as opaque. */
export function detectCutout(image: HTMLImageElement): boolean {
  const factor = Math.min(1, ANALYSIS_EDGE / Math.max(image.naturalWidth || image.width, image.naturalHeight || image.height));
  const width = Math.max(1, Math.round((image.naturalWidth || image.width) * factor));
  const height = Math.max(1, Math.round((image.naturalHeight || image.height) * factor));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return false;
  context.drawImage(image, 0, 0, width, height);
  try {
    return isCutoutPixels(context.getImageData(0, 0, width, height).data, width, height);
  } catch {
    return false;
  }
}
