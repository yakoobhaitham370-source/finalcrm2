import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  ZoomIn,
  ZoomOut,
  RotateCw,
  RotateCcw,
  Download,
  FileText,
  Loader2,
  AlertCircle,
  Upload,
} from 'lucide-react';
import { LabScan } from '../../types/pharmacy';
import { getScanImage, saveScanImage } from '../../utils/scanStorage';
import { compressMedicalImage } from '../../utils/imageCompressor';
import { uploadScanImageToDrive } from '../../services/apiService';

interface ImagePreviewModalProps {
  scan: LabScan | null;
  patientName?: string;
  patientId?: string;
  gasUrl?: string;
  lang: 'ar' | 'en';
  onClose: () => void;
  onDelete?: (scanId: string) => void;
  onUpdateScan?: (updatedScan: LabScan) => void;
}

export const ImagePreviewModal: React.FC<ImagePreviewModalProps> = ({
  scan,
  patientName,
  patientId,
  gasUrl,
  lang,
  onClose,
  onUpdateScan,
}) => {
  const [currentScan, setCurrentScan] = useState<LabScan | null>(scan);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [isFullscreen] = useState(false);
  const [imageSrc, setImageSrc] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [isReuploading, setIsReuploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setCurrentScan(scan);
  }, [scan]);

  useEffect(() => {
    setZoom(1);
    setRotation(0);
    setHasError(false);
    setIsLoading(true);

    let isMounted = true;

    const resolveImageSource = async () => {
      if (!currentScan) return;

      if (currentScan.dataUrl && currentScan.dataUrl.length > 50) {
        if (isMounted) {
          setImageSrc(currentScan.dataUrl);
          setIsLoading(false);
        }
        return;
      }

      if (currentScan.id) {
        try {
          const cached = await getScanImage(currentScan.id);
          if (isMounted && cached && cached.length > 50) {
            setImageSrc(cached);
            setIsLoading(false);
            return;
          }
        } catch (e) {
          console.warn('IndexedDB resolve error:', e);
        }
      }

      let extractedId = currentScan.fileId;
      if (!extractedId && currentScan.driveUrl) {
        const match = currentScan.driveUrl.match(/\/d\/([a-zA-Z0-9_-]+)/) ||
                      currentScan.driveUrl.match(/id=([a-zA-Z0-9_-]+)/);
        if (match && match[1]) {
          extractedId = match[1];
        }
      }

      if (currentScan.previewUrl) {
        if (isMounted) {
          setImageSrc(currentScan.previewUrl);
          setIsLoading(false);
        }
        return;
      }

      if (extractedId) {
        if (isMounted) {
          setImageSrc(`https://lh3.googleusercontent.com/d/${extractedId}`);
          setIsLoading(false);
        }
        return;
      }

      if (currentScan.driveUrl) {
        if (isMounted) {
          setImageSrc(currentScan.driveUrl);
          setIsLoading(false);
        }
        return;
      }

      if (isMounted) {
        setImageSrc('');
        setIsLoading(false);
        setHasError(true);
      }
    };

    resolveImageSource();

    return () => {
      isMounted = false;
    };
  }, [currentScan]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === '+' || e.key === '=') setZoom(z => Math.min(z + 0.25, 4));
      if (e.key === '-') setZoom(z => Math.max(z - 0.25, 0.5));
      if (e.key === 'r' || e.key === 'R') setRotation(r => (r + 90) % 360);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!currentScan) return null;

  const handleZoomIn = () => setZoom(z => Math.min(z + 0.25, 4));
  const handleZoomOut = () => setZoom(z => Math.max(z - 0.25, 0.5));
  const handleResetZoom = () => {
    setZoom(1);
    setRotation(0);
  };
  const handleRotateCw = () => setRotation(r => (r + 90) % 360);
  const handleRotateCcw = () => setRotation(r => (r - 90 + 360) % 360);

  const handleDownload = () => {
    if (!imageSrc) return;
    const a = document.createElement('a');
    a.href = imageSrc;
    a.download = `${patientName || 'Patient'}_${currentScan.title || 'scan'}_${currentScan.date}.jpg`.replace(/\s+/g, '_');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleImageError = () => {
    let fileId = currentScan.fileId;
    if (!fileId && currentScan.driveUrl) {
      const match = currentScan.driveUrl.match(/\/d\/([a-zA-Z0-9_-]+)/) ||
                    currentScan.driveUrl.match(/id=([a-zA-Z0-9_-]+)/);
      if (match && match[1]) fileId = match[1];
    }

    if (fileId && !imageSrc.includes('thumbnail')) {
      setImageSrc(`https://drive.google.com/thumbnail?id=${fileId}&sz=w2000`);
    } else if (fileId && !imageSrc.includes('export=view')) {
      setImageSrc(`https://drive.google.com/uc?export=view&id=${fileId}`);
    } else {
      setHasError(true);
    }
  };

  const handleFileAttach = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsReuploading(true);
    try {
      const compressed = await compressMedicalImage(file, 1600, 0.82);
      const base64 = compressed.base64;
      const targetId = currentScan.id || 'scan-' + Date.now();
      const fileSizeStr = compressed.fileSizeStr;

      await saveScanImage(targetId, base64, {
        title: file.name,
        patientId: patientId || 'Patient',
        size: fileSizeStr,
      });

      let updated: LabScan = {
        ...currentScan,
        id: targetId,
        title: file.name,
        dataUrl: base64,
        fileSize: fileSizeStr,
        uploadStatus: gasUrl ? 'uploading' : 'local_only',
      };

      setCurrentScan(updated);
      setImageSrc(base64);
      setHasError(false);
      setIsLoading(false);

      if (onUpdateScan) {
        onUpdateScan(updated);
      }

      if (gasUrl) {
        try {
          const driveRes = await uploadScanImageToDrive(
            gasUrl,
            patientId || patientName || 'Patient',
            file.name,
            base64
          );

          if (driveRes && (driveRes.success || driveRes.fileUrl)) {
            updated = {
              ...updated,
              driveUrl: driveRes.fileUrl,
              previewUrl: driveRes.previewUrl || driveRes.fileUrl,
              thumbnailUrl: driveRes.thumbnailUrl,
              fileId: driveRes.fileId,
              uploadStatus: 'saved_to_drive',
            };
            setCurrentScan(updated);
            if (onUpdateScan) {
              onUpdateScan(updated);
            }
          }
        } catch (driveErr) {
          console.warn('Google Drive scan re-upload error:', driveErr);
        }
      }
    } catch (err) {
      console.error('Failed to attach image:', err);
    } finally {
      setIsReuploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 md:p-4 bg-black/40 backdrop-blur-sm select-none">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileAttach}
      />

      <div className={`bg-[#FFFFFF] dark:bg-[#201f1e] border border-[#EDEBE9] dark:border-[#3b3a39] rounded-[4px] shadow-lg overflow-hidden flex flex-col transition-all duration-200 text-[#242424] dark:text-[#f3f2f1] ${
        isFullscreen ? 'w-full h-full' : 'max-w-5xl w-full h-[90vh]'
      }`}>
        {/* Top bar */}
        <div className="p-3 bg-[#FAF9F8] dark:bg-[#2d2c2c] border-b border-[#EDEBE9] dark:border-[#3b3a39] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <FileText className="w-5 h-5 text-[#0078D4] dark:text-[#2899f5] shrink-0" />
            <div className="min-w-0">
              <div className="font-semibold text-sm truncate flex items-center gap-2 text-[#242424] dark:text-[#f3f2f1]">
                <span>{currentScan.title || (lang === 'ar' ? 'معاينة الصورة الأصلية' : 'Full Resolution Preview')}</span>
              </div>
            </div>
          </div>

          {/* Control Toolbar */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isReuploading}
              title={lang === 'ar' ? 'إرفاق أو استبدال ملف الصورة' : 'Attach or Replace Image File'}
              className="p-1.5 rounded-[4px] bg-[#FFFFFF] dark:bg-[#252423] hover:bg-[#F3F2F1] dark:hover:bg-[#3b3a39] text-[#242424] dark:text-[#f3f2f1] border border-[#EDEBE9] dark:border-[#3b3a39] transition-colors flex items-center gap-1.5 text-xs font-semibold cursor-pointer"
            >
              {isReuploading ? (
                <Loader2 className="w-4 h-4 animate-spin text-[#0078D4] dark:text-[#2899f5]" />
              ) : (
                <Upload className="w-4 h-4 text-[#0078D4] dark:text-[#2899f5]" />
              )}
              <span className="hidden sm:inline">
                {lang === 'ar' ? 'إرفاق / تغيير' : 'Attach / Replace'}
              </span>
            </button>

            {/* Zoom Controls */}
            <div className="bg-[#FFFFFF] dark:bg-[#252423] border border-[#EDEBE9] dark:border-[#3b3a39] rounded-[4px] p-0.5 flex items-center gap-0.5">
              <button
                type="button"
                onClick={handleZoomOut}
                className="p-1 hover:bg-[#F3F2F1] dark:hover:bg-[#3b3a39] text-[#242424] dark:text-[#f3f2f1] rounded-[2px] transition-colors cursor-pointer"
              >
                <ZoomOut className="w-4 h-4 text-[#605E5C] dark:text-[#a19f9d]" />
              </button>
              <button
                type="button"
                onClick={handleResetZoom}
                className="px-2 py-0.5 text-[11px] font-mono font-semibold text-[#242424] dark:text-[#f3f2f1] hover:bg-[#F3F2F1] dark:hover:bg-[#3b3a39] rounded-[2px] transition-colors cursor-pointer"
              >
                {Math.round(zoom * 100)}%
              </button>
              <button
                type="button"
                onClick={handleZoomIn}
                className="p-1 hover:bg-[#F3F2F1] dark:hover:bg-[#3b3a39] text-[#242424] dark:text-[#f3f2f1] rounded-[2px] transition-colors cursor-pointer"
              >
                <ZoomIn className="w-4 h-4 text-[#605E5C] dark:text-[#a19f9d]" />
              </button>
            </div>

            {/* Rotation Controls */}
            <div className="bg-[#FFFFFF] dark:bg-[#252423] border border-[#EDEBE9] dark:border-[#3b3a39] rounded-[4px] p-0.5 flex items-center gap-0.5">
              <button
                type="button"
                onClick={handleRotateCcw}
                className="p-1 hover:bg-[#F3F2F1] dark:hover:bg-[#3b3a39] text-[#242424] dark:text-[#f3f2f1] rounded-[2px] transition-colors cursor-pointer"
              >
                <RotateCcw className="w-4 h-4 text-[#605E5C] dark:text-[#a19f9d]" />
              </button>
              <button
                type="button"
                onClick={handleRotateCw}
                className="p-1 hover:bg-[#F3F2F1] dark:hover:bg-[#3b3a39] text-[#242424] dark:text-[#f3f2f1] rounded-[2px] transition-colors cursor-pointer"
              >
                <RotateCw className="w-4 h-4 text-[#605E5C] dark:text-[#a19f9d]" />
              </button>
            </div>

            {imageSrc && !hasError && (
              <button
                type="button"
                onClick={handleDownload}
                className="px-3 py-1.5 rounded-[4px] bg-[#0078D4] hover:bg-[#106EBE] active:bg-[#005A9E] text-white transition-colors flex items-center gap-1.5 text-xs font-semibold cursor-pointer border-0 shadow-none"
              >
                <Download className="w-4 h-4 text-white" />
                <span className="hidden sm:inline">{lang === 'ar' ? 'تحميل الأصل' : 'Download'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-[4px] bg-[#FFFFFF] dark:bg-[#252423] hover:bg-[#F3F2F1] dark:hover:bg-[#3b3a39] text-[#605E5C] dark:text-[#a19f9d] hover:text-[#242424] dark:hover:text-[#f3f2f1] border border-[#EDEBE9] dark:border-[#3b3a39] transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Viewport Area */}
        <div className="flex-1 overflow-auto bg-[#FAF9F8] dark:bg-[#11100f] relative flex items-center justify-center p-4 min-h-[300px]">
          {isLoading ? (
            <div className="text-center text-[#605E5C] dark:text-[#a19f9d] text-xs flex flex-col items-center gap-3">
              <Loader2 className="w-8 h-8 text-[#0078D4] dark:text-[#2899f5] animate-spin" />
              <span>{lang === 'ar' ? 'جارِ جلب وتحميل الصورة...' : 'Loading image...'}</span>
            </div>
          ) : imageSrc && !hasError ? (
            <div
              className="transition-transform duration-150 ease-out flex items-center justify-center max-w-full max-h-full"
              style={{
                transform: `scale(${zoom}) rotate(${rotation}deg)`,
                transformOrigin: 'center center',
              }}
            >
              <img
                src={imageSrc}
                alt={currentScan.title || 'Medical Scan'}
                onError={handleImageError}
                className="max-w-full max-h-[78vh] object-contain border border-[#EDEBE9] dark:border-[#3b3a39] rounded-[4px] bg-white dark:bg-[#201f1e]"
              />
            </div>
          ) : (
            <div className="text-center text-[#605E5C] dark:text-[#a19f9d] text-xs space-y-4 max-w-md p-6 bg-[#FFFFFF] dark:bg-[#201f1e] border border-[#EDEBE9] dark:border-[#3b3a39] rounded-[4px]">
              <AlertCircle className="w-8 h-8 text-[#A80000] dark:text-[#f1707b] mx-auto" />
              <div className="font-semibold text-[#242424] dark:text-[#f3f2f1] text-base">
                {lang === 'ar' ? 'تعذر عرض الصورة الأصلية' : 'Image Unavailable'}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
