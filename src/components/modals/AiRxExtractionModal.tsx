import React, { useState } from 'react';
import {
  Sparkles,
  X,
  FileText,
  Camera,
  CheckCircle2,
  AlertTriangle,
  Pill,
  Loader2,
} from 'lucide-react';
import { Medication } from '../../types/pharmacy';
import { formatYMD } from '../../utils/pharmacyCalculations';

interface ExtractedRxData {
  patientName: string;
  phoneNumber: string | null;
  age: number | null;
  medications: { name: string; daysSupply: number }[];
  medicationNames?: string[];
  durationDays: number;
  nextRefillDate: string;
  clinicalNotes?: string;
}

interface AiRxExtractionModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: 'ar' | 'en';
  pharmacyName: string;
  onApplyToPatient: (data: {
    name: string;
    phone: string;
    age?: number;
    medications: Medication[];
    rxImageBase64?: string;
  }) => void;
  onShowToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export const AiRxExtractionModal: React.FC<AiRxExtractionModalProps> = ({
  isOpen,
  onClose,
  lang,
  onApplyToPatient,
  onShowToast,
}) => {
  const [mode, setMode] = useState<'text' | 'image'>('text');
  const [inputText, setInputText] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [extractedData, setExtractedData] = useState<ExtractedRxData | null>(null);
  const [warningMsg, setWarningMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleQuickPreset = (presetText: string) => {
    setInputText(presetText);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      onShowToast(lang === 'ar' ? 'يرجى اختيار ملف صورة صالح' : 'Please select an image file', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = event => {
      setSelectedImage(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleExtract = async () => {
    if (mode === 'text' && !inputText.trim()) {
      onShowToast(lang === 'ar' ? 'يرجى كتابة أو لصق نص الروشتة/الملاحظة' : 'Please enter prescription text', 'error');
      return;
    }
    if (mode === 'image' && !selectedImage) {
      onShowToast(lang === 'ar' ? 'يرجى رفع أو التقاط صورة للروشتة' : 'Please upload a prescription image', 'error');
      return;
    }

    setIsLoading(true);
    setWarningMsg(null);

    try {
      const todayDate = formatYMD(new Date());
      const response = await fetch('/api/ai/extract-rx', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: inputText.trim(),
          imageBase64: selectedImage,
          todayDate,
        }),
      });

      const json = await response.json();
      if (json.success && json.data) {
        setExtractedData(json.data);
        if (json.isFallback) {
          setWarningMsg(
            lang === 'ar'
              ? 'تم التحليل عبر المعالج السريري المحلي'
              : 'Processed with local clinical parser'
          );
        }
        onShowToast(
          lang === 'ar' ? 'تم استخراج وتصحيح بيانات الروشتة بنجاح' : 'Prescription extracted successfully',
          'success'
        );
      } else {
        throw new Error(json.error || 'Failed to extract');
      }
    } catch (err: any) {
      onShowToast(lang === 'ar' ? `خطأ أثناء الاستخراج: ${err.message}` : `Extraction error: ${err.message}`, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleApply = () => {
    if (!extractedData) return;

    const formattedMeds: Medication[] = (extractedData.medications || []).map((m, i) => ({
      id: `med-${Date.now()}-${i}`,
      name: m.name,
      lastDispenseDate: formatYMD(new Date()),
      daysSupply: m.daysSupply || extractedData.durationDays || 30,
      timing: 'morning',
      mealRelation: 'after_meal',
    }));

    onApplyToPatient({
      name: extractedData.patientName || 'مريض غير مسجل',
      phone: extractedData.phoneNumber || '',
      age: extractedData.age || undefined,
      medications: formattedMeds,
      rxImageBase64: mode === 'image' && selectedImage ? selectedImage : undefined,
    });

    onShowToast(
      lang === 'ar' ? 'تم نقل بيانات الروشتة وتطبيقها في الملف السريري' : 'Applied prescription to dossier',
      'success'
    );
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-[#FFFFFF] dark:bg-[#201f1e] border border-[#EDEBE9] dark:border-[#3b3a39] rounded-[4px] max-w-2xl w-full shadow-lg overflow-hidden flex flex-col max-h-[92vh] text-[#242424] dark:text-[#f3f2f1]">
        {/* Header */}
        <div className="p-4 bg-[#FAF9F8] dark:bg-[#2d2c2c] border-b border-[#EDEBE9] dark:border-[#3b3a39] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Sparkles className="w-5 h-5 text-[#0078D4] dark:text-[#2899f5]" />
            <div>
              <div className="font-semibold text-sm sm:text-base text-[#242424] dark:text-[#f3f2f1] flex items-center gap-2">
                <span>{lang === 'ar' ? 'المساعد الذكي لاستخراج وتصحيح الروشتات' : 'AI Prescription Extraction & Standardizer'}</span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-[4px] text-[#605E5C] dark:text-[#a19f9d] hover:text-[#242424] dark:hover:text-[#f3f2f1] hover:bg-[#EDEBE9] dark:hover:bg-[#3b3a39] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs">
          {/* Tabs: Text vs Image */}
          <div className="flex items-center gap-2 p-1 bg-[#FAF9F8] dark:bg-[#2d2c2c] rounded-[4px] border border-[#EDEBE9] dark:border-[#3b3a39]">
            <button
              type="button"
              onClick={() => setMode('text')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-[4px] font-semibold transition-all cursor-pointer ${
                mode === 'text'
                  ? 'bg-[#EFF6FC] dark:bg-[#112338] text-[#0078D4] dark:text-[#2899f5] border border-[#C7E0F4] dark:border-[#1e4a6f]'
                  : 'bg-[#FFFFFF] dark:bg-[#201f1e] text-[#605E5C] dark:text-[#a19f9d] border border-[#EDEBE9] dark:border-[#3b3a39] hover:bg-[#F3F2F1] dark:hover:bg-[#3b3a39]'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>{lang === 'ar' ? 'إدخال نص / رسالة' : 'Text / WhatsApp Input'}</span>
            </button>
            <button
              type="button"
              onClick={() => setMode('image')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-[4px] font-semibold transition-all cursor-pointer ${
                mode === 'image'
                  ? 'bg-[#EFF6FC] dark:bg-[#112338] text-[#0078D4] dark:text-[#2899f5] border border-[#C7E0F4] dark:border-[#1e4a6f]'
                  : 'bg-[#FFFFFF] dark:bg-[#201f1e] text-[#605E5C] dark:text-[#a19f9d] border border-[#EDEBE9] dark:border-[#3b3a39] hover:bg-[#F3F2F1] dark:hover:bg-[#3b3a39]'
              }`}
            >
              <Camera className="w-4 h-4" />
              <span>{lang === 'ar' ? 'صورة روشتة' : 'Prescription Photo'}</span>
            </button>
          </div>

          {/* Mode: Text Input */}
          {mode === 'text' && (
            <div className="space-y-2">
              <label className="font-semibold text-[#242424] dark:text-[#f3f2f1] block">
                {lang === 'ar'
                  ? 'اكتب أو الصق نص الروشتة أو رسالة المريض:'
                  : 'Type or paste prescription text or patient note:'}
              </label>
              <textarea
                rows={3}
                value={inputText}
                onChange={e => setInputText(e.target.value)}
                placeholder={
                  lang === 'ar'
                    ? 'مثال: أبو أحمد علي كاظم عمره 58 سنة، رقم 07701234567، ياخذ كلوكوفيج الف وكنكور 5 وكريستور 20 لمدة شهر'
                    : 'e.g. Ali Kadhim, age 58, 07701234567, taking Glucophage 1000mg, Concor 5mg, Crestor 20mg for 30 days'
                }
                className="w-full bg-[#FFFFFF] dark:bg-[#252423] border border-[#EDEBE9] dark:border-[#3b3a39] rounded-[4px] p-2.5 text-[#242424] dark:text-[#f3f2f1] text-xs outline-none focus:border-[#0078D4] dark:focus:border-[#2899f5] leading-relaxed font-sans"
              />

              <div className="flex items-center gap-1.5 flex-wrap pt-1">
                <span className="text-[11px] text-[#605E5C] dark:text-[#a19f9d]">{lang === 'ar' ? 'أمثلة سريعة للتجربة:' : 'Quick Presets:'}</span>
                <button
                  type="button"
                  onClick={() =>
                    handleQuickPreset('الحاج علي كاظم السعدي، عمره 62 سنة، هاتف 07701234567، ياخذ كلوكوفيج الف حبة بعد الأكل، وكنكور 5 حبة صباحاً، وكريستور ٢٠ لمدة 30 يوم')
                  }
                  className="px-2 py-0.5 rounded-[4px] bg-[#FAF9F8] dark:bg-[#2d2c2c] hover:bg-[#F3F2F1] dark:hover:bg-[#3b3a39] text-[#242424] dark:text-[#f3f2f1] text-[10px] border border-[#EDEBE9] dark:border-[#3b3a39] font-semibold transition-colors cursor-pointer"
                >
                  مثال 1: سكري وضغط وكولسترول
                </button>
              </div>
            </div>
          )}

          {/* Mode: Image Upload */}
          {mode === 'image' && (
            <div className="space-y-3">
              <div className="border border-[#EDEBE9] dark:border-[#3b3a39] hover:border-[#0078D4] dark:hover:border-[#2899f5] rounded-[4px] p-4 text-center cursor-pointer transition-colors relative bg-[#FAF9F8] dark:bg-[#2d2c2c]">
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleImageUpload}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                />
                <Camera className="w-7 h-7 text-[#0078D4] dark:text-[#2899f5] mx-auto mb-1.5" />
                <p className="font-semibold text-[#242424] dark:text-[#f3f2f1] text-xs">
                  {lang === 'ar' ? 'التقط صورة أو ارفع ملف الروشتة' : 'Take photo or upload prescription image'}
                </p>
              </div>

              {selectedImage && (
                <div className="relative border border-[#EDEBE9] dark:border-[#3b3a39] max-h-48 bg-[#FFFFFF] dark:bg-[#252423] rounded-[4px] flex items-center justify-center overflow-hidden">
                  <img src={selectedImage} alt="Uploaded Rx" className="max-h-48 object-contain" />
                  <button
                    type="button"
                    onClick={() => setSelectedImage(null)}
                    className="absolute top-2 right-2 p-1 bg-[#242424] text-white hover:bg-[#A80000] rounded-[4px] transition-colors cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Action Button: Extract */}
          <div className="pt-1">
            <button
              type="button"
              onClick={handleExtract}
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-[4px] bg-[#0078D4] hover:bg-[#106EBE] active:bg-[#005A9E] text-white font-semibold text-xs transition-all disabled:opacity-50 cursor-pointer border-0 shadow-none"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>{lang === 'ar' ? 'جاري الاستخراج...' : 'Analyzing...'}</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-white" />
                  <span>{lang === 'ar' ? 'استخراج وتصحيح البيانات بالذكاء الاصطناعي' : 'Extract & Standardize Regimen'}</span>
                </>
              )}
            </button>
          </div>

          {warningMsg && (
            <div className="p-2.5 rounded-[4px] bg-[#FFF4CE] dark:bg-[#3a3118] border border-[#FFE699] dark:border-[#6a5a20] text-[#7A5B00] dark:text-[#f3d370] text-[11px] flex items-center gap-2 font-mono">
              <AlertTriangle className="w-4 h-4 shrink-0 text-[#7A5B00] dark:text-[#f3d370]" />
              <span>{warningMsg}</span>
            </div>
          )}

          {/* Extracted Structured Card */}
          {extractedData && (
            <div className="p-3.5 rounded-[4px] bg-[#FFFFFF] dark:bg-[#201f1e] border border-[#EDEBE9] dark:border-[#3b3a39] space-y-3">
              <div className="flex items-center justify-between border-b border-[#EDEBE9] dark:border-[#3b3a39] pb-2">
                <div className="flex items-center gap-2 font-semibold text-[#0078D4] dark:text-[#2899f5] text-xs">
                  <CheckCircle2 className="w-4 h-4 text-[#0078D4] dark:text-[#2899f5]" />
                  <span>{lang === 'ar' ? 'البيانات المستخرجة بنجاح:' : 'Extracted Patient Profile:'}</span>
                </div>
                <span className="text-[10px] text-[#605E5C] dark:text-[#a19f9d] font-mono">
                  {lang === 'ar' ? `مدة الكورس: ${extractedData.durationDays} يوم` : `Supply: ${extractedData.durationDays} days`}
                </span>
              </div>

              {/* Patient Core Summary */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div className="p-2 rounded-[4px] bg-[#FAF9F8] dark:bg-[#2d2c2c] border border-[#EDEBE9] dark:border-[#3b3a39] space-y-0.5">
                  <div className="text-[10px] text-[#605E5C] dark:text-[#a19f9d]">
                    <span>{lang === 'ar' ? 'اسم المريض' : 'Patient Name'}</span>
                  </div>
                  <div className="font-semibold text-xs text-[#242424] dark:text-[#f3f2f1] truncate">
                    {extractedData.patientName}
                  </div>
                </div>

                <div className="p-2 rounded-[4px] bg-[#FAF9F8] dark:bg-[#2d2c2c] border border-[#EDEBE9] dark:border-[#3b3a39] space-y-0.5">
                  <div className="text-[10px] text-[#605E5C] dark:text-[#a19f9d]">
                    <span>{lang === 'ar' ? 'رقم الهاتف' : 'Phone'}</span>
                  </div>
                  <div className="font-mono font-semibold text-xs text-[#242424] dark:text-[#f3f2f1]">
                    {extractedData.phoneNumber || (lang === 'ar' ? 'غير متوفر' : 'N/A')}
                  </div>
                </div>

                <div className="p-2 rounded-[4px] bg-[#FAF9F8] dark:bg-[#2d2c2c] border border-[#EDEBE9] dark:border-[#3b3a39] space-y-0.5">
                  <div className="text-[10px] text-[#605E5C] dark:text-[#a19f9d]">
                    <span>{lang === 'ar' ? 'تاريخ التكرار المستحق' : 'Next Refill Due'}</span>
                  </div>
                  <div className="font-mono font-semibold text-xs text-[#242424] dark:text-[#f3f2f1]">
                    {extractedData.nextRefillDate}
                  </div>
                </div>
              </div>

              {/* Standardized Medication List */}
              <div className="space-y-1.5">
                <div className="text-[11px] font-semibold text-[#242424] dark:text-[#f3f2f1] flex items-center gap-1.5">
                  <Pill className="w-3.5 h-3.5 text-[#0078D4] dark:text-[#2899f5]" />
                  <span>{lang === 'ar' ? 'الأدوية المقررة والمصححة:' : 'Standardized Regimen:'}</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {extractedData.medications.map((m, idx) => (
                    <div
                      key={idx}
                      className="p-2 rounded-[4px] bg-[#FAF9F8] dark:bg-[#2d2c2c] border border-[#EDEBE9] dark:border-[#3b3a39] flex items-center justify-between gap-2"
                    >
                      <div className="font-semibold text-xs text-[#242424] dark:text-[#f3f2f1] flex items-center gap-1.5 truncate">
                        <span className="truncate">{m.name}</span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0 font-mono text-[11px] text-[#605E5C] dark:text-[#a19f9d]">
                        <span>{m.daysSupply} d</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-[#FAF9F8] dark:bg-[#2d2c2c] border-t border-[#EDEBE9] dark:border-[#3b3a39] flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-[4px] bg-[#FFFFFF] dark:bg-[#252423] hover:bg-[#F3F2F1] dark:hover:bg-[#3b3a39] text-[#242424] dark:text-[#f3f2f1] text-xs font-semibold border border-[#EDEBE9] dark:border-[#3b3a39] transition-colors cursor-pointer"
          >
            {lang === 'ar' ? 'إغلاق' : 'Close'}
          </button>

          {extractedData && (
            <button
              type="button"
              onClick={handleApply}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-[4px] bg-[#0078D4] hover:bg-[#106EBE] active:bg-[#005A9E] text-white font-semibold text-xs transition-all cursor-pointer border-0 shadow-none"
            >
              <CheckCircle2 className="w-4 h-4 text-white" />
              <span>{lang === 'ar' ? 'تطبيق وتعبئة الملف السريري فوراً' : 'Apply to Clinical Dossier'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
