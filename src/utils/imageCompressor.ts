/**
 * Medical-grade client-side image compression utility.
 * Resizes large smartphone camera photos (8MB - 15MB) down to crisp, legible medical scans (~200KB - 400KB)
 * preserving text clarity for prescription dosage and lab values while drastically speeding up
 * Google Drive uploads and IndexedDB storage.
 */

export interface CompressionResult {
  base64: string;
  fileSizeStr: string;
  originalSizeStr: string;
  width: number;
  height: number;
}

export async function compressMedicalImage(
  fileOrBase64: File | string,
  maxDimension: number = 1600,
  quality: number = 0.82
): Promise<CompressionResult> {
  return new Promise((resolve, reject) => {
    let rawBase64 = '';
    let originalBytes = 0;

    const processImageSource = (src: string, originalSize: number) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';

      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // Calculate aspect-ratio preserved dimensions
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          // Fallback if canvas 2D context fails
          resolve({
            base64: src,
            fileSizeStr: formatBytes(originalSize),
            originalSizeStr: formatBytes(originalSize),
            width: img.width,
            height: img.height,
          });
          return;
        }

        // Apply crisp rendering for prescription handwriting and typed medicine labels
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        // Draw and compress to JPEG
        ctx.drawImage(img, 0, 0, width, height);
        const compressedBase64 = canvas.toDataURL('image/jpeg', quality);

        // Calculate compressed size in bytes from base64 string
        const base64Length = compressedBase64.length - (compressedBase64.indexOf(',') + 1);
        const compressedBytes = Math.round((base64Length * 3) / 4);

        resolve({
          base64: compressedBase64,
          fileSizeStr: formatBytes(compressedBytes),
          originalSizeStr: formatBytes(originalSize),
          width,
          height,
        });
      };

      img.onerror = () => {
        resolve({
          base64: src,
          fileSizeStr: formatBytes(originalSize),
          originalSizeStr: formatBytes(originalSize),
          width: 0,
          height: 0,
        });
      };

      img.src = src;
    };

    if (typeof fileOrBase64 === 'string') {
      const base64Length = fileOrBase64.length - (fileOrBase64.indexOf(',') + 1);
      originalBytes = Math.round((base64Length * 3) / 4);
      processImageSource(fileOrBase64, originalBytes);
    } else {
      originalBytes = fileOrBase64.size;
      const reader = new FileReader();
      reader.onload = e => {
        const result = e.target?.result as string;
        processImageSource(result, originalBytes);
      };
      reader.onerror = err => reject(err);
      reader.readAsDataURL(fileOrBase64);
    }
  });
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  if (bytes > 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${Math.round(bytes / 1024)} KB`;
}
