import React from 'react';
import {
  AlertTriangle,
  Trash2,
  Cloud,
  X,
  RefreshCw,
  Info,
} from 'lucide-react';

interface ResetDatabaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  isGoogleSheetConnected: boolean;
  gasUrl?: string;
  patientCount: number;
  followUpCount: number;
  lang: 'ar' | 'en';
  isResetting: boolean;
  onConfirmReset: (includeCloud: boolean) => void;
}

export const ResetDatabaseModal: React.FC<ResetDatabaseModalProps> = ({
  isOpen,
  onClose,
  isGoogleSheetConnected,
  patientCount,
  followUpCount,
  lang,
  isResetting,
  onConfirmReset,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#FFFFFF] dark:bg-[#201f1e] border border-[#E0A8A8] dark:border-[#3b3a39] rounded-[4px] w-full max-w-lg shadow-lg overflow-hidden text-[#242424] dark:text-[#f3f2f1]">
        {/* Header */}
        <div className="p-4 border-b border-[#EDEBE9] dark:border-[#3b3a39] flex items-center justify-between bg-[#FAF9F8] dark:bg-[#2d2c2c]">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-[#A80000] dark:text-[#f1707b]" />
            <div>
              <h2 className="font-semibold text-sm text-[#242424] dark:text-[#f3f2f1] flex items-center gap-2">
                <span>{lang === 'ar' ? 'تفريغ قاعدة البيانات وحذف السجلات' : 'Reset & Empty Database'}</span>
              </h2>
              <div className="text-[11px] text-[#605E5C] dark:text-[#a19f9d] mt-0.5 font-mono">
                {lang === 'ar'
                  ? `السجلات الحالية: ${patientCount} مريض • ${followUpCount} متابعة سريرية`
                  : `Current Data: ${patientCount} patients • ${followUpCount} follow-ups`}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isResetting}
            className="p-1 text-[#605E5C] dark:text-[#a19f9d] hover:text-[#242424] dark:hover:text-[#f3f2f1] hover:bg-[#EDEBE9] dark:hover:bg-[#3b3a39] rounded-[4px] transition-colors disabled:opacity-50 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-5 space-y-4 text-xs">
          <p className="text-[#242424] dark:text-[#f3f2f1] leading-relaxed">
            {lang === 'ar'
              ? 'هل ترغب في تفريغ قاعدة البيانات والبدء بحساب نظيف تماماً بدون أية سجلات سابقة؟'
              : 'Do you want to clear all records and start with a completely empty database?'}
          </p>

          {isGoogleSheetConnected ? (
            <div className="p-3.5 rounded-[4px] bg-[#FDF3F3] dark:bg-[#3a1d1d] border border-[#E0A8A8] dark:border-[#6e3535] space-y-2">
              <div className="flex items-center gap-2 text-[#A80000] dark:text-[#f1707b] font-semibold text-xs">
                <Cloud className="w-4 h-4 text-[#A80000] dark:text-[#f1707b] shrink-0" />
                <span>{lang === 'ar' ? 'تنبيه المزامنة السحابية (Google Sheet متصل)' : 'Cloud Sync Alert (Google Sheet Linked)'}</span>
              </div>
              <p className="text-[#605E5C] dark:text-[#a19f9d] text-[11px] leading-relaxed">
                {lang === 'ar'
                  ? 'الموقع مربوط حالياً بشيت Google Sheet. إذا قمت بمسح الموقع فقط دون تفريغ الشيت، فستتم استعادة البيانات السابقة تلقائياً بمجرد الضغط على زر المزامنة.'
                  : 'The app is linked to Google Sheet. Clearing website only will restore data on next sync.'}
              </p>
            </div>
          ) : (
            <div className="p-3 rounded-[4px] bg-[#FAF9F8] dark:bg-[#2d2c2c] border border-[#EDEBE9] dark:border-[#3b3a39] text-[11px] text-[#605E5C] dark:text-[#a19f9d] flex items-start gap-2.5">
              <Info className="w-4 h-4 text-[#0078D4] dark:text-[#2899f5] shrink-0 mt-0.5" />
              <span>
                {lang === 'ar'
                  ? 'سيتم مسح كافة بيانات المرضى، المتابعات، وقوائم العلاج من الذاكرة المحلية للمتصفح وتفريغ الموقع تماماً.'
                  : 'All patient profiles, refills, and clinical follow-ups will be cleared from local storage.'}
              </span>
            </div>
          )}

          {/* Action Choices */}
          <div className="space-y-2.5 pt-1">
            {isGoogleSheetConnected ? (
              <>
                <button
                  type="button"
                  onClick={() => onConfirmReset(true)}
                  disabled={isResetting}
                  className="w-full text-right p-3 rounded-[4px] bg-[#A80000] hover:bg-[#8B0000] text-white font-semibold transition-all border-0 flex items-start gap-3 disabled:opacity-60 cursor-pointer shadow-none"
                >
                  <Trash2 className="w-4 h-4 shrink-0 mt-0.5 text-white" />
                  <div className="flex-1">
                    <div className="text-xs font-semibold">
                      <span>{lang === 'ar' ? 'تفريغ شامل (الموقع + Google Sheet)' : 'Full Reset (Website + Google Sheet)'}</span>
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => onConfirmReset(false)}
                  disabled={isResetting}
                  className="w-full text-right p-3 rounded-[4px] bg-[#FFFFFF] dark:bg-[#252423] hover:bg-[#F3F2F1] dark:hover:bg-[#3b3a39] text-[#242424] dark:text-[#f3f2f1] border border-[#EDEBE9] dark:border-[#3b3a39] transition-all flex items-start gap-3 disabled:opacity-60 cursor-pointer"
                >
                  <div className="flex-1">
                    <div className="text-xs font-semibold text-[#242424] dark:text-[#f3f2f1]">
                      {lang === 'ar' ? 'تفريغ الموقع فقط (محلياً)' : 'Clear Website Only (Local)'}
                    </div>
                  </div>
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => onConfirmReset(false)}
                disabled={isResetting}
                className="w-full py-2.5 px-4 rounded-[4px] bg-[#A80000] hover:bg-[#8B0000] text-white font-semibold text-xs flex items-center justify-center gap-2 transition-colors disabled:opacity-60 cursor-pointer border-0 shadow-none"
              >
                {isResetting ? (
                  <RefreshCw className="w-4 h-4 animate-spin text-white" />
                ) : (
                  <Trash2 className="w-4 h-4 text-white" />
                )}
                <span>{lang === 'ar' ? 'تأكيد تفريغ كافة بيانات الموقع' : 'Confirm Empty Database'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 bg-[#FAF9F8] dark:bg-[#2d2c2c] border-t border-[#EDEBE9] dark:border-[#3b3a39] flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={isResetting}
            className="px-3.5 py-1.5 rounded-[4px] bg-[#FFFFFF] dark:bg-[#252423] hover:bg-[#F3F2F1] dark:hover:bg-[#3b3a39] text-[#242424] dark:text-[#f3f2f1] text-xs font-semibold border border-[#EDEBE9] dark:border-[#3b3a39] transition-colors disabled:opacity-50 cursor-pointer"
          >
            {lang === 'ar' ? 'إلغاء وتراجع' : 'Cancel'}
          </button>
        </div>
      </div>
    </div>
  );
};
