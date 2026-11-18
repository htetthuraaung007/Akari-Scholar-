/**
 * Hybrid Zero-Overflow Storage Engine (`AkariScholarStorageDB`)
 *
 * Moves heavy binary/Base64 assets (Course Syllabus Images & PDFs) to browser IndexedDB
 * while keeping lightweight JSON metadata in `localStorage` with `QuotaExceededError` guards.
 * Also provides HTML5 Canvas client-side image compression (`<= 1280px`, `0.75` quality WebP/JPEG)
 * prior to IndexedDB persistence and Gemini API dispatch.
 */

const DB_NAME = 'AkariScholarStorageDB';
const DB_VERSION = 1;
const STORE_NAME = 'syllabus_files';

export interface CompressedSyllabusAsset {
  blob: Blob;
  base64Data: string;
  dataUrl: string;
  mimeType: string;
  sizeBytes: number;
  sizeLabel: string;
}

/**
 * Formats byte size into human-readable KB / MB string.
 */
export function formatByteSizeLabel(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * Opens (or initializes) the `AkariScholarStorageDB` IndexedDB instance
 * with object store `syllabus_files`.
 */
function openSyllabusDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !('indexedDB' in window)) {
      reject(new Error('IndexedDB is not supported in this browser environment.'));
      return;
    }

    try {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        reject(request.error ?? new Error('Failed to open AkariScholarStorageDB.'));
      };
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Saves a syllabus file (`Blob` or Base64/DataURL `string`) into IndexedDB keyed by `courseId` (1 to 4).
 */
export async function saveSyllabusFile(
  courseId: number,
  fileBlob: Blob | string
): Promise<void> {
  try {
    const db = await openSyllabusDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(fileBlob, courseId);

      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error ?? new Error(`Failed to save syllabus for course ${courseId}`));
      tx.oncomplete = () => {
        db.close();
      };
      tx.onerror = () => {
        db.close();
      };
    });
  } catch (err) {
    console.warn(`[AkariScholarStorageDB] saveSyllabusFile(${courseId}) failed:`, err);
  }
}

/**
 * Retrieves a syllabus file (`Blob | string | null`) from IndexedDB by `courseId` (1 to 4).
 */
export async function getSyllabusFile(
  courseId: number
): Promise<Blob | string | null> {
  try {
    const db = await openSyllabusDatabase();
    return await new Promise<Blob | string | null>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(courseId);

      req.onsuccess = () => {
        resolve((req.result as Blob | string | undefined) ?? null);
      };
      req.onerror = () => {
        reject(req.error ?? new Error(`Failed to get syllabus for course ${courseId}`));
      };
      tx.oncomplete = () => {
        db.close();
      };
      tx.onerror = () => {
        db.close();
      };
    });
  } catch (err) {
    console.warn(`[AkariScholarStorageDB] getSyllabusFile(${courseId}) failed:`, err);
    return null;
  }
}

/**
 * Deletes a single course's syllabus file from IndexedDB by `courseId` (1 to 4).
 */
export async function deleteSyllabusFile(courseId: number): Promise<void> {
  try {
    const db = await openSyllabusDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(courseId);

      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error ?? new Error(`Failed to delete syllabus for course ${courseId}`));
      tx.oncomplete = () => {
        db.close();
      };
      tx.onerror = () => {
        db.close();
      };
    });
  } catch (err) {
    console.warn(`[AkariScholarStorageDB] deleteSyllabusFile(${courseId}) failed:`, err);
  }
}

/**
 * Purges all stored syllabus files from `AkariScholarStorageDB` (`syllabus_files` store).
 * Invoked during Emergency Wipe to leave zero residual binary data.
 */
export async function clearAllSyllabusFiles(): Promise<void> {
  try {
    const db = await openSyllabusDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.clear();

      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error ?? new Error('Failed to clear syllabus_files store'));
      tx.oncomplete = () => {
        db.close();
      };
      tx.onerror = () => {
        db.close();
      };
    });
  } catch (err) {
    console.warn('[AkariScholarStorageDB] clearAllSyllabusFiles() failed:', err);
  }
}

/**
 * Converts a `Blob` or `File` to a Data URL string (`data:<mime>;base64,...`).
 */
export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to read Blob as Data URL.'));
      }
    };
    reader.onerror = () => reject(new Error('FileReader error while reading Blob.'));
    reader.readAsDataURL(blob);
  });
}

/**
 * Client-Side Image Compression Pipeline:
 * - If the uploaded file is an image (PNG, JPG, WebP):
 *   1. Draws it onto an in-memory HTML5 `<canvas>`.
 *   2. Scales down proportionally so max width or height does not exceed `1280px` (preserving aspect ratio).
 *   3. Exports as compressed `image/webp` at `0.75` quality (or `image/jpeg` fallback if WebP canvas encoding is unsupported),
 *      reducing 5MB+ screenshots to ~100KB–220KB without losing OCR legibility for syllabus tables.
 * - If the file is a PDF (`application/pdf`), preserves the raw `Blob` directly for IndexedDB storage.
 */
