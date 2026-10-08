const ALLOWED_TYPES = ["image/jpeg", "image/png"];
const MAX_DIMENSION = 1280;
// Target ukuran biner sebelum di-encode base64. Base64 menambah ukuran ~33%,
// jadi 600KB biner -> ~800KB string, masih aman di bawah limit dokumen Firestore (1MB).
const DEFAULT_MAX_SIZE_KB = 600;
const MAX_BASE64_LENGTH = 900 * 1024;

export async function compressImage(file: File, maxSizeKB = DEFAULT_MAX_SIZE_KB): Promise<Blob> {
  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new Error("Tipe file tidak didukung. Gunakan JPEG atau PNG.");
  }

  const imageBitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_DIMENSION / Math.max(imageBitmap.width, imageBitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(imageBitmap.width * scale);
  canvas.height = Math.round(imageBitmap.height * scale);

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Gagal memproses gambar di canvas.");
  }
  ctx.drawImage(imageBitmap, 0, 0, canvas.width, canvas.height);

  const maxSizeBytes = maxSizeKB * 1024;
  let quality = 0.9;
  let blob = await canvasToBlob(canvas, quality);

  while (blob.size > maxSizeBytes && quality > 0.1) {
    quality -= 0.1;
    blob = await canvasToBlob(canvas, quality);
  }
  

  return blob;
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (result) => {
        if (result) {
          resolve(result);
        } else {
          reject(new Error("Gagal mengonversi gambar."));
        }
      },
      "image/jpeg",
      quality
    );
  });
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Gagal membaca hasil kompresi gambar."));
    reader.readAsDataURL(blob);
  });
}

// Menyimpan foto sebagai data URI base64 langsung di Firestore (bukan Firebase Storage),
// karena Storage butuh plan Blaze berbayar.
export async function compressImageToBase64(file: File): Promise<string> {
  const compressedBlob = await compressImage(file);
  const base64 = await blobToBase64(compressedBlob);

  if (base64.length > MAX_BASE64_LENGTH) {
    throw new Error("Foto masih terlalu besar setelah dikompresi. Coba gunakan foto lain.");
  }

  return base64;
}
