import React, { useState, useEffect } from 'react';
import { Zap, X, Check, Star, MessageSquare, Send, ShoppingBag, Truck, ChevronDown, ChevronUp } from 'lucide-react';
import { Patient } from '../../types/pharmacy';
import { calculateDaysRemaining } from '../../utils/pharmacyCalculations';
import { getCrossSellRecommendations, generateOneClickWhatsAppRefill } from '../../utils/clinicalIntelligence';

interface RefillModalProps {
  isOpen: boolean;
  onClose: () => void;
  patient: Patient | null;
  initialMedIndex?: number;
  lang: 'ar' | 'en';
  pharmacyName?: string;
  onExecuteRefill: (patientId: string, medIndices: number[], daysSupply: number) => void;
  onShowToast?: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export const RefillModal: React.FC<RefillModalProps> = ({
  isOpen,
  onClose,
  patient,
  initialMedIndex,
  lang,
  pharmacyName = 'صيدلية النبض السريرية',
  onExecuteRefill,
  onShowToast,
}) => {
  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);
  const [daysCount, setDaysCount] = useState<number | string>('');
  const [includeDelivery, setIncludeDelivery] = useState<boolean>(true);
  const [showCrossSell, setShowCrossSell] = useState<boolean>(true);

  useEffect(() => {
    if (!patient || !isOpen) return;

    if (initialMedIndex !== undefined && patient.medications[initialMedIndex]) {
      setSelectedIndices([initialMedIndex]);
      const med = patient.medications[initialMedIndex];
      const lastHistory = med.refillHistory && med.refillHistory.length > 0 ? med.refillHistory[med.refillHistory.length - 1] : null;
      const historyDays = lastHistory && typeof lastHistory === 'object' && 'daysSupply' in lastHistory ? Number(lastHistory.daysSupply) : undefined;
      setDaysCount(historyDays || med.daysSupply || '');
    } else {
      const dueIndices: number[] = [];
      let rememberedDays: number | string = '';

      patient.medications.forEach((m, idx) => {
        const remaining = calculateDaysRemaining(m.lastDispenseDate, m.daysSupply);
        if (remaining <= 3) {
          dueIndices.push(idx);
          const lastHistory = m.refillHistory && m.refillHistory.length > 0 ? m.refillHistory[m.refillHistory.length - 1] : null;
          const historyDays = lastHistory && typeof lastHistory === 'object' && 'daysSupply' in lastHistory ? Number(lastHistory.daysSupply) : undefined;
          rememberedDays = historyDays || m.daysSupply || '';
        }
      });

      if (!rememberedDays && patient.medications.length > 0) {
        const firstM = patient.medications[0];
        const lastHistory = firstM.refillHistory && firstM.refillHistory.length > 0 ? firstM.refillHistory[firstM.refillHistory.length - 1] : null;
        const historyDays = lastHistory && typeof lastHistory === 'object' && 'daysSupply' in lastHistory ? Number(lastHistory.daysSupply) : undefined;
        rememberedDays = historyDays || firstM.daysSupply || '';
      }

      setSelectedIndices(dueIndices.length > 0 ? dueIndices : (patient.medications.length > 0 ? [0] : []));
      setDaysCount(rememberedDays);
    }
  }, [patient, initialMedIndex, isOpen]);

  if (!isOpen || !patient) return null;

  const toggleMed = (index: number) => {
    if (selectedIndices.includes(index)) {
      setSelectedIndices(selectedIndices.filter(i => i !== index));
    } else {
      setSelectedIndices([...selectedIndices, index]);
      const med = patient.medications[index];
      if (med) {
        const lastHistory = med.refillHistory && med.refillHistory.length > 0 ? med.refillHistory[med.refillHistory.length - 1] : null;
        const historyDays = lastHistory && typeof lastHistory === 'object' && 'daysSupply' in lastHistory ? Number(lastHistory.daysSupply) : undefined;
        const lastDays = historyDays || med.daysSupply;
        if (lastDays) {
          setDaysCount(lastDays);
        }
      }
    }
  };

  const handleSelectAll = (select: boolean) => {
    if (select) {
      setSelectedIndices(patient.medications.map((_, i) => i));
    } else {
      setSelectedIndices([]);
    }
  };

  const handleExecute = () => {
    if (selectedIndices.length === 0) return;
    onExecuteRefill(patient.id, selectedIndices, Number(daysCount) || 30);
    onClose();
  };

  const loyaltyReward = Number(daysCount) >= 90 ? 30 : Number(daysCount) >= 30 ? 10 : 0;
  const crossSellItems = patient ? getCrossSellRecommendations(patient.medications) : [];

