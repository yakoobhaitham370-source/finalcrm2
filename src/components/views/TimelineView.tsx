import React, { useState, useMemo } from 'react';
import { BellRing, Zap, Users } from 'lucide-react';
import { Patient } from '../../types/pharmacy';
import { calculateDaysRemaining, formatYMD } from '../../utils/pharmacyCalculations';

interface TimelineViewProps {
  patients: Patient[];
  lang: 'ar' | 'en';
  onOpenRefillModal: (patientId: string, medIndex?: number) => void;
  onOpenPatientModal: (patientId: string) => void;
}

export const TimelineView: React.FC<TimelineViewProps> = ({
  patients,
  lang,
  onOpenRefillModal,
  onOpenPatientModal,
}) => {
  const [filterDays, setFilterDays] = useState<number>(30);

  const activePatients = useMemo(() => patients.filter(p => !p.isArchived), [patients]);

  // Group medications by patient for single-row patient timeline display
  const timelinePatients = useMemo(() => {
    const map = new Map<
      string,
      {
        patient: Patient;
        dueMeds: { name: string; daysRemaining: number; daysSupply: number; lastDispenseDate: string; medIndex: number }[];
        allMeds: { name: string; daysRemaining: number; daysSupply: number; lastDispenseDate: string; medIndex: number }[];
        earliestDueDate: Date;
      }
    >();

    activePatients.forEach(p => {
      const dueMeds: any[] = [];
      const allMeds: any[] = [];
      let earliest = new Date(9999, 11, 31);

      (p.medications || []).forEach((m, idx) => {
        const daysRemaining = calculateDaysRemaining(m.lastDispenseDate, m.daysSupply);
        const lastDate = new Date(m.lastDispenseDate);
        const dueDate = new Date(
          lastDate.getFullYear(),
          lastDate.getMonth(),
          lastDate.getDate() + (m.daysSupply || 30)
        );

        const medObj = {
          name: m.name,
          daysRemaining,
          daysSupply: m.daysSupply,
          lastDispenseDate: m.lastDispenseDate,
          medIndex: idx,
        };

        allMeds.push(medObj);

        if (daysRemaining <= filterDays) {
          dueMeds.push(medObj);
          if (dueDate.getTime() < earliest.getTime()) {
            earliest = dueDate;
          }
        }
      });

      if (dueMeds.length > 0) {
        map.set(p.id, {
          patient: p,
          dueMeds,
          allMeds,
          earliestDueDate: earliest,
        });
      }
    });

    return Array.from(map.values()).sort((a, b) => a.earliestDueDate.getTime() - b.earliestDueDate.getTime());
  }, [activePatients, filterDays]);

  return (
    <div className="space-y-2 sm:space-y-3 bg-transparent text-[#242424] dark:text-[#f3f2f1]">
      {/* Header Panel */}
      <div className="bg-[#FFFFFF] dark:bg-[#201f1e] border-b sm:border border-[#EDEBE9] dark:border-[#3b3a39] rounded-none sm:rounded-[4px] p-2.5 sm:p-3 space-y-2.5 -mt-px sm:mt-0">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
          <div>
            <div className="font-semibold text-base text-[#242424] dark:text-[#f3f2f1] flex items-center gap-2 tracking-tight">
              <BellRing className="w-4 h-4 text-[#0078D4] dark:text-[#2899f5]" />
              <span>{lang === 'ar' ? 'الجدول الزمني لتكرار الصرف (سجل المرضى)' : 'Refill Chronology Timeline (Patient Registry)'}</span>
            </div>
            <p className="text-[11px] text-[#605E5C] dark:text-[#a19f9d] mt-0.5">
              {lang === 'ar'
                ? 'كل مريض في صف واحد مع عرض أسمائه الدوائية بحجم صغير، وعند النقر على صرف يتم اختيار الأدوية المطلوبة.'
                : 'Each patient in a single row with medications shown in compact text; click Refill to select and dispense.'}
            </p>
          </div>

          {/* Time range buttons */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs text-[#605E5C] dark:text-[#a19f9d] font-mono">{lang === 'ar' ? 'المدى الزمني:' : 'Range:'}</span>
            {[
              { days: 3, labelAr: '3 أيام', labelEn: '3 Days' },
              { days: 7, labelAr: 'أسبوع', labelEn: '7 Days' },
              { days: 14, labelAr: 'أسبوعين', labelEn: '14 Days' },
              { days: 30, labelAr: 'شهر', labelEn: '30 Days' },
            ].map(r => (
              <button
                key={r.days}
                onClick={() => setFilterDays(r.days)}
                className={`px-3 py-1 rounded-[4px] text-xs font-semibold transition-colors cursor-pointer ${
                  filterDays === r.days
                    ? 'bg-[#0078D4] text-white'
                    : 'bg-[#FFFFFF] dark:bg-[#252423] text-[#242424] dark:text-[#f3f2f1] border border-[#EDEBE9] dark:border-[#3b3a39] hover:bg-[#F3F2F1] dark:hover:bg-[#2d2c2c]'
                }`}
              >
                {lang === 'ar' ? r.labelAr : r.labelEn}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Mobile View: Fixed & Ultra-Compact Stacked Cards (block md:hidden) */}
      <div className="block md:hidden space-y-2 px-2 sm:px-0">
        {timelinePatients.length === 0 ? (
          <div className="bg-[#FFFFFF] dark:bg-[#201f1e] border border-[#EDEBE9] dark:border-[#3b3a39] rounded-[4px] p-6 text-center text-[#605E5C] dark:text-[#a19f9d] text-xs">
            {lang === 'ar' ? 'لا توجد أدوية مستحقة في النطاق الزمني المحدد.' : 'No medications due in this time window.'}
          </div>
        ) : (
          timelinePatients.map((item, idx) => {
            return (
              <div
                key={idx}
                className="bg-[#FFFFFF] dark:bg-[#201f1e] border border-[#EDEBE9] dark:border-[#3b3a39] rounded-[4px] p-3 space-y-2"
              >
                <div className="flex items-center justify-between gap-2 border-b border-[#EDEBE9] dark:border-[#3b3a39] pb-2">
                  <div>
                    <button
                      onClick={() => onOpenPatientModal(item.patient.id)}
                      className="font-bold text-[#0078D4] dark:text-[#2899f5] hover:underline text-xs text-right block"
                    >
                      {item.patient.name}
                    </button>
                    <div className="text-[10px] text-[#605E5C] dark:text-[#a19f9d] font-mono" dir="ltr">
                      {item.patient.phone} • ID: {item.patient.id}
                    </div>
                  </div>
                  <div className="text-right font-mono text-[11px] text-[#605E5C] dark:text-[#a19f9d]">
                    {formatYMD(item.earliestDueDate)}
                  </div>
                </div>

                {/* Patient's Drugs in small text around */}
                <div className="space-y-1">
                  <div className="text-[10px] font-semibold text-[#605E5C] dark:text-[#a19f9d]">
                    {lang === 'ar' ? 'الأدوية (المستحقة والنشطة):' : 'Medications:'}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {item.dueMeds.map((m, mIdx) => {
                      const isOverdue = m.daysRemaining < 0;
                      return (
                        <span
                          key={mIdx}
                          className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-[4px] border font-medium ${
                            isOverdue
                              ? 'bg-[#FDF3F3] dark:bg-[#3a1d1d] text-[#A80000] dark:text-[#f87171] border-[#E0A8A8] dark:border-[#7f1d1d]'
                              : 'bg-[#EFF6FC] dark:bg-[#112338] text-[#0078D4] dark:text-[#60a5fa] border-[#C7E0F4] dark:border-[#1e3a8a]'
                          }`}
                        >
                          <span>{m.name}</span>
                          <span className="opacity-75 font-mono">({isOverdue ? `${Math.abs(m.daysRemaining)}d overdue` : `${m.daysRemaining}d`})</span>
                        </span>
                      );
                    })}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1 border-t border-[#EDEBE9] dark:border-[#3b3a39]">
                  <span className="text-[10px] text-[#605E5C] dark:text-[#a19f9d] font-mono">
                    {item.dueMeds.length} {lang === 'ar' ? 'أدوية مستحقة للصرف' : 'due meds'}
                  </span>
                  <button
                    onClick={() => onOpenRefillModal(item.patient.id)}
                    className="inline-flex items-center gap-1 px-3 py-1 rounded-[4px] bg-[#0078D4] hover:bg-[#106EBE] active:bg-[#005A9E] text-white text-xs font-semibold transition-colors cursor-pointer"
                  >
                    <Zap className="w-3 h-3" />
                    <span>{lang === 'ar' ? 'صرف الأدوية' : 'Refill'}</span>
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Desktop Timeline Table - DetailsList (hidden md:block) */}
      <div className="bg-[#FFFFFF] dark:bg-[#201f1e] border border-[#EDEBE9] dark:border-[#3b3a39] rounded-[4px] overflow-hidden hidden md:block">
        <div className="overflow-x-auto">
          <table className="w-full text-right dir-rtl text-xs border-collapse">
            <thead className="bg-[#FAF9F8] dark:bg-[#2d2c2c] text-[#242424] dark:text-[#f3f2f1] border-b border-[#EDEBE9] dark:border-[#3b3a39]">
              <tr>
                <th className="py-2.5 px-3 text-[11px] uppercase tracking-wider">{lang === 'ar' ? 'المعرف' : 'ID'}</th>
                <th className="py-2.5 px-3 text-[11px] uppercase tracking-wider">{lang === 'ar' ? 'المريض والهاتف' : 'Patient & Phone'}</th>
                <th className="py-2.5 px-3 text-[11px] uppercase tracking-wider">{lang === 'ar' ? 'الأدوية المستحقة (عرض مصغر)' : 'Due Medications (Compact)'}</th>
                <th className="py-2.5 px-3 text-[11px] uppercase tracking-wider">{lang === 'ar' ? 'أقرب استحقاق' : 'Earliest Due'}</th>
                <th className="py-2.5 px-3 text-[11px] uppercase tracking-wider text-center">{lang === 'ar' ? 'إجراء الصرف (اختر الدواء)' : 'Refill Selection'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EDEBE9] dark:divide-[#3b3a39] text-[#242424] dark:text-[#f3f2f1]">
              {timelinePatients.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-[#605E5C] dark:text-[#a19f9d]">
                    {lang === 'ar'
                      ? 'لا توجد أدوية مستحقة في النطاق الزمني المحدد.'
                      : 'No medications due in this time window.'}
                  </td>
                </tr>
              ) : (
                timelinePatients.map((item, idx) => {
                  return (
                    <tr key={idx} className="hover:bg-[#F3F2F1] dark:hover:bg-[#252423] transition-colors">
                      <td className="py-2.5 px-3 font-mono text-[#605E5C] dark:text-[#a19f9d] text-[11px]">
                        {item.patient.id}
                      </td>
                      <td className="py-2.5 px-3">
                        <button
                          onClick={() => onOpenPatientModal(item.patient.id)}
                          className="font-bold text-[#0078D4] dark:text-[#2899f5] hover:underline transition-colors cursor-pointer block text-xs text-right"
                        >
                          {item.patient.name}
                        </button>
                        <div className="text-[10px] text-[#605E5C] dark:text-[#a19f9d] font-mono" dir="ltr">
                          {item.patient.phone}
                        </div>
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="flex flex-wrap gap-1.5 items-center">
                          {item.dueMeds.map((m, mIdx) => {
                            const isOverdue = m.daysRemaining < 0;
                            return (
                              <span
                                key={mIdx}
                                className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-[4px] border font-medium ${
                                  isOverdue
                                    ? 'bg-[#FDF3F3] dark:bg-[#3a1d1d] text-[#A80000] dark:text-[#f87171] border-[#E0A8A8] dark:border-[#7f1d1d]'
                                    : 'bg-[#EFF6FC] dark:bg-[#112338] text-[#0078D4] dark:text-[#60a5fa] border-[#C7E0F4] dark:border-[#1e3a8a]'
                                }`}
                              >
                                <span className="font-semibold">{m.name}</span>
                                <span className="opacity-75 font-mono text-[10px]">
                                  ({isOverdue ? `${Math.abs(m.daysRemaining)}d overdue` : `${m.daysRemaining}d left`})
                                </span>
                              </span>
                            );
                          })}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 font-mono font-semibold text-[#242424] dark:text-[#f3f2f1]">
                        {formatYMD(item.earliestDueDate)}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <button
                          onClick={() => onOpenRefillModal(item.patient.id)}
                          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-[4px] bg-[#0078D4] hover:bg-[#106EBE] active:bg-[#005A9E] text-white text-xs font-semibold transition-colors cursor-pointer"
                        >
                          <Zap className="w-3.5 h-3.5" />
                          <span>{lang === 'ar' ? 'صرف (اختيار الأدوية)' : 'Refill Selection'}</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
