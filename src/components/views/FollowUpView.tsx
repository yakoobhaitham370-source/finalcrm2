import React, { useState, useMemo } from 'react';
import {
  Stethoscope,
  Plus,
  MessageSquare,
  Send,
  CheckCircle,
  Trash2,
  Clock,
  ShieldCheck,
  Microscope,
} from 'lucide-react';
import { FollowUpEntry, Patient } from '../../types/pharmacy';
import { formatPhoneForWhatsApp, executeUniversalSMS } from '../../utils/pharmacyCalculations';
import { getPatientLabRadar, generateLabTestWhatsAppReminder } from '../../utils/clinicalIntelligence';

interface FollowUpViewProps {
  followUps: FollowUpEntry[];
  patients: Patient[];
  pharmacyName: string;
  waAbxTemplate: string;
  waChronicFollowTemplate: string;
  lang: 'ar' | 'en';
  onOpenFollowUpModal: () => void;
  onOpenPatientModal?: (patientId: string, tab?: string) => void;
  onResolveFollowUp: (id: string) => void;
  onDeleteFollowUp: (id: string) => void;
  onShowToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export const FollowUpView: React.FC<FollowUpViewProps> = ({
  followUps,
  patients,
  pharmacyName,
  waAbxTemplate,
  waChronicFollowTemplate,
  lang,
  onOpenFollowUpModal,
  onOpenPatientModal,
  onResolveFollowUp,
  onDeleteFollowUp,
  onShowToast,
}) => {
  const [filterType, setFilterType] = useState<string>('ALL');
  const [labSubFilter, setLabSubFilter] = useState<string>('ALL');

  // Compute Lab Surveillance Radar across all active chronic patients
  const patientsLabRadarAlerts = useMemo(() => {
    const list: { patient: Patient; lab: ReturnType<typeof getPatientLabRadar>[0] }[] = [];
    patients.filter(p => !p.isArchived).forEach(p => {
      const radar = getPatientLabRadar(p);
      radar.filter(r => r.status === 'overdue' || r.status === 'due_soon').forEach(lab => {
        list.push({ patient: p, lab });
      });
    });
    return list.sort((a, b) => b.lab.daysOverdue - a.lab.daysOverdue);
  }, [patients]);

  const filtered = followUps.filter(f => {
    if (filterType === 'ACTIVE') return !f.resolved;
    if (filterType === 'RESOLVED') return f.resolved;
    if (filterType === 'ANTIBIOTIC') return f.type === 'ANTIBIOTIC';
    if (filterType === 'CHRONIC') return f.type !== 'ANTIBIOTIC';
    return true;
  });

  const handleSendWhatsApp = (item: FollowUpEntry) => {
    if (!item.phone || item.phone === 'غير متوفر') {
      onShowToast(lang === 'ar' ? 'رقم الهاتف غير متوفر لهذا المريض' : 'Phone number unavailable for this patient', 'error');
      return;
    }
    let template = item.type === 'ANTIBIOTIC' ? waAbxTemplate : waChronicFollowTemplate;
    if (!template) {
      template =
        item.type === 'ANTIBIOTIC'
          ? 'مرحباً {name}، معك دكتور الصيدلة من {pharmacy}. نود الاطمئنان على استجابتك لمضاد ({drug}). نؤكد على ضرورة إكمال الكورس كاملاً.'
          : 'مرحباً {name}، معك دكتور الصيدلة من {pharmacy}. نود الاطمئنان على صحتك مع علاج ({drug}) وهل واجهت أي أعراض جانبية؟';
    }

    const message = template
      .replace('{name}', item.patientName)
      .replace('{pharmacy}', pharmacyName)
      .replace('{drug}', item.drug)
      .replace('{date}', item.dueDate);

    const cleanPhone = formatPhoneForWhatsApp(item.phone);
    window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`, '_blank');
    onShowToast(lang === 'ar' ? `تم فتح WhatsApp لمتابعة ${item.patientName}` : `Opened WhatsApp for ${item.patientName}`, 'success');
  };

  const handleSendSMS = (item: FollowUpEntry) => {
    if (!item.phone || item.phone === 'غير متوفر') {
      onShowToast(lang === 'ar' ? 'رقم الهاتف غير متوفر لهذا المريض' : 'Phone number unavailable for this patient', 'error');
      return;
    }
    const text = `${pharmacyName}: مرحباً ${item.patientName}، نود الاطمئنان على استجابتك لعلاج ${item.drug}. صحتكم تهمنا دائماً.`;
    executeUniversalSMS(item.phone, text);
    onShowToast(lang === 'ar' ? `تم إرسال استفسار SMS إلى ${item.patientName}` : `Sent SMS to ${item.patientName}`, 'success');
  };

  const handleSendLabWhatsApp = (
    patient: Patient,
    testNameAr: string,
    frequencyLabel: string,
    fastingNote?: string
  ) => {
    if (patient.phoneUnavailable || !patient.phone || patient.phone === 'غير متوفر') {
      onShowToast(lang === 'ar' ? 'رقم الهاتف غير متوفر لهذا المريض' : 'Phone number unavailable for this patient', 'error');
      return;
    }
    const { encodedUrl } = generateLabTestWhatsAppReminder({
      patient,
      testNameAr,
      frequencyLabel,
      pharmacyName,
      fastingNote,
    });
    window.open(encodedUrl, '_blank');
    onShowToast(lang === 'ar' ? `تم فتح WhatsApp لإرسال تذكير فحص ${testNameAr}` : `Opened WhatsApp for ${testNameAr}`, 'success');
  };

  const filteredLabRadarAlerts = useMemo(() => {
    return patientsLabRadarAlerts.filter(({ lab }) => {
      if (labSubFilter === 'ALL') return true;
      if (labSubFilter === 'OVERDUE') return lab.status === 'overdue';
      if (labSubFilter === 'hba1c') return lab.testCategory === 'hba1c';
      if (labSubFilter === 'renal') return lab.testCategory === 'renal';
      if (labSubFilter === 'lipid') return lab.testCategory === 'lipid' || lab.testCategory === 'liver';
      if (labSubFilter === 'other') return lab.testCategory === 'thyroid' || lab.testCategory === 'urine_acr';
      return true;
    });
  }, [patientsLabRadarAlerts, labSubFilter]);

  return (
    <div className="space-y-2 sm:space-y-3 bg-transparent text-[#242424] dark:text-[#f3f2f1]">
      {/* Header and Explanation */}
      <div className="bg-[#FFFFFF] dark:bg-[#201f1e] border-b sm:border border-[#EDEBE9] dark:border-[#3b3a39] rounded-none sm:rounded-[4px] p-2.5 sm:p-3 space-y-2.5 -mt-px sm:mt-0">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
          <div>
            <div className="font-semibold text-base text-[#242424] dark:text-[#f3f2f1] flex items-center gap-2 tracking-tight">
              <Stethoscope className="w-4 h-4 text-[#0078D4]" />
              <span>{lang === 'ar' ? 'المتابعة السريرية ورادار التحاليل' : 'Clinical Follow-Up & Lab Surveillance'}</span>
            </div>
            <p className="text-[11px] text-[#605E5C] dark:text-[#a19f9d] mt-0.5 max-w-3xl leading-snug">
              {lang === 'ar'
                ? 'متابعة اليوم 3 و7 للمضادات ورادار الفحوصات المخبرية الدورية (HbA1c، ووظائف الكلى، والدهون) لضمان استقرار العلاج.'
                : 'Days 3 & 7 stewardship for antibiotics & Periodic Lab Radar for chronic safety.'}
            </p>
          </div>

          <button
            onClick={onOpenFollowUpModal}
            className="flex items-center gap-1 px-3 py-1.5 rounded-[4px] text-xs font-semibold bg-[#0078D4] hover:bg-[#106EBE] active:bg-[#005A9E] text-white transition-colors shrink-0 cursor-pointer shadow-none border-0 min-h-[44px]"
          >
            <Plus className="w-4 h-4" />
            <span>{lang === 'ar' ? 'إضافة متابعة' : 'Add Follow-Up'}</span>
          </button>
        </div>

        {/* Fluent UI Pivot Navigation Bar */}
        <div className="flex items-center gap-1 pt-2 border-t border-[#EDEBE9] dark:border-[#3b3a39] overflow-x-auto">
          {[
            { id: 'ALL', labelAr: 'الكل', labelEn: 'All' },
            { id: 'ACTIVE', labelAr: 'قيد المتابعة فقط', labelEn: 'Active Only' },
            {
              id: 'LAB_RADAR',
              labelAr: `رادار التحاليل الدورية (${patientsLabRadarAlerts.length})`,
              labelEn: `Lab Radar (${patientsLabRadarAlerts.length})`,
            },
            { id: 'ANTIBIOTIC', labelAr: 'المضادات الحيوية', labelEn: 'Antibiotics' },
            { id: 'CHRONIC', labelAr: 'العلاجات المزمنة الجديدة', labelEn: 'Chronic Therapies' },
            { id: 'RESOLVED', labelAr: 'المكتملة والمستقرة', labelEn: 'Resolved' },
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setFilterType(f.id)}
              className={`px-3 py-1.5 rounded-[4px] text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                filterType === f.id
                  ? 'border-b-2 border-[#0078D4] text-[#0078D4] bg-[#EFF6FC] dark:bg-[#112338]'
                  : 'text-[#605E5C] dark:text-[#a19f9d] hover:text-[#242424] dark:hover:text-[#f3f2f1] hover:bg-[#F3F2F1] dark:hover:bg-[#323130]'
              }`}
            >
              {lang === 'ar' ? f.labelAr : f.labelEn}
            </button>
          ))}
        </div>
      </div>

      {/* Content Table Container */}
      <div className="bg-[#FFFFFF] dark:bg-[#201f1e] border border-[#EDEBE9] dark:border-[#3b3a39] rounded-[4px] overflow-hidden space-y-0">
        {filterType === 'LAB_RADAR' ? (
          <div className="space-y-3 p-4">
            {/* Lab Sub-Filters Bar */}
            <div className="flex items-center justify-between flex-wrap gap-2 pb-3 border-b border-[#EDEBE9] dark:border-[#3b3a39]">
              <div className="flex items-center gap-1.5 overflow-x-auto text-xs">
                {[
                  { id: 'ALL', labelAr: `الكل (${patientsLabRadarAlerts.length})`, labelEn: 'All' },
                  {
                    id: 'OVERDUE',
                    labelAr: `عاجل ومتأخر (${patientsLabRadarAlerts.filter(i => i.lab.status === 'overdue').length})`,
                    labelEn: 'Overdue Only',
                  },
                  { id: 'hba1c', labelAr: 'السكر التراكمي (HbA1c)', labelEn: 'HbA1c' },
                  { id: 'renal', labelAr: 'وظائف الكلى والأملاح', labelEn: 'Renal / K+' },
                  { id: 'lipid', labelAr: 'دهون الدم وإنزيمات الكبد', labelEn: 'Lipids & Liver' },
                  { id: 'other', labelAr: 'الغدة وزلال البول', labelEn: 'Thyroid & Urine' },
                ].map(sub => (
                  <button
                    key={sub.id}
                    type="button"
                    onClick={() => setLabSubFilter(sub.id)}
                    className={`px-2.5 py-1 rounded-[4px] text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                      labSubFilter === sub.id
                        ? 'bg-[#0078D4] text-white'
                        : 'bg-[#FAF9F8] dark:bg-[#2d2c2c] text-[#242424] dark:text-[#f3f2f1] border border-[#EDEBE9] dark:border-[#3b3a39] hover:bg-[#F3F2F1] dark:hover:bg-[#323130]'
                    }`}
                  >
                    {lang === 'ar' ? sub.labelAr : sub.labelEn}
                  </button>
                ))}
              </div>

              <span className="text-[11px] text-[#605E5C] dark:text-[#a19f9d] font-mono">
                {lang === 'ar'
                  ? 'انقر على "تسجيل نتيجة" لفتح ملف المريض وحفظ القراءة'
                  : 'Click "Log Result" to open dossier and record lab values'}
              </span>
            </div>

            <div className="space-y-0">
              {/* Desktop View: Table with horizontal scroll */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-right dir-rtl text-xs border-collapse">
                  <thead className="bg-[#FAF9F8] dark:bg-[#2d2c2c] text-[#242424] dark:text-[#f3f2f1] font-semibold border-b border-[#EDEBE9] dark:border-[#3b3a39]">
                    <tr>
                      <th className="py-2.5 px-3 text-[11px] uppercase tracking-wider">{lang === 'ar' ? 'المريض' : 'Patient'}</th>
                      <th className="py-2.5 px-3 text-[11px] uppercase tracking-wider">{lang === 'ar' ? 'الهاتف' : 'Phone'}</th>
                      <th className="py-2.5 px-3 text-[11px] uppercase tracking-wider">{lang === 'ar' ? 'التحليل المخبري المستحق' : 'Required Lab Test'}</th>
                      <th className="py-2.5 px-3 text-[11px] uppercase tracking-wider">{lang === 'ar' ? 'الدواء / السبب' : 'Trigger Drug'}</th>
                      <th className="py-2.5 px-3 text-[11px] uppercase tracking-wider">{lang === 'ar' ? 'آخر فحص مسجل' : 'Last Result'}</th>
                      <th className="py-2.5 px-3 text-[11px] uppercase tracking-wider">{lang === 'ar' ? 'حالة الاستحقاق' : 'Urgency'}</th>
                      <th className="py-2.5 px-3 text-[11px] uppercase tracking-wider">{lang === 'ar' ? 'تعليمات الصيام' : 'Fasting'}</th>
                      <th className="py-2.5 px-3 text-[11px] uppercase tracking-wider text-center">{lang === 'ar' ? 'الإجراءات السريرية' : 'Actions'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EDEBE9] dark:divide-[#3b3a39] text-[#242424] dark:text-[#f3f2f1]">
                    {filteredLabRadarAlerts.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="text-center py-12 text-[#605E5C] dark:text-[#a19f9d]">
                          <div className="flex flex-col items-center gap-2">
                            <Microscope className="w-8 h-8 text-[#0078D4]" />
                            <span className="font-semibold text-sm text-[#242424] dark:text-[#f3f2f1]">
                              {lang === 'ar'
                                ? 'لا توجد تنبيهات فحوصات في هذا التصنيف حالياً.'
                                : 'No periodic laboratory alerts in this filter.'}
                            </span>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      filteredLabRadarAlerts.map(({ patient, lab }, idx) => (
                        <tr
                          key={`${patient.id}-${lab.id}-${idx}`}
                          className="hover:bg-[#F3F2F1] dark:hover:bg-[#323130] transition-colors"
                        >
                          <td className="py-2.5 px-3 font-semibold text-[#0078D4]">
                            {onOpenPatientModal ? (
                              <button
                                type="button"
                                onClick={() => onOpenPatientModal(patient.id, 'vitals')}
                                className="hover:underline font-semibold text-right cursor-pointer"
                                title={lang === 'ar' ? 'فتح ملف المريض السريري' : 'Open dossier'}
                              >
                                {patient.name}
                              </button>
                            ) : (
                              <span>{patient.name}</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-[#605E5C] dark:text-[#a19f9d]">
                            {patient.phone}
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="font-semibold text-[#242424] dark:text-[#f3f2f1]">{lab.testNameAr}</div>
                            <div className="text-[10px] text-[#605E5C] dark:text-[#a19f9d] font-mono">{lab.frequencyLabelAr}</div>
                          </td>
                          <td className="py-2.5 px-3">
                            {lab.triggerDrugs && lab.triggerDrugs.length > 0 ? (
                              <span className="px-2 py-0.5 rounded-[4px] bg-[#EFF6FC] dark:bg-[#112338] border border-[#C7E0F4] dark:border-[#1e4a6f] text-[#0078D4] text-[10px] font-mono font-semibold">
                                {lab.triggerDrugs[0]}
                              </span>
                            ) : (
                              <span className="text-[#605E5C] dark:text-[#a19f9d] text-[11px]">—</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3">
                            {lab.lastDoneDate ? (
                              <div className="font-mono text-[11px] text-[#242424] dark:text-[#f3f2f1] font-semibold">
                                {lab.lastDoneDate}{' '}
                                {lab.lastRecordedValue && (
                                  <span className="text-[#605E5C] dark:text-[#a19f9d]">({lab.lastRecordedValue})</span>
                                )}
                              </div>
                            ) : (
                              <span className="text-[#605E5C] dark:text-[#a19f9d] text-[10px]">
                                {lang === 'ar' ? 'لم يسجل سابقاً' : 'None'}
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3">
                            <span
                              className={`px-2 py-0.5 rounded-[4px] text-[10px] font-semibold font-mono whitespace-nowrap ${
                                lab.status === 'overdue'
                                  ? 'bg-[#FDF3F3] dark:bg-[#3a1d1d] text-[#A80000] dark:text-[#f1707b] border border-[#E0A8A8] dark:border-[#6e3535]'
                                  : 'bg-[#FFF4CE] dark:bg-[#3a3118] text-[#7A5B00] dark:text-[#f3d36b] border border-[#FFE699] dark:border-[#5a4c21]'
                              }`}
                            >
                              {lab.status === 'overdue'
                                ? `مستحق الآن (+${lab.daysOverdue} يوم)`
                                : 'مستحق قريباً'}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-[11px] text-[#605E5C] dark:text-[#a19f9d] max-w-xs leading-snug">
                            {lab.fastingNoteAr || (lab.requiresFasting ? 'يشترط الصيام' : 'لا يشترط صيام')}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <div className="flex items-center justify-center gap-1.5 flex-wrap">
                              {onOpenPatientModal && (
                                <button
                                  type="button"
                                  onClick={() => onOpenPatientModal(patient.id, 'vitals')}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-[4px] bg-[#0078D4] hover:bg-[#106EBE] text-white font-semibold text-xs transition-all cursor-pointer"
                                  title={lang === 'ar' ? 'تسجيل قراءة فحص مخبري جديدة لهذا المريض' : 'Log lab result'}
                                >
                                  <Plus className="w-3 h-3" />
                                  <span>{lang === 'ar' ? 'تسجيل نتيجة' : 'Log'}</span>
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() =>
                                  handleSendLabWhatsApp(
                                    patient,
                                    lab.testNameAr,
                                    lab.frequencyLabelAr,
                                    lab.fastingNoteAr
                                  )
                                }
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-[4px] bg-[#FFFFFF] dark:bg-[#252423] hover:bg-[#F3F2F1] dark:hover:bg-[#323130] text-[#242424] dark:text-[#f3f2f1] border border-[#EDEBE9] dark:border-[#3b3a39] font-semibold text-xs transition-all cursor-pointer"
                                title={lang === 'ar' ? 'إرسال تذكير واتساب للمريض بالتحليل' : 'WhatsApp Reminder'}
                              >
                                <Send className="w-3 h-3 text-[#0078D4]" />
                                <span>{lang === 'ar' ? 'واتساب' : 'WA'}</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Mobile View: Fixed Ultra-Compact Stacked Lab Radar Cards */}
              <div className="block md:hidden divide-y divide-[#EDEBE9] dark:divide-[#3b3a39]">
                {filteredLabRadarAlerts.length === 0 ? (
                  <div className="p-4 text-center text-xs text-[#605E5C] dark:text-[#a19f9d]">
                    {lang === 'ar' ? 'لا توجد تنبيهات فحوصات مطابقة' : 'No matching periodic lab alerts'}
                  </div>
                ) : (
                  filteredLabRadarAlerts.map(({ patient, lab }, idx) => (
                    <div key={`${patient.id}-${lab.id}-${idx}`} className="p-2.5 bg-white dark:bg-[#201f1e] space-y-1.5">
                      <div className="flex items-center justify-between gap-1.5">
                        <div className="min-w-0 flex-1">
                          {onOpenPatientModal ? (
                            <button
                              type="button"
                              onClick={() => onOpenPatientModal(patient.id, 'vitals')}
                              className="text-xs font-bold text-[#0078D4] hover:underline text-right block truncate"
                            >
                              {patient.name}
                            </button>
                          ) : (
                            <span className="text-xs font-bold text-[#242424] dark:text-[#f3f2f1] block truncate">{patient.name}</span>
                          )}
                          <span className="font-mono text-[9px] text-[#605E5C] dark:text-[#a19f9d]" dir="ltr">{patient.phone}</span>
                        </div>
                        <span className={`px-1.5 py-0.5 rounded-[4px] text-[9px] font-semibold font-mono whitespace-nowrap ${
                          lab.status === 'overdue' ? 'bg-[#FDF3F3] text-[#A80000] border border-[#E0A8A8]' : 'bg-[#FFF4CE] text-[#7A5B00] border border-[#FFE699]'
                        }`}>
                          {lab.status === 'overdue' ? `مستحق (+${lab.daysOverdue}d)` : 'مستحق قريباً'}
                        </span>
                      </div>

                      <div className="text-[11px] font-semibold text-[#242424] dark:text-[#f3f2f1]">
                        {lab.testNameAr} <span className="text-[9px] text-[#605E5C] dark:text-[#a19f9d] font-mono">({lab.frequencyLabelAr})</span>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                        {lab.triggerDrugs && lab.triggerDrugs.length > 0 && (
                          <span className="px-1.5 py-0.2 rounded-[4px] bg-[#EFF6FC] dark:bg-[#112338] text-[#0078D4] border border-[#C7E0F4] dark:border-[#1e4a6f] font-mono text-[9px]">
                            {lab.triggerDrugs[0]}
                          </span>
                        )}
                        <span className="text-[#605E5C] dark:text-[#a19f9d] text-[9px]">
                          {lab.fastingNoteAr || (lab.requiresFasting ? 'صيام مطلوب' : 'بدون صيام')}
                        </span>
                      </div>

                      <div className="flex items-center justify-end gap-1.5 pt-1">
                        {onOpenPatientModal && (
                          <button
                            type="button"
                            onClick={() => onOpenPatientModal(patient.id, 'vitals')}
                            className="px-2.5 py-1 rounded-[4px] bg-[#0078D4] hover:bg-[#106EBE] text-white font-semibold text-[11px] flex items-center gap-1 cursor-pointer"
                          >
                            <Plus className="w-3 h-3" />
                            <span>{lang === 'ar' ? 'تسجيل' : 'Log'}</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleSendLabWhatsApp(patient, lab.testNameAr, lab.frequencyLabelAr, lab.fastingNoteAr)}
                          className="px-2.5 py-1 rounded-[4px] bg-[#FFFFFF] dark:bg-[#252423] text-[#0078D4] border border-[#0078D4] font-semibold text-[11px] flex items-center gap-1 cursor-pointer"
                        >
                          <Send className="w-3 h-3" />
                          <span>WhatsApp</span>
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-0">
            {/* Desktop View: Table with horizontal scroll */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-right dir-rtl text-xs border-collapse">
                <thead className="bg-[#FAF9F8] dark:bg-[#2d2c2c] text-[#242424] dark:text-[#f3f2f1] font-semibold border-b border-[#EDEBE9] dark:border-[#3b3a39]">
                  <tr>
                    <th className="py-2.5 px-3 text-[11px] uppercase tracking-wider">{lang === 'ar' ? 'المريض' : 'Patient'}</th>
                    <th className="py-2.5 px-3 text-[11px] uppercase tracking-wider">{lang === 'ar' ? 'الهاتف' : 'Phone'}</th>
                    <th className="py-2.5 px-3 text-[11px] uppercase tracking-wider">{lang === 'ar' ? 'نوع المتابعة' : 'Category'}</th>
                    <th className="py-2.5 px-3 text-[11px] uppercase tracking-wider">{lang === 'ar' ? 'العلاج / الدواء' : 'Target Medication'}</th>
                    <th className="py-2.5 px-3 text-[11px] uppercase tracking-wider">{lang === 'ar' ? 'موعد المتابعة' : 'Milestone Due'}</th>
                    <th className="py-2.5 px-3 text-[11px] uppercase tracking-wider">{lang === 'ar' ? 'الحالة السريرية' : 'Status'}</th>
                    <th className="py-2.5 px-3 text-[11px] uppercase tracking-wider text-center">{lang === 'ar' ? 'إجراءات التواصل' : 'Clinical Actions'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EDEBE9] dark:divide-[#3b3a39] text-[#242424] dark:text-[#f3f2f1]">
                {followUps.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-[#605E5C] dark:text-[#a19f9d]">
                      <div className="max-w-sm mx-auto space-y-3">
                        <div className="w-10 h-10 rounded-[4px] bg-[#FAF9F8] dark:bg-[#2d2c2c] border border-[#EDEBE9] dark:border-[#3b3a39] flex items-center justify-center mx-auto text-[#0078D4]">
                          <Stethoscope className="w-5 h-5" />
                        </div>
                        <div className="font-semibold text-sm text-[#242424] dark:text-[#f3f2f1]">
                          {lang === 'ar' ? 'سجل المتابعات السريرية فارغ' : 'No Follow-Ups Yet'}
                        </div>
                        <p className="text-xs text-[#605E5C] dark:text-[#a19f9d] leading-relaxed">
                          {lang === 'ar'
                            ? 'يمكنك جدولة مواعيد متابعة للمضادات الحيوية (اليوم 3/7) أو مراقبة استقرار الأدوية المزمنة.'
                            : 'Schedule antibiotic stewardship checks or chronic titration follow-ups.'}
                        </p>
                        <button
                          onClick={onOpenFollowUpModal}
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-[4px] text-xs font-semibold bg-[#0078D4] hover:bg-[#106EBE] active:bg-[#005A9E] text-white transition-all cursor-pointer mt-1"
                        >
                          <Plus className="w-4 h-4" />
                          <span>{lang === 'ar' ? 'تسجيل متابعة سريرية جديدة' : 'Add First Follow-Up'}</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-10 text-[#605E5C] dark:text-[#a19f9d]">
                      {lang === 'ar' ? 'لا توجد حالات متابعة مسجلة مطابقة للفلتر.' : 'No clinical follow-ups found.'}
                    </td>
                  </tr>
                ) : (
                  filtered.map(item => {
                    const nowYMD = new Date().toISOString().split('T')[0];
                    const isDue = item.dueDate <= nowYMD;

                    return (
                      <tr
                        key={item.id}
                        className="hover:bg-[#F3F2F1] dark:hover:bg-[#323130] transition-colors"
                      >
                        <td className="py-2.5 px-3 font-semibold text-[#242424] dark:text-[#f3f2f1]">
                          {item.patientName}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[#605E5C] dark:text-[#a19f9d]">
                          {item.phone}
                        </td>
                        <td className="py-2.5 px-3">
                          {item.type === 'ANTIBIOTIC' ? (
                            <span className="inline-flex items-center gap-1 font-semibold px-2 py-0.5 rounded-[4px] text-[11px] bg-[#EFF6FC] dark:bg-[#112338] text-[#0078D4] border border-[#C7E0F4] dark:border-[#1e4a6f]">
                              <span>{lang === 'ar' ? 'مضاد حيوي' : 'Antibiotic'}</span>
                            </span>
                          ) : item.type === 'CHRONIC_INIT' ? (
                            <span className="inline-flex items-center gap-1 font-semibold px-2 py-0.5 rounded-[4px] text-[11px] bg-[#FAF9F8] dark:bg-[#2d2c2c] text-[#242424] dark:text-[#f3f2f1] border border-[#EDEBE9] dark:border-[#3b3a39]">
                              <span>{lang === 'ar' ? 'علاج مزمن جديد' : 'New Therapy'}</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 font-semibold px-2 py-0.5 rounded-[4px] text-[11px] bg-[#FAF9F8] dark:bg-[#2d2c2c] text-[#242424] dark:text-[#f3f2f1] border border-[#EDEBE9] dark:border-[#3b3a39]">
                              <span>{lang === 'ar' ? 'معايرة جرعة' : 'Titration'}</span>
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3">
                          <strong className="text-[#242424] dark:text-[#f3f2f1] font-semibold">{item.drug}</strong>
                          {item.notes && (
                            <div className="text-[11px] text-[#605E5C] dark:text-[#a19f9d] mt-0.5 max-w-xs truncate">
                              {item.notes}
                            </div>
                          )}
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="font-mono font-semibold text-[#242424] dark:text-[#f3f2f1]">
                            {item.dueDate}
                          </div>
                          <div className="text-[10px] text-[#605E5C] dark:text-[#a19f9d]">
                            {lang === 'ar' ? `مرحلة اليوم ${item.daysOffset}` : `Day ${item.daysOffset} milestone`}
                          </div>
                        </td>
                        <td className="py-2.5 px-3">
                          {item.resolved ? (
                            <span className="inline-flex items-center gap-1 font-semibold px-2 py-0.5 rounded-[4px] text-[11px] bg-[#EFF6FC] dark:bg-[#112338] text-[#0078D4] border border-[#C7E0F4] dark:border-[#1e4a6f]">
                              <ShieldCheck className="w-3.5 h-3.5" />
                              <span>{lang === 'ar' ? 'تمت المتابعة والاستقرار' : 'Resolved'}</span>
                            </span>
                          ) : isDue ? (
                            <span className="inline-flex items-center gap-1 font-semibold px-2 py-0.5 rounded-[4px] text-[11px] bg-[#FDF3F3] dark:bg-[#3a1d1d] text-[#A80000] dark:text-[#f1707b] border border-[#E0A8A8] dark:border-[#6e3535]">
                              <Clock className="w-3.5 h-3.5" />
                              <span>{lang === 'ar' ? 'مستحقة المتابعة الآن' : 'Due Today'}</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 font-semibold px-2 py-0.5 rounded-[4px] text-[11px] bg-[#FAF9F8] dark:bg-[#2d2c2c] text-[#605E5C] dark:text-[#a19f9d] border border-[#EDEBE9] dark:border-[#3b3a39]">
                              <span>قيد الانتظار</span>
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => handleSendWhatsApp(item)}
                              title={lang === 'ar' ? 'إرسال استفسار سريري عبر WhatsApp' : 'Send WhatsApp Check-in'}
                              className="p-1 rounded-[4px] bg-[#FFFFFF] dark:bg-[#252423] hover:bg-[#F3F2F1] dark:hover:bg-[#323130] text-[#0078D4] border border-[#EDEBE9] dark:border-[#3b3a39] transition-colors cursor-pointer"
                            >
                              <MessageSquare className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleSendSMS(item)}
                              title={lang === 'ar' ? 'إرسال استفسار سريري عبر SMS' : 'Send SMS'}
                              className="p-1 rounded-[4px] bg-[#FFFFFF] dark:bg-[#252423] hover:bg-[#F3F2F1] dark:hover:bg-[#323130] text-[#242424] dark:text-[#f3f2f1] border border-[#EDEBE9] dark:border-[#3b3a39] transition-colors cursor-pointer"
                            >
                              <Send className="w-3.5 h-3.5" />
                            </button>
                            {!item.resolved && (
                              <button
                                onClick={() => onResolveFollowUp(item.id)}
                                title={lang === 'ar' ? 'تحديد كمكتملة ومستقرة' : 'Mark as Resolved'}
                                className="flex items-center gap-1 px-2.5 py-1 rounded-[4px] bg-[#0078D4] text-white hover:bg-[#106EBE] text-xs font-semibold transition-colors cursor-pointer"
                              >
                                <CheckCircle className="w-3.5 h-3.5" />
                                <span>{lang === 'ar' ? 'تم التقييم' : 'Resolve'}</span>
                              </button>
                            )}
                            <button
                              onClick={() => onDeleteFollowUp(item.id)}
                              title={lang === 'ar' ? 'حذف السجل' : 'Delete'}
                              className="p-1 rounded-[4px] bg-[#FFFFFF] dark:bg-[#252423] hover:bg-[#FDF3F3] dark:hover:bg-[#3a1d1d] text-[#605E5C] dark:text-[#a19f9d] hover:text-[#A80000] dark:hover:text-[#f1707b] border border-[#EDEBE9] dark:border-[#3b3a39] hover:border-[#E0A8A8] dark:hover:border-[#6e3535] transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile View: Fixed Ultra-Compact Stacked Follow-Up Cards */}
          <div className="block md:hidden divide-y divide-[#EDEBE9] dark:divide-[#3b3a39]">
            {filtered.length === 0 ? (
              <div className="p-4 text-center text-xs text-[#605E5C] dark:text-[#a19f9d]">
                {lang === 'ar' ? 'لا توجد حالات متابعة مسجلة' : 'No follow-up records found'}
              </div>
            ) : (
              filtered.map(item => {
                const nowYMD = new Date().toISOString().split('T')[0];
                const isDue = item.dueDate <= nowYMD;

                return (
                  <div key={item.id} className="p-2.5 bg-white dark:bg-[#201f1e] space-y-1.5">
                    <div className="flex items-center justify-between gap-1.5">
                      <div className="min-w-0 flex-1">
                        <span className="text-xs font-bold text-[#242424] dark:text-[#f3f2f1] block truncate">{item.patientName}</span>
                        <span className="font-mono text-[9px] text-[#605E5C] dark:text-[#a19f9d]" dir="ltr">{item.phone}</span>
                      </div>
                      <span className={`px-1.5 py-0.5 rounded-[4px] text-[9px] font-semibold font-mono whitespace-nowrap ${
                        item.resolved ? 'bg-[#EFF6FC] text-[#0078D4] border border-[#C7E0F4]' : isDue ? 'bg-[#FDF3F3] text-[#A80000] border border-[#E0A8A8]' : 'bg-[#FAF9F8] text-[#605E5C] border border-[#EDEBE9]'
                      }`}>
                        {item.resolved ? 'مستقر' : isDue ? 'مستحق اليوم' : 'قيد الانتظار'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-1 text-[11px]">
                      <div>
                        <strong className="text-[#242424] dark:text-[#f3f2f1] font-semibold">{item.drug}</strong>
                        <span className="text-[10px] text-[#605E5C] dark:text-[#a19f9d] ml-1.5">({item.type === 'ANTIBIOTIC' ? 'مضاد' : 'مزمن'})</span>
                      </div>
                      <span className="font-mono text-[10px] text-[#0078D4] font-semibold">{item.dueDate}</span>
                    </div>

                    <div className="flex items-center justify-end gap-1.5 pt-1 flex-wrap">
                      <button
                        onClick={() => handleSendWhatsApp(item)}
                        className="px-2 py-1 rounded-[4px] bg-[#FFFFFF] dark:bg-[#252423] text-[#0078D4] border border-[#0078D4] text-[10px] font-semibold flex items-center gap-1 cursor-pointer"
                      >
                        <MessageSquare className="w-3 h-3" />
                        <span>WA</span>
                      </button>
                      <button
                        onClick={() => handleSendSMS(item)}
                        className="px-2 py-1 rounded-[4px] bg-[#FFFFFF] dark:bg-[#252423] text-[#242424] dark:text-[#f3f2f1] border border-[#EDEBE9] dark:border-[#3b3a39] text-[10px] font-semibold flex items-center gap-1 cursor-pointer"
                      >
                        <Send className="w-3 h-3" />
                        <span>SMS</span>
                      </button>
                      {!item.resolved && (
                        <button
                          onClick={() => onResolveFollowUp(item.id)}
                          className="px-2.5 py-1 rounded-[4px] bg-[#0078D4] text-white text-[10px] font-semibold flex items-center gap-1 cursor-pointer"
                        >
                          <CheckCircle className="w-3 h-3" />
                          <span>{lang === 'ar' ? 'تم' : 'Resolve'}</span>
                        </button>
                      )}
                      <button
                        onClick={() => onDeleteFollowUp(item.id)}
                        className="p-1 rounded-[4px] bg-[#FFFFFF] dark:bg-[#252423] text-[#605E5C] hover:text-[#A80000] border border-[#EDEBE9] dark:border-[#3b3a39] cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
          </div>
        )}
      </div>
    </div>
  );
};