  const handleSendWhatsAppBooking = () => {
    if (!patient) return;
    const selectedMeds = selectedIndices.map(i => patient.medications[i]?.name).filter(Boolean);
    const { encodedUrl } = generateOneClickWhatsAppRefill({
      patient,
      selectedMedications: selectedMeds,
      pharmacyName,
      includeDelivery,
    });
    window.open(encodedUrl, '_blank');
    if (onShowToast) {
      onShowToast(
        lang === 'ar' ? 'تم فتح رسالة حجز التكرار والتوصيل عبر واتساب' : 'Opened WhatsApp Refill & Delivery Booking',
        'success'
      );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-[#FFFFFF] dark:bg-[#201f1e] border border-[#EDEBE9] dark:border-[#3b3a39] rounded-[4px] max-w-xl w-full shadow-lg overflow-hidden flex flex-col max-h-[92vh] text-[#242424] dark:text-[#f3f2f1]">
        {/* Header */}
        <div className="p-4 bg-[#FAF9F8] dark:bg-[#2d2c2c] border-b border-[#EDEBE9] dark:border-[#3b3a39] flex items-center justify-between">
          <div className="font-semibold text-base text-[#242424] dark:text-[#f3f2f1] flex items-center gap-2">
            <Zap className="w-5 h-5 text-[#0078D4] dark:text-[#2899f5]" />
            <span>{lang === 'ar' ? 'تكرار الصرف الدوائي وحجز التوصيل' : 'Granular Refill & Delivery'}</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-[4px] text-[#605E5C] dark:text-[#a19f9d] hover:text-[#242424] dark:hover:text-[#f3f2f1] hover:bg-[#EDEBE9] dark:hover:bg-[#3b3a39] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-5 space-y-4 text-xs overflow-y-auto">
          <div className="bg-[#FFFFFF] dark:bg-[#252423] p-3 rounded-[4px] border border-[#EDEBE9] dark:border-[#3b3a39] flex items-center justify-between">
            <div>
              <div className="font-semibold text-sm text-[#242424] dark:text-[#f3f2f1]">{patient.name}</div>
              <div className="text-[#605E5C] dark:text-[#a19f9d] font-mono mt-0.5">{patient.phone}</div>
            </div>
            {loyaltyReward > 0 && (
              <span className="inline-flex items-center gap-1 font-semibold text-[#0078D4] dark:text-[#60a5fa] bg-[#EFF6FC] dark:bg-[#112338] px-2 py-1 rounded-[4px] border border-[#C7E0F4] dark:border-[#1e3a8a] font-mono">
                <Star className="w-3.5 h-3.5 text-[#0078D4] dark:text-[#60a5fa]" />
                <span>+{loyaltyReward} pts</span>
              </span>
            )}
          </div>

          <div className="flex items-center justify-between pt-1">
            <span className="font-semibold text-[#242424] dark:text-[#f3f2f1]">
              {lang === 'ar' ? 'حدد الأدوية المراد تجديد صرفها الآن:' : 'Select medications to refill now:'}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleSelectAll(true)}
                className="text-[#0078D4] dark:text-[#2899f5] hover:underline font-semibold cursor-pointer"
              >
                {lang === 'ar' ? 'تحديد الكل' : 'Select All'}
              </button>
              <span className="text-[#605E5C] dark:text-[#a19f9d]">|</span>
              <button
                type="button"
                onClick={() => handleSelectAll(false)}
                className="text-[#605E5C] dark:text-[#a19f9d] hover:underline font-semibold cursor-pointer"
              >
                {lang === 'ar' ? 'إلغاء التحديد' : 'Deselect All'}
              </button>
            </div>
          </div>

          {/* Meds List */}
          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
            {patient.medications.map((m, idx) => {
              const isChecked = selectedIndices.includes(idx);
              const remaining = calculateDaysRemaining(m.lastDispenseDate, m.daysSupply);

              return (
                <div
                  key={idx}
                  onClick={() => toggleMed(idx)}
                  className={`p-3 rounded-[4px] border flex items-center justify-between cursor-pointer transition-all ${
                    isChecked
                      ? 'bg-[#EFF6FC] dark:bg-[#112338] border-[#0078D4] dark:border-[#1e3a8a] text-[#242424] dark:text-[#f3f2f1]'
                      : 'bg-[#FFFFFF] dark:bg-[#252423] border-[#EDEBE9] dark:border-[#3b3a39] text-[#242424] dark:text-[#f3f2f1] hover:bg-[#F3F2F1] dark:hover:bg-[#2d2c2c]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => {}}
                      className="w-4 h-4 rounded-[3px] accent-[#0078D4] cursor-pointer"
                    />
                    <div>
                      <div className="font-semibold text-sm text-[#242424] dark:text-[#f3f2f1]">{m.name}</div>
                      <div className="text-[11px] mt-0.5 text-[#605E5C] dark:text-[#a19f9d]">
                        {lang === 'ar'
                          ? `نمط الصرف المحفوظ: ${m.daysSupply} يوم | آخر صرف: ${m.lastDispenseDate}`
                          : `Saved supply: ${m.daysSupply}d | Last: ${m.lastDispenseDate}`}
                      </div>
                    </div>
                  </div>

                  <div>
                    {remaining < 0 ? (
                      <span className="font-semibold font-mono text-[#A80000] dark:text-[#f87171] bg-[#FDF3F3] dark:bg-[#3a1d1d] border border-[#E0A8A8] dark:border-[#7f1d1d] px-2 py-0.5 rounded-[4px] text-[11px]">
                        {lang === 'ar' ? `متأخر ${Math.abs(remaining)} يوم` : `${Math.abs(remaining)}d overdue`}
                      </span>
                    ) : (
                      <span className="font-semibold font-mono px-2 py-0.5 rounded-[4px] text-[11px] bg-[#FAF9F8] dark:bg-[#252423] border border-[#EDEBE9] dark:border-[#3b3a39] text-[#242424] dark:text-[#f3f2f1]">
                        {lang === 'ar' ? `متبقي ${remaining} يوم` : `${remaining}d left`}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Days Supply Input & Presets */}
          <div className="space-y-2 pt-2 border-t border-[#EDEBE9] dark:border-[#3b3a39]">
            <label className="font-semibold text-[#242424] dark:text-[#f3f2f1] block">
              {lang === 'ar' ? 'مدة التكرار المحددة (عدد الأيام / الحبات):' : 'Dispense Duration (Days / Tablets):'}
            </label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min={1}
                max={365}
                value={daysCount}
                onChange={e => {
                  const val = e.target.value;
                  setDaysCount(val === '' ? '' : parseInt(val, 10));
                }}
                placeholder="..."
                className="w-32 bg-[#FFFFFF] dark:bg-[#252423] border border-[#EDEBE9] dark:border-[#3b3a39] text-[#242424] dark:text-[#f3f2f1] text-base font-bold text-center rounded-[4px] p-2 outline-none focus:border-[#0078D4] dark:focus:border-[#2899f5] font-mono"
              />
              <span className="font-semibold text-[#242424] dark:text-[#f3f2f1]">{lang === 'ar' ? 'يوم / حبة' : 'Days / Tablets'}</span>
            </div>

            {/* Quick chips */}
            <div className="flex items-center gap-1.5 flex-wrap pt-1">
              <span className="text-[11px] text-[#605E5C] dark:text-[#a19f9d]">{lang === 'ar' ? 'اختصارات سريعة:' : 'Quick Presets:'}</span>
              {[
                { d: 3, label: '3 أيام' },
                { d: 7, label: 'أسبوع' },
                { d: 10, label: '10 أيام' },
                { d: 14, label: '14 يوم' },
                { d: 28, label: '28 يوم' },
                { d: 30, label: 'شهر (30)' },
                { d: 60, label: 'شهرين (60)' },
                { d: 90, label: 'فصلي (90)' },
              ].map(chip => (
                <button
                  key={chip.d}
                  type="button"
                  onClick={() => setDaysCount(chip.d)}
                  className={`px-2 py-1 rounded-[4px] text-[11px] font-semibold transition-colors cursor-pointer ${
                    daysCount === chip.d
                      ? 'bg-[#0078D4] text-white'
                      : 'bg-[#FAF9F8] dark:bg-[#252423] text-[#242424] dark:text-[#f3f2f1] border border-[#EDEBE9] dark:border-[#3b3a39] hover:bg-[#F3F2F1] dark:hover:bg-[#2d2c2c]'
                  }`}
                >
                  {chip.label}
                </button>
              ))}
            </div>
          </div>

          {/* 1-Click WhatsApp Refill & Delivery Booking Action */}
          <div className="p-3 rounded-[4px] bg-[#EFF6FC] dark:bg-[#112338] border border-[#C7E0F4] dark:border-[#1e3a8a] space-y-2">
            <div className="flex items-center justify-between">
              <div className="font-semibold text-[#0078D4] dark:text-[#60a5fa] flex items-center gap-1.5 text-xs">
                <MessageSquare className="w-4 h-4 text-[#0078D4] dark:text-[#60a5fa]" />
                <span>{lang === 'ar' ? 'حجز التكرار الفوري عبر واتساب' : '1-Click WhatsApp Refill & Delivery'}</span>
              </div>
              <label className="flex items-center gap-1.5 text-[11px] text-[#242424] dark:text-[#f3f2f1] cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeDelivery}
                  onChange={e => setIncludeDelivery(e.target.checked)}
                  className="rounded-[3px] accent-[#0078D4]"
                />
                <Truck className="w-3.5 h-3.5 text-[#0078D4] dark:text-[#60a5fa]" />
                <span>{lang === 'ar' ? 'تضمين خيار التوصيل السريع' : 'Include Delivery Option'}</span>
              </label>
            </div>
            <button
              type="button"
              onClick={handleSendWhatsAppBooking}
              className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-[4px] bg-[#FFFFFF] dark:bg-[#252423] hover:bg-[#DEECF9] dark:hover:bg-[#1a365d] text-[#0078D4] dark:text-[#60a5fa] font-semibold text-xs border border-[#C7E0F4] dark:border-[#1e3a8a] transition-all cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{lang === 'ar' ? 'إرسال رسالة حجز التكرار والتوصيل للمريض' : 'Send WhatsApp Refill & Delivery Message'}</span>
            </button>
          </div>

          {/* Clinical Cross-Selling Drawer */}
          {crossSellItems.length > 0 && (
            <div className="p-3 rounded-[4px] bg-[#FFFFFF] dark:bg-[#201f1e] border border-[#EDEBE9] dark:border-[#3b3a39] space-y-2">
              <div
                onClick={() => setShowCrossSell(prev => !prev)}
                className="flex items-center justify-between cursor-pointer select-none"
              >
                <div className="font-semibold text-[#242424] dark:text-[#f3f2f1] flex items-center gap-1.5 text-xs">
                  <ShoppingBag className="w-4 h-4 text-[#0078D4] dark:text-[#2899f5]" />
                  <span>{lang === 'ar' ? 'البيع المتقاطع السريري للمكملات والمستلزمات' : 'Clinical Cross-Selling Care Add-ons'}</span>
                </div>
                {showCrossSell ? <ChevronUp className="w-4 h-4 text-[#605E5C] dark:text-[#a19f9d]" /> : <ChevronDown className="w-4 h-4 text-[#605E5C] dark:text-[#a19f9d]" />}
              </div>

              {showCrossSell && (
                <div className="space-y-2 pt-1">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {crossSellItems.map(item => (
                      <div
                        key={item.id}
                        className="p-2.5 rounded-[4px] bg-[#FAF9F8] dark:bg-[#252423] border border-[#EDEBE9] dark:border-[#3b3a39] space-y-1"
                      >
                        <div className="flex items-start justify-between gap-1">
                          <span className="font-semibold text-xs text-[#242424] dark:text-[#f3f2f1]">{item.name}</span>
                          <span className="px-1.5 py-0.5 rounded-[4px] text-[9px] font-semibold bg-[#EFF6FC] dark:bg-[#112338] text-[#0078D4] dark:text-[#60a5fa] border border-[#C7E0F4] dark:border-[#1e3a8a] shrink-0">
                            {item.estimatedMargin}
                          </span>
                        </div>
                        <p className="text-[10px] text-[#605E5C] dark:text-[#a19f9d] leading-snug">
                          {lang === 'ar' ? item.clinicalRationaleAr : item.clinicalRationaleEn}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-[#FAF9F8] dark:bg-[#2d2c2c] border-t border-[#EDEBE9] dark:border-[#3b3a39] flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-[4px] bg-[#FFFFFF] dark:bg-[#252423] hover:bg-[#F3F2F1] dark:hover:bg-[#3b3a39] text-[#242424] dark:text-[#f3f2f1] text-xs font-semibold border border-[#EDEBE9] dark:border-[#3b3a39] transition-colors cursor-pointer"
          >
            {lang === 'ar' ? 'إلغاء' : 'Cancel'}
          </button>
          <button
            type="button"
            onClick={handleExecute}
            disabled={selectedIndices.length === 0}
            className="flex items-center gap-2 px-5 py-2 rounded-[4px] bg-[#0078D4] hover:bg-[#106EBE] active:bg-[#005A9E] text-white text-xs font-semibold transition-all disabled:opacity-50 cursor-pointer border-0 shadow-none"
          >
            <Check className="w-4 h-4 text-white" />
            <span>
              {lang === 'ar'
                ? `إتمام صرف ${selectedIndices.length} أدوية (${daysCount} يوم)`
                : `Dispense ${selectedIndices.length} Meds (${daysCount}d)`}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
