/** Prepara a imagem do avatar no client: valida, redimensiona pra 512px quadrado e devolve JPEG base64.
 *  É só economia de banda + UX — o backend RE-ENCODA com sharp de qualquer jeito (fronteira de confiança). */

export const AVATAR_ACCEPT = "image/png,image/jpeg,image/webp";
const ALLOWED = new Set(["image/png", "image/jpeg", "image/webp"]);
const MAX_INPUT_BYTES = 5 * 1024 * 1024; // 5 MB no arquivo original escolhido
const OUT_SIZE = 512;

export class ImageError extends Error {}

/** Valida o arquivo e retorna um data-URL JPEG 512x512 (cover). Lança ImageError com mensagem amigável. */
export async function fileToAvatarDataUrl(file: File): Promise<string> {
  if (!ALLOWED.has(file.type)) {
    throw new ImageError("Use uma imagem PNG, JPG ou WebP.");
  }
  if (file.size > MAX_INPUT_BYTES) {
    throw new ImageError("Imagem muito grande (máx. 5 MB).");
  }

  const bitmap = await loadBitmap(file);
  try {
    const canvas = document.createElement("canvas");
    canvas.width = OUT_SIZE;
    canvas.height = OUT_SIZE;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new ImageError("Não foi possível processar a imagem.");

    // cover: recorta o centro do lado menor
    const side = Math.min(bitmap.width, bitmap.height);
    const sx = (bitmap.width - side) / 2;
    const sy = (bitmap.height - side) / 2;
    ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, OUT_SIZE, OUT_SIZE);

    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    if (!dataUrl.startsWith("data:image/jpeg")) throw new ImageError("Não foi possível processar a imagem.");
    return dataUrl;
  } finally {
    if ("close" in bitmap && typeof bitmap.close === "function") bitmap.close();
  }
}

async function loadBitmap(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    try {
      // `from-image` aplica a orientação do EXIF (foto de celular em retrato não fica deitada);
      // o fallback <img> já é auto-orientado pelo browser.
      return await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {
      /* cai pro fallback com <img> */
    }
  }
  return await new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new ImageError("Não foi possível ler a imagem."));
    };
    img.src = url;
  });
}
