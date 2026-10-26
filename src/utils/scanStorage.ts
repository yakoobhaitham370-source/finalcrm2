/**
 * IndexedDB storage engine for Full-Resolution Prescriptions & Lab Scans
 * Overcomes browser localStorage 5MB limit by storing full-resolution images
 * safely in client-side IndexedDB (capable of storing GBs of high-res files).
 */

const DB_NAME = 'pharmpulse_scans_db';
const STORE_NAME = 'scans_store';
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

function getDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB not supported in this environment'));
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = event => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });

  return dbPromise;
}

/**
 * Save full-resolution image data URL to IndexedDB
 */
export async function saveScanImage(scanId: string, dataUrl: string, metadata?: any): Promise<boolean> {
  if (!scanId || !dataUrl) return false;
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const record = {
        id: scanId,
        dataUrl,
        metadata: metadata || {},
        updatedAt: Date.now(),
      };
      const req = store.put(record);
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('Failed to save scan to IndexedDB:', err);
    return false;
  }
}

/**
 * Retrieve full-resolution image data URL by scanId from IndexedDB
 */
export async function getScanImage(scanId: string): Promise<string | null> {
  if (!scanId) return null;
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(scanId);
      req.onsuccess = () => {
        if (req.result && req.result.dataUrl) {
          resolve(req.result.dataUrl);
        } else {
          resolve(null);
        }
      };
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('Failed to get scan from IndexedDB:', err);
    return null;
  }
}

/**
 * Delete a scan image from IndexedDB
 */
export async function deleteScanImage(scanId: string): Promise<boolean> {
  if (!scanId) return false;
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(scanId);
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('Failed to delete scan from IndexedDB:', err);
    return false;
  }
}

/**
 * Helper to hydrate patient scans with full-resolution dataUrl from IndexedDB
 */
export async function enrichPatientScans(patient: any): Promise<any> {
  if (!patient || !patient.scans || !Array.isArray(patient.scans)) return patient;

  const enrichedScans = await Promise.all(
    patient.scans.map(async (s: any) => {
      if (s.dataUrl && s.dataUrl.length > 50) {
        // Already has in-memory dataUrl, ensure it's also saved to IndexedDB
        if (s.id) saveScanImage(s.id, s.dataUrl, { title: s.title });
        return s;
      }

      // Try to load from IndexedDB
      if (s.id) {
        const cached = await getScanImage(s.id);
        if (cached) {
          return { ...s, dataUrl: cached };
        }
      }

      return s;
    })
  );

  return { ...patient, scans: enrichedScans };
}
