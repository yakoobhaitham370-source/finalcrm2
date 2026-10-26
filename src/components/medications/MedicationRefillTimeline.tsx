import React, { useState } from 'react';
import {
  Calendar,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  Activity,
  ArrowRight,
  X,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Clock,
  History,
} from 'lucide-react';
import { Medication, RefillRecord } from '../../types/pharmacy';
import {
  analyzeMedicationAdherence,
  addDaysToYMD,
} from '../../utils/adherenceCalculations';
import { formatYMD } from '../../utils/pharmacyCalculations';

interface MedicationRefillTimelineProps {
  medication: Medication;
  lang: 'ar' | 'en';
  onUpdateRefillHistory?: (newHistory: RefillRecord[]) => void;
  defaultExpanded?: boolean;
}

export const MedicationRefillTimeline: React.FC<MedicationRefillTimelineProps> = ({
  medication,
  lang,
  onUpdateRefillHistory,
  defaultExpanded = false,
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(defaultExpanded);
  const [showAddForm, setShowAddForm] = useState<boolean>(false);

  const [inputDate, setInputDate] = useState<string>(() => {
    const baseDate = medication.lastDispenseDate || formatYMD(new Date());
    return addDaysToYMD(baseDate, -30);
  });
  const [inputDaysSupply, setInputDaysSupply] = useState<number | string>(medication.daysSupply || 30);
  const [inputNote, setInputNote] = useState<string>('');

  const analysis = analyzeMedicationAdherence(medication);

  const getCurrentRecords = (): RefillRecord[] => {
    if (!medication.refillHistory) return [];
    return medication.refillHistory.map((r, i) => {
      if (typeof r === 'string') {
        return {
          id: `rec-${i}`,
          date: r,
          daysSupply: medication.daysSupply || 30,
        };
      }
      return r;
    });
  };

  const handleAddRefillDate = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputDate || !onUpdateRefillHistory) return;

    const current = getCurrentRecords();
    if (current.some(r => r.date === inputDate) || medication.lastDispenseDate === inputDate) {
      alert(lang === 'ar' ? 'هذا التاريخ مسجل بالفعل لهذا الدواء' : 'This refill date already exists');
      return;
    }

    const updated = [
      ...current,
      {
        id: `rec-${Date.now()}`,
        date: inputDate,
        daysSupply: Number(inputDaysSupply) || 30,
        note: inputNote.trim() || undefined,
      },
    ].sort((a, b) => a.date.localeCompare(b.date));

    onUpdateRefillHistory(updated);
    setShowAddForm(false);
    setInputNote('');
  };

  const handleQuickAddPreset = (daysAgo: number) => {
    if (!onUpdateRefillHistory) return;
    const baseDate = medication.lastDispenseDate || formatYMD(new Date());
    const targetDate = addDaysToYMD(baseDate, -daysAgo);

    const current = getCurrentRecords();
    if (current.some(r => r.date === targetDate) || medication.lastDispenseDate === targetDate) {
      return;
    }

    const updated = [
      ...current,
      {
        id: `rec-${Date.now()}-${daysAgo}`,
        date: targetDate,
        daysSupply: Number(inputDaysSupply) || medication.daysSupply || 30,
      },
    ].sort((a, b) => a.date.localeCompare(b.date));

    onUpdateRefillHistory(updated);
  };

  const handleRemoveRefill = (targetDate: string) => {
    if (!onUpdateRefillHistory) return;
    const current = getCurrentRecords();
    const updated = current.filter(r => r.date !== targetDate);
    onUpdateRefillHistory(updated);
  };

  // Determine PDC status color tokens
  const getPdcBadgeClasses = () => {
    if (analysis.pdc >= 80) {
      return 'bg-[#E6F4EA] dark:bg-[#0f3822] text-[#137333] dark:text-[#81c995] border-[#CEEAD6] dark:border-[#1e5233]';
    }
    if (analysis.pdc >= 50) {
      return 'bg-[#FFF4CE] dark:bg-[#3a3118] text-[#7A5B00] dark:text-[#f3d370] border-[#FFE699] dark:border-[#6a5a20]';
    }
    return 'bg-[#FDF3F3] dark:bg-[#3a1d1d] text-[#A80000] dark:text-[#f87171] border-[#E0A8A8] dark:border-[#7f1d1d]';
  };

  return (
    <div className="mt-2.5 border border-[#EDEBE9] dark:border-[#3b3a39] rounded-[4px] bg-[#FFFFFF] dark:bg-[#201f1e] overflow-hidden text-xs text-[#242424] dark:text-[#f3f2f1] shadow-2xs">
      {/* Timeline Bar Header */}
      <div
        onClick={() => setIsExpanded(prev => !prev)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setIsExpanded(prev => !prev);
          }
        }}
        className={`p-2.5 bg-[#FAF9F8] dark:bg-[#2d2c2c] hover:bg-[#F3F2F1] dark:hover:bg-[#353434] ${
          isExpanded ? 'border-b border-[#EDEBE9] dark:border-[#3b3a39]' : ''
        } flex items-center justify-between flex-wrap gap-2 cursor-pointer select-none transition-colors`}
      >
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 font-semibold text-[#242424] dark:text-[#f3f2f1]">
            <Activity className="w-3.5 h-3.5 text-[#0078D4] dark:text-[#2899f5]" />
            <span>{lang === 'ar' ? 'مخطط الصرف والالتزام:' : 'Refill Timeline & Adherence:'}</span>
          </div>

          <div className={`px-2 py-0.5 rounded-[4px] border text-[11px] font-semibold font-mono flex items-center gap-1 ${getPdcBadgeClasses()}`}>
            <span>
              {analysis.pdc}% {lang === 'ar' ? 'PDC التزام' : 'PDC Adherence'}
            </span>
            <span className="text-[10px] opacity-75">•</span>
            <span>
              {lang === 'ar' ? analysis.patternTitleAr : analysis.patternTitleEn}
            </span>
          </div>

          <span className="text-[11px] text-[#605E5C] dark:text-[#a19f9d] font-mono flex items-center gap-1">
            <History className="w-3 h-3 text-[#605E5C] dark:text-[#a19f9d]" />
            ({analysis.totalRefillsCount} {lang === 'ar' ? 'صرف مسجل' : 'dispenses'})
          </span>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
          {onUpdateRefillHistory && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowAddForm(prev => !prev);
                if (!isExpanded) setIsExpanded(true);
              }}
              className="flex items-center gap-1 px-2.5 py-1 rounded-[4px] bg-[#0078D4] hover:bg-[#106EBE] active:bg-[#005A9E] text-white text-[11px] font-semibold transition-all cursor-pointer border-0 shadow-none"
            >
              <Plus className="w-3 h-3 text-white" />
              <span>{lang === 'ar' ? 'إضافة صرف سابق' : 'Add Past Refill'}</span>
            </button>
          )}

          <div className="p-1 text-[#605E5C] dark:text-[#a19f9d] hover:text-[#242424] dark:hover:text-[#f3f2f1] transition-colors">
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </div>
      </div>

      {isExpanded && (
        <div className="p-3.5 space-y-3.5 bg-[#FFFFFF] dark:bg-[#201f1e]">
          {/* Clinical Insight Callout Banner */}
          <div className="p-2.5 rounded-[4px] bg-[#EFF6FC] dark:bg-[#112338] border border-[#C7E0F4] dark:border-[#1e3a8a] text-xs flex items-start gap-2 text-[#242424] dark:text-[#f3f2f1]">
            <Sparkles className="w-4 h-4 text-[#0078D4] dark:text-[#2899f5] shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <div className="font-semibold text-[#0078D4] dark:text-[#2899f5] flex items-center gap-1.5">
                <span>{lang === 'ar' ? 'الرأي والتحليل السريري للالتزام الدوائي:' : 'Clinical Adherence Insight:'}</span>
              </div>
              <p className="text-[11px] text-[#242424] dark:text-[#f3f2f1] leading-relaxed">
                {lang === 'ar' ? analysis.clinicalInsightAr : analysis.clinicalInsightEn}
              </p>
            </div>
          </div>

          {/* Quick Add Past Refill Form */}
          {showAddForm && onUpdateRefillHistory && (
            <form
              onSubmit={handleAddRefillDate}
              className="p-3 bg-[#FAF9F8] dark:bg-[#2d2c2c] border border-[#EDEBE9] dark:border-[#3b3a39] rounded-[4px] space-y-2.5 transition-all"
            >
              <div className="flex items-center justify-between font-semibold text-[#242424] dark:text-[#f3f2f1] text-xs">
                <span className="flex items-center gap-1.5">
                  <Plus className="w-3.5 h-3.5 text-[#0078D4] dark:text-[#2899f5]" />
                  <span>{lang === 'ar' ? 'تسجيل تاريخ صرف دوائي سابق' : 'Record Previous Refill Event'}</span>
                </span>
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="text-[#605E5C] dark:text-[#a19f9d] hover:text-[#242424] dark:hover:text-[#f3f2f1] p-0.5"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div className="space-y-1">
                  <label className="text-[10px] text-[#605E5C] dark:text-[#a19f9d] font-semibold">
                    {lang === 'ar' ? 'تاريخ الصرف السابق' : 'Past Refill Date'}
                  </label>
                  <input
                    type="date"
                    value={inputDate}
                    max={formatYMD(new Date())}
                    onChange={e => setInputDate(e.target.value)}
                    className="w-full bg-[#FFFFFF] dark:bg-[#201f1e] border border-[#EDEBE9] dark:border-[#3b3a39] p-1.5 rounded-[4px] text-[#242424] dark:text-[#f3f2f1] text-xs font-mono outline-none focus:border-[#0078D4] dark:focus:border-[#2899f5]"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-[#605E5C] dark:text-[#a19f9d] font-semibold">
                    {lang === 'ar' ? 'الكمية المصروفة (أيام)' : 'Days Supply'}
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={365}
                    value={inputDaysSupply}
                    onChange={e => {
                      const val = e.target.value;
                      setInputDaysSupply(val === '' ? '' : parseInt(val, 10));
                    }}
                    onBlur={() => {
                      if (!inputDaysSupply || Number(inputDaysSupply) < 1) {
                        setInputDaysSupply(30);
                      }
                    }}
                    placeholder="30"
                    className="w-full bg-[#FFFFFF] dark:bg-[#201f1e] border border-[#EDEBE9] dark:border-[#3b3a39] p-1.5 rounded-[4px] text-[#242424] dark:text-[#f3f2f1] text-xs font-semibold text-center outline-none focus:border-[#0078D4] dark:focus:border-[#2899f5] font-mono"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-[#605E5C] dark:text-[#a19f9d] font-semibold">
                    {lang === 'ar' ? 'ملاحظة سريرية (اختياري)' : 'Clinical Note (Optional)'}
                  </label>
                  <input
                    type="text"
                    value={inputNote}
                    onChange={e => setInputNote(e.target.value)}
                    placeholder={lang === 'ar' ? 'صرف العيادة / الصيدلية الخارجة...' : 'Clinic refill / External pharmacy...'}
                    className="w-full bg-[#FFFFFF] dark:bg-[#201f1e] border border-[#EDEBE9] dark:border-[#3b3a39] p-1.5 rounded-[4px] text-[#242424] dark:text-[#f3f2f1] text-xs outline-none focus:border-[#0078D4] dark:focus:border-[#2899f5]"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between flex-wrap gap-2 pt-1 border-t border-[#EDEBE9] dark:border-[#3b3a39]">
                <div className="flex items-center gap-1.5 text-[11px] text-[#605E5C] dark:text-[#a19f9d]">
                  <span>{lang === 'ar' ? 'اختصارات سريعة:' : 'Quick Presets:'}</span>
                  {[30, 60, 90].map(daysAgo => (
                    <button
                      key={daysAgo}
                      type="button"
                      onClick={() => handleQuickAddPreset(daysAgo)}
                      className="px-2 py-0.5 rounded-[4px] bg-[#FFFFFF] dark:bg-[#201f1e] hover:bg-[#F3F2F1] dark:hover:bg-[#3b3a39] text-[#242424] dark:text-[#f3f2f1] border border-[#EDEBE9] dark:border-[#3b3a39] text-[10px] font-semibold font-mono transition-colors cursor-pointer"
                    >
                      -{daysAgo}d
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setShowAddForm(false)}
                    className="px-2.5 py-1 rounded-[4px] bg-[#FFFFFF] dark:bg-[#201f1e] hover:bg-[#F3F2F1] dark:hover:bg-[#3b3a39] text-[#242424] dark:text-[#f3f2f1] border border-[#EDEBE9] dark:border-[#3b3a39] text-xs font-semibold cursor-pointer"
                  >
                    {lang === 'ar' ? 'إلغاء' : 'Cancel'}
                  </button>
                  <button
                    type="submit"
                    className="px-3 py-1 rounded-[4px] bg-[#0078D4] hover:bg-[#106EBE] active:bg-[#005A9E] text-white text-xs font-semibold border-0 cursor-pointer shadow-none"
                  >
                    {lang === 'ar' ? 'حفظ الصرف' : 'Save Refill Event'}
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* Visual Timeline Track */}
          <div className="relative overflow-x-auto pb-2 pt-1 scrollbar-thin">
            <div className="min-w-[640px] flex items-center justify-start gap-1 py-3 px-2">
              {analysis.events.map((event, idx) => {
                const isLast = idx === analysis.events.length - 1;
                const nextEvent = analysis.events[idx + 1];

                return (
                  <React.Fragment key={event.id}>
                    {/* Event Node Card */}
                    <div className="flex flex-col items-center relative group shrink-0 w-36">
                      <div className="px-2 py-0.5 rounded-[4px] text-[10px] font-semibold font-mono border border-[#EDEBE9] dark:border-[#3b3a39] mb-1 bg-[#FAF9F8] dark:bg-[#2d2c2c] text-[#242424] dark:text-[#f3f2f1]">
                        <span>{isLast ? (lang === 'ar' ? 'الصرف الحالي' : 'Current Refill') : `#${idx + 1}`}</span>
                      </div>

                      <div className={`w-9 h-9 rounded-[4px] flex items-center justify-center font-bold font-mono text-xs border ${
                        isLast
                          ? 'bg-[#0078D4] text-white border-[#0078D4] shadow-xs'
                          : 'bg-[#FFFFFF] dark:bg-[#2d2c2c] text-[#242424] dark:text-[#f3f2f1] border-[#EDEBE9] dark:border-[#3b3a39]'
                      }`}>
                        <span>{idx + 1}</span>
                      </div>

                      <div className="text-center mt-1.5 space-y-0.5">
                        <div className="font-mono font-semibold text-[#242424] dark:text-[#f3f2f1] text-xs">
                          {event.date}
                        </div>
                        <div className="text-[10px] text-[#605E5C] dark:text-[#a19f9d] font-mono">
                          {event.daysSupply} {lang === 'ar' ? 'يوم' : 'days'}
                        </div>
                        {event.note && (
                          <div className="text-[9px] text-[#0078D4] dark:text-[#2899f5] truncate max-w-[120px]" title={event.note}>
                            {event.note}
                          </div>
                        )}
                      </div>

                      {!isLast && onUpdateRefillHistory && (
                        <button
                          type="button"
                          onClick={() => handleRemoveRefill(event.date)}
                          className="opacity-0 group-hover:opacity-100 p-1 bg-[#A80000] text-white text-[9px] rounded-[2px] absolute -top-1 right-2 cursor-pointer transition-opacity"
                          title={lang === 'ar' ? 'حذف هذا التاريخ' : 'Remove this date'}
                        >
                          <Trash2 className="w-2.5 h-2.5" />
                        </button>
                      )}
                    </div>

                    {/* Gap Interval Segment */}
                    {nextEvent && (
                      <div className="flex-1 flex flex-col items-center justify-center px-1 relative min-w-[110px]">
                        <div className={`px-2 py-0.5 border text-[9px] font-semibold font-mono mb-1 rounded-[4px] ${
                          event.status === 'critical-gap'
                            ? 'bg-[#FDF3F3] dark:bg-[#3a1d1d] text-[#A80000] dark:text-[#f87171] border-[#E0A8A8] dark:border-[#7f1d1d]'
                            : event.status === 'moderate-gap' || event.status === 'minor-delay'
                            ? 'bg-[#FFF4CE] dark:bg-[#3a3118] text-[#7A5B00] dark:text-[#f3d370] border-[#FFE699] dark:border-[#6a5a20]'
                            : 'bg-[#FAF9F8] dark:bg-[#2d2c2c] text-[#242424] dark:text-[#f3f2f1] border-[#EDEBE9] dark:border-[#3b3a39]'
                        }`}>
                          {lang === 'ar' ? (event.statusLabelAr || `${event.daysToNext} يوم فاصل`) : (event.statusLabelEn || `${event.daysToNext}d gap`)}
                        </div>
                        <div className="w-full relative flex items-center">
                          <div className={`w-full h-0.5 ${
                            event.status === 'critical-gap'
                              ? 'bg-[#A80000] dark:bg-[#f87171]'
                              : event.status === 'moderate-gap' || event.status === 'minor-delay'
                              ? 'bg-[#D97706]'
                              : 'bg-[#0078D4] dark:bg-[#2899f5]'
                          }`} />
                        </div>
                      </div>
                    )}

                    {/* Target Next Projected Refill Node */}
                    {isLast && (
                      <>
                        <div className="flex-1 flex flex-col items-center justify-center px-1 relative min-w-[110px]">
                          <div className={`px-2 py-0.5 border text-[9px] font-semibold font-mono mb-1 rounded-[4px] ${
                            analysis.isOverdueForRefill
                              ? 'bg-[#FDF3F3] dark:bg-[#3a1d1d] text-[#A80000] dark:text-[#f87171] border-[#E0A8A8] dark:border-[#7f1d1d]'
                              : 'bg-[#EFF6FC] dark:bg-[#112338] text-[#0078D4] dark:text-[#2899f5] border-[#C7E0F4] dark:border-[#1e4a6f]'
                          }`}>
                            {analysis.isOverdueForRefill
                              ? (lang === 'ar' ? `تأخر عن الصرف بـ ${analysis.overdueDays} يوم ⚠️` : `Overdue by ${analysis.overdueDays}d ⚠️`)
                              : (lang === 'ar' ? `مستحق بعد ${analysis.daysUntilNextRefill} يوم` : `Due in ${analysis.daysUntilNextRefill}d`)}
                          </div>
                          <div className="w-full relative flex items-center">
                            <div className="w-full h-0.5 border-t border-dashed border-[#0078D4] dark:border-[#2899f5]" />
                            <ArrowRight className="w-3.5 h-3.5 absolute right-0 text-[#0078D4] dark:text-[#2899f5]" />
                          </div>
                        </div>

                        <div className="flex flex-col items-center relative shrink-0 w-36">
                          <div className="px-2 py-0.5 rounded-[4px] text-[10px] font-semibold font-mono border border-[#EDEBE9] dark:border-[#3b3a39] mb-1 bg-[#FAF9F8] dark:bg-[#2d2c2c] text-[#242424] dark:text-[#f3f2f1]">
                            <span>{lang === 'ar' ? 'الموعد القادم' : 'Next Target'}</span>
                          </div>

                          <div className="w-9 h-9 rounded-[4px] flex items-center justify-center font-bold font-mono text-xs border border-dashed border-[#0078D4] dark:border-[#2899f5] bg-[#FFFFFF] dark:bg-[#201f1e] text-[#0078D4] dark:text-[#2899f5]">
                            <Calendar className="w-4 h-4" />
                          </div>

                          <div className="text-center mt-1.5 space-y-0.5 font-mono">
                            <div className="font-semibold text-[#242424] dark:text-[#f3f2f1] text-xs">
                              {analysis.nextProjectedRefillDate}
                            </div>
                          </div>
                        </div>
                      </>
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
