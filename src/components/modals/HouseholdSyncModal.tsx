import React, { useState, useMemo } from 'react';
import { Users, X, Check, MessageSquare } from 'lucide-react';
import { Patient, HouseholdMemberAlignment } from '../../types/pharmacy';
import { calculateDaysRemaining, formatYMD, parseLocalDate, formatPhoneForWhatsApp } from '../../utils/pharmacyCalculations';

interface HouseholdSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  familyTag: string;
  patients: Patient[];
  pharmacyName: string;
  lang: 'ar' | 'en';
  onApplyAlignment: (rows: HouseholdMemberAlignment[]) => void;
  onShowToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export const HouseholdSyncModal: React.FC<HouseholdSyncModalProps> = ({
  isOpen,
  onClose,
  familyTag,
  patients,
  pharmacyName,
  lang,
  onApplyAlignment,
  onShowToast,
}) => {
  const defaultTargetDate = useMemo(() => {
    const now = new Date();
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return formatYMD(nextMonth);
  }, []);

  const [targetDateStr, setTargetDateStr] = useState<string>(defaultTargetDate);
  const [draftMessage, setDraftMessage] = useState<string>('');

  const familyMembers = useMemo(() => {
    if (!familyTag) return [];
    return patients.filter(p => !p.isArchived && p.familyTag === familyTag);
  }, [patients, familyTag]);

  const computedRows = useMemo(() => {
    const rows: HouseholdMemberAlignment[] = [];
    const targetDate = parseLocalDate(targetDateStr);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const daysToTarget = Math.max(1, Math.ceil((targetDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));

    familyMembers.forEach(member => {
      (member.medications || []).forEach(med => {
        const remaining = calculateDaysRemaining(med.lastDispenseDate, med.daysSupply);
        const lastDate = parseLocalDate(med.lastDispenseDate);
        const currentExpiry = new Date(
          lastDate.getFullYear(),
          lastDate.getMonth(),
          lastDate.getDate() + (med.daysSupply || 30)
        );

        const neededTablets = Math.max(0, daysToTarget - Math.max(0, remaining));

        rows.push({
          patientId: member.id,
          patientName: member.name,
          phone: member.phone,
          medName: med.name,
          currentExpiry: formatYMD(currentExpiry),
          daysRemaining: remaining,
          neededTablets,
          targetDateStr,
        });
      });
    });

    return rows;
  }, [familyMembers, targetDateStr]);

  React.useEffect(() => {
    const lines = computedRows
      .filter(r => r.neededTablets > 0)
      .map(r => `• ${r.patientName}: ${r.medName} (${r.neededTablets} حبة لتوحيد الموعد)`);

    const msg = `مرحباً لكم، تحيات ${pharmacyName || 'الصيدلية السريرية'}.\nحرصاً منا على راحتكم وتوفير مشقة الزيارات المتكررة، قمنا بجدولة توحيد مواعيد صرف علاج أفراد عائلتكم الكريمة (${familyTag}) لتاريخ موحد: ${targetDateStr}.\n\nالكميات الإضافية المحسوبة لتزامن الصرف في رحلة واحدة:\n${lines.join('\n')}\n\nدمتم وعائلتكم بأتم الصحة والعافية.`;
    setDraftMessage(msg);
  }, [computedRows, familyTag, pharmacyName, targetDateStr]);

  if (!isOpen || !familyTag) return null;

  const handleApply = () => {
    onApplyAlignment(computedRows);
    onClose();
    onShowToast(
      lang === 'ar'
        ? `تم توحيد مواعيد صرف عائلة (${familyTag}) بنجاح حتى تاريخ ${targetDateStr}`
        : `Synchronized family (${familyTag}) until ${targetDateStr}`,
      'success'
    );
  };

  const handleSendWhatsApp = () => {
    if (computedRows.length === 0) return;
    const primaryPhone = computedRows[0].phone;
    const cleanPhone = formatPhoneForWhatsApp(primaryPhone);
    window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(draftMessage)}`, '_blank');
    onShowToast(lang === 'ar' ? 'تم فتح WhatsApp لإرسال رسالة العائلة الموحدة' : 'Opened WhatsApp for family sync message', 'success');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-[#FFFFFF] dark:bg-[#201f1e] border border-[#EDEBE9] dark:border-[#3b3a39] rounded-[4px] max-w-xl w-full shadow-lg overflow-hidden flex flex-col max-h-[92vh] text-[#242424] dark:text-[#f3f2f1]">
        {/* Header */}
        <div className="p-3 bg-[#FAF9F8] dark:bg-[#2d2c2c] border-b border-[#EDEBE9] dark:border-[#3b3a39] flex items-center justify-between">
          <div className="font-semibold text-sm text-[#242424] dark:text-[#f3f2f1] flex items-center gap-2">
            <Users className="w-4 h-4 text-[#0078D4] dark:text-[#2899f5]" />
            <span>{lang === 'ar' ? 'توحيد مواعيد صرف علاج العائلة' : 'Household Refill Synchronizer'}</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-[4px] text-[#605E5C] dark:text-[#a19f9d] hover:text-[#242424] dark:hover:text-[#f3f2f1] hover:bg-[#EDEBE9] dark:hover:bg-[#3b3a39] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-3 space-y-3 text-xs overflow-y-auto">
          <div className="bg-[#FFFFFF] dark:bg-[#252423] border border-[#EDEBE9] dark:border-[#3b3a39] p-2.5 rounded-[4px] space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-xs text-[#242424] dark:text-[#f3f2f1]">
                {lang === 'ar' ? 'العائلة المستهدفة:' : 'Family Tag:'} <span className="text-[#0078D4]">{familyTag}</span>
              </span>
              <span className="text-[#605E5C] dark:text-[#a19f9d] font-mono text-[11px]">
                {familyMembers.length} {lang === 'ar' ? 'أفراد مسجلون' : 'members'}
              </span>
            </div>

            <div className="pt-1 flex flex-wrap items-center justify-between gap-2 border-t border-[#EDEBE9] dark:border-[#3b3a39]">
              <label className="font-semibold text-[11px] text-[#242424] dark:text-[#f3f2f1]">
                {lang === 'ar' ? 'تاريخ الاستحقاق الموحد:' : 'Target Synchronized Date:'}
              </label>
              <input
                type="date"
                value={targetDateStr}
                onChange={e => setTargetDateStr(e.target.value)}
                className="bg-[#FFFFFF] dark:bg-[#201f1e] border border-[#EDEBE9] dark:border-[#3b3a39] text-[#242424] dark:text-[#f3f2f1] px-2 py-1 rounded-[4px] text-xs outline-none focus:border-[#0078D4] dark:focus:border-[#2899f5] font-mono"
              />
            </div>
          </div>

          {/* Members Table */}
          <div className="border border-[#EDEBE9] dark:border-[#3b3a39] rounded-[4px] overflow-x-auto">
            <table className="w-full text-right dir-rtl text-xs border-collapse min-w-[400px]">
              <thead className="bg-[#FAF9F8] dark:bg-[#2d2c2c] text-[#242424] dark:text-[#f3f2f1] border-b border-[#EDEBE9] dark:border-[#3b3a39]">
                <tr>
                  <th className="py-1.5 px-2 text-[10px] uppercase tracking-wider">{lang === 'ar' ? 'فرد العائلة' : 'Member'}</th>
                  <th className="py-1.5 px-2 text-[10px] uppercase tracking-wider">{lang === 'ar' ? 'الدواء المزمن' : 'Medication'}</th>
                  <th className="py-1.5 px-2 text-[10px] uppercase tracking-wider">{lang === 'ar' ? 'المتبقي' : 'Days Left'}</th>
                  <th className="py-1.5 px-2 text-[10px] uppercase tracking-wider">{lang === 'ar' ? 'حبات التوحيد' : 'Bridge Tabs'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EDEBE9] dark:divide-[#3b3a39] text-[#242424] dark:text-[#f3f2f1]">
                {computedRows.map((r, idx) => (
                  <tr key={idx} className="hover:bg-[#F3F2F1] dark:hover:bg-[#252423]">
                    <td className="py-1.5 px-2 font-semibold text-[#242424] dark:text-[#f3f2f1] text-[11px]">{r.patientName}</td>
                    <td className="py-1.5 px-2 text-[#242424] dark:text-[#f3f2f1] text-[11px]">{r.medName}</td>
                    <td className="py-1.5 px-2 font-mono text-[11px]">
                      {r.daysRemaining <= 0 ? (
                        <span className="text-[#A80000] dark:text-[#f87171] font-semibold">{lang === 'ar' ? 'منتهي' : 'Expired'}</span>
                      ) : (
                        <span>{r.daysRemaining} {lang === 'ar' ? 'يوم' : 'd'}</span>
                      )}
                    </td>
                    <td className="py-1.5 px-2 font-bold text-[#0078D4] dark:text-[#2899f5] font-mono text-xs">
                      {r.neededTablets > 0 ? (
                        <span>+{r.neededTablets} {lang === 'ar' ? 'حبة' : 'tabs'}</span>
                      ) : (
                        <span className="text-[#605E5C] dark:text-[#a19f9d] text-[10px] font-mono font-normal">{lang === 'ar' ? 'مغطى' : 'Covered'}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Draft Message */}
          <div className="space-y-1">
            <label className="font-semibold text-[11px] text-[#242424] dark:text-[#f3f2f1] block">
              {lang === 'ar' ? 'مسودة الرسالة العائلية الموحدة (WhatsApp):' : 'Draft Unified WhatsApp Message:'}
            </label>
            <textarea
              rows={2}
              value={draftMessage}
              onChange={e => setDraftMessage(e.target.value)}
              className="w-full bg-[#FFFFFF] dark:bg-[#252423] border border-[#EDEBE9] dark:border-[#3b3a39] text-[#242424] dark:text-[#f3f2f1] text-[11px] rounded-[4px] p-2 outline-none focus:border-[#0078D4] dark:focus:border-[#2899f5] font-sans"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 bg-[#FAF9F8] dark:bg-[#2d2c2c] border-t border-[#EDEBE9] dark:border-[#3b3a39] flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={handleSendWhatsApp}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-[4px] bg-[#FFFFFF] dark:bg-[#252423] hover:bg-[#F3F2F1] dark:hover:bg-[#3b3a39] text-[#0078D4] dark:text-[#2899f5] text-xs font-semibold border border-[#EDEBE9] dark:border-[#3b3a39] transition-colors cursor-pointer min-h-[44px]"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>{lang === 'ar' ? 'إرسال WhatsApp' : 'Send WhatsApp'}</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-[4px] bg-[#FFFFFF] dark:bg-[#252423] hover:bg-[#F3F2F1] dark:hover:bg-[#3b3a39] text-[#242424] dark:text-[#f3f2f1] text-xs font-semibold border border-[#EDEBE9] dark:border-[#3b3a39] transition-colors cursor-pointer min-h-[44px]"
            >
              {lang === 'ar' ? 'إلغاء' : 'Cancel'}
            </button>
            <button
              type="button"
              onClick={handleApply}
              className="flex items-center gap-1 px-3.5 py-1.5 rounded-[4px] bg-[#0078D4] hover:bg-[#106EBE] active:bg-[#005A9E] text-white text-xs font-semibold transition-colors cursor-pointer border-0 shadow-none min-h-[44px]"
            >
              <Check className="w-3.5 h-3.5 text-white" />
              <span>{lang === 'ar' ? 'اعتماد التوحيد' : 'Apply & Sync'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