export async function compressSyllabusAsset(
  file: File,
  maxDimension = 1280,
  quality = 0.75
): Promise<CompressedSyllabusAsset> {
  const isPdf =
    file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');

  if (isPdf || !file.type.startsWith('image/')) {
    const dataUrl = await blobToDataUrl(file);
    const commaIdx = dataUrl.indexOf(',');
    const base64Data = commaIdx >= 0 ? dataUrl.slice(commaIdx + 1) : dataUrl;
    const mimeType = file.type || (isPdf ? 'application/pdf' : 'image/png');
    return {
      blob: file,
      base64Data,
      dataUrl,
      mimeType,
      sizeBytes: file.size,
      sizeLabel: formatByteSizeLabel(file.size),
    };
  }

  return new Promise<CompressedSyllabusAsset>((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = async () => {
      try {
        URL.revokeObjectURL(objectUrl);

        let targetWidth = img.naturalWidth || img.width;
        let targetHeight = img.naturalHeight || img.height;

        if (targetWidth > maxDimension || targetHeight > maxDimension) {
          if (targetWidth >= targetHeight) {
            targetHeight = Math.max(1, Math.round((targetHeight * maxDimension) / targetWidth));
            targetWidth = maxDimension;
          } else {
            targetWidth = Math.max(1, Math.round((targetWidth * maxDimension) / targetHeight));
            targetHeight = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = targetWidth;
        canvas.height = targetHeight;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          throw new Error('2D Canvas context unavailable');
        }

        // Fill white background for transparent PNGs so OCR text contrast remains sharp
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, targetWidth, targetHeight);
        ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

        // Try WebP first, fallback to JPEG if browser does not encode WebP
        let outputMime = 'image/webp';
        let dataUrl = canvas.toDataURL(outputMime, quality);
        if (!dataUrl.startsWith('data:image/webp')) {
          outputMime = 'image/jpeg';
          dataUrl = canvas.toDataURL(outputMime, quality);
        }

        const commaIdx = dataUrl.indexOf(',');
        const base64Data = commaIdx >= 0 ? dataUrl.slice(commaIdx + 1) : dataUrl;

        const compressedBlob = await new Promise<Blob>((blobResolve) => {
          canvas.toBlob(
            (b) => {
              if (b) {
                blobResolve(b);
              } else {
                // Fallback conversion from base64 if toBlob returns null
                const byteString = atob(base64Data);
                const ab = new ArrayBuffer(byteString.length);
                const ia = new Uint8Array(ab);
                for (let i = 0; i < byteString.length; i++) {
                  ia[i] = byteString.charCodeAt(i);
                }
                blobResolve(new Blob([ab], { type: outputMime }));
              }
            },
            outputMime,
            quality
          );
        });

        resolve({
          blob: compressedBlob,
          base64Data,
          dataUrl,
          mimeType: outputMime,
          sizeBytes: compressedBlob.size,
          sizeLabel: formatByteSizeLabel(compressedBlob.size),
        });
      } catch (err) {
        // Fallback to raw image if canvas fails
        try {
          const fallbackDataUrl = await blobToDataUrl(file);
          const commaIdx = fallbackDataUrl.indexOf(',');
          const base64Data = commaIdx >= 0 ? fallbackDataUrl.slice(commaIdx + 1) : fallbackDataUrl;
          resolve({
            blob: file,
            base64Data,
            dataUrl: fallbackDataUrl,
            mimeType: file.type || 'image/png',
            sizeBytes: file.size,
            sizeLabel: formatByteSizeLabel(file.size),
          });
        } catch (fallbackErr) {
          reject(fallbackErr ?? err);
        }
      }
    };

    img.onerror = async () => {
      URL.revokeObjectURL(objectUrl);
      try {
        const fallbackDataUrl = await blobToDataUrl(file);
        const commaIdx = fallbackDataUrl.indexOf(',');
        const base64Data = commaIdx >= 0 ? fallbackDataUrl.slice(commaIdx + 1) : fallbackDataUrl;
        resolve({
          blob: file,
          base64Data,
          dataUrl: fallbackDataUrl,
          mimeType: file.type || 'image/png',
          sizeBytes: file.size,
          sizeLabel: formatByteSizeLabel(file.size),
        });
      } catch (err) {
        reject(err);
      }
    };

    img.src = objectUrl;
  });
}

/**
 * Safe `localStorage.setItem` wrapper with `QuotaExceededError` protection.
 * Prevents unhandled storage exceptions from crashing React state transitions.
 */
export function safeLocalStorageSetItem(key: string, value: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch (err: unknown) {
    const isQuotaError =
      err instanceof DOMException &&
      (err.name === 'QuotaExceededError' ||
        err.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
        err.code === 22 ||
        err.code === 1014);

    if (isQuotaError) {
      console.warn(
        `[StorageGuard] QuotaExceededError caught while writing key "${key}". Heavy files are stored in IndexedDB (AkariScholarStorageDB).`,
        err
      );
    } else {
      console.warn(`[StorageGuard] Failed to write localStorage key "${key}":`, err);
    }
    return false;
  }
}
