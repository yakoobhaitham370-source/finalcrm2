import React, { useState } from 'react';
import {
  Microscope,
  Send,
  Plus,
  Trash2,
  CheckCircle2,
  FileCheck2,
  Activity,
} from 'lucide-react';
import { Patient, LabResultEntry, LabTestCategory } from '../../types/pharmacy';
import {
  getPatientLabRadar,
  generateLabTestWhatsAppReminder,
  LabRadarItem,
} from '../../utils/clinicalIntelligence';
import { formatYMD } from '../../utils/pharmacyCalculations';

interface LabTrackerPanelProps {
  patient: Patient;
  pharmacyName: string;
  lang: 'ar' | 'en';
  onUpdatePatientLabResults: (labResults: LabResultEntry[]) => void;
  onShowToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

interface TestPreset {
  category: LabTestCategory;
  nameAr: string;
  nameEn: string;
  unit: string;
  defaultRef: string;
  evaluate: (val: number) => 'normal' | 'borderline' | 'abnormal' | 'critical';
}

const COMMON_PRESETS: TestPreset[] = [
  {
    category: 'hba1c',
    nameAr: 'السكر التراكمي (HbA1c)',
    nameEn: 'Glycated Hemoglobin (HbA1c)',
    unit: '%',
    defaultRef: '< 7.0%',
    evaluate: (v) => (v < 7.0 ? 'normal' : v <= 8.5 ? 'borderline' : 'critical'),
  },
  {
    category: 'renal',
    nameAr: 'الكرياتينين (Serum Creatinine)',
    nameEn: 'Serum Creatinine',
    unit: 'mg/dL',
    defaultRef: '0.7 - 1.2 mg/dL',
    evaluate: (v) => (v <= 1.2 ? 'normal' : v <= 1.8 ? 'abnormal' : 'critical'),
  },
  {
    category: 'renal',
    nameAr: 'اليوريا (Blood Urea)',
    nameEn: 'Blood Urea',
    unit: 'mg/dL',
    defaultRef: '15 - 45 mg/dL',
    evaluate: (v) => (v <= 45 ? 'normal' : v <= 70 ? 'abnormal' : 'critical'),
  },
  {
    category: 'renal',
    nameAr: 'معدل الترشيح الكبيبي (eGFR)',
    nameEn: 'Estimated GFR (eGFR)',
    unit: 'mL/min',
    defaultRef: '> 60 mL/min',
    evaluate: (v) => (v >= 60 ? 'normal' : v >= 30 ? 'abnormal' : 'critical'),
  },
  {
    category: 'electrolyte',
    nameAr: 'البوتاسيوم (Serum Potassium K+)',
    nameEn: 'Serum Potassium (K+)',
    unit: 'mEq/L',
    defaultRef: '3.5 - 5.0 mEq/L',
    evaluate: (v) => (v >= 3.5 && v <= 5.0 ? 'normal' : v < 3.5 ? 'borderline' : 'critical'),
  },
  {
    category: 'lipid',
    nameAr: 'الكولسترول الضار (LDL-C)',
    nameEn: 'LDL Cholesterol',
    unit: 'mg/dL',
    defaultRef: '< 70 mg/dL',
    evaluate: (v) => (v < 70 ? 'normal' : v <= 100 ? 'borderline' : 'abnormal'),
  },
  {
    category: 'lipid',
    nameAr: 'الدهون الثلاثية (Triglycerides)',
    nameEn: 'Triglycerides',
    unit: 'mg/dL',
    defaultRef: '< 150 mg/dL',
    evaluate: (v) => (v < 150 ? 'normal' : v <= 200 ? 'borderline' : 'abnormal'),
  },
  {
    category: 'lipid',
    nameAr: 'الكولسترول الكلي (Total Cholesterol)',
    nameEn: 'Total Cholesterol',
    unit: 'mg/dL',
    defaultRef: '< 200 mg/dL',
    evaluate: (v) => (v < 200 ? 'normal' : v <= 240 ? 'borderline' : 'abnormal'),
  },
  {
    category: 'liver',
    nameAr: 'إنزيم الكبد (ALT / SGPT)',
    nameEn: 'Alanine Aminotransferase (ALT)',
    unit: 'U/L',
    defaultRef: '< 45 U/L',
    evaluate: (v) => (v <= 45 ? 'normal' : v <= 90 ? 'borderline' : 'critical'),
  },
  {
    category: 'thyroid',
    nameAr: 'هرمون الغدة الدرقية (TSH)',
    nameEn: 'Thyroid Stimulating Hormone (TSH)',
    unit: 'uIU/mL',
    defaultRef: '0.4 - 4.0 uIU/mL',
    evaluate: (v) => (v >= 0.4 && v <= 4.0 ? 'normal' : 'abnormal'),
  },
  {
    category: 'urine_acr',
    nameAr: 'زلال البول الدقيق (Microalbumin/Cr Ratio)',
    nameEn: 'Urine Albumin/Creatinine Ratio (ACR)',
    unit: 'mg/g',
    defaultRef: '< 30 mg/g',
    evaluate: (v) => (v < 30 ? 'normal' : v <= 300 ? 'abnormal' : 'critical'),
  },
  {
    category: 'cbc',
    nameAr: 'خضاب الدم (Hemoglobin Hb)',
    nameEn: 'Hemoglobin (Hb)',
    unit: 'g/dL',
    defaultRef: '12.0 - 16.0 g/dL',
    evaluate: (v) => (v >= 12.0 ? 'normal' : v >= 10.0 ? 'borderline' : 'critical'),
  },
];

export const LabTrackerPanel: React.FC<LabTrackerPanelProps> = ({
  patient,
  pharmacyName,
  lang,
  onUpdatePatientLabResults,
  onShowToast,
}) => {
  const [selectedPresetIndex, setSelectedPresetIndex] = useState<number>(0);
  const [customTestName, setCustomTestName] = useState('');
  const [dateStr, setDateStr] = useState(() => formatYMD(new Date()));
  const [numericVal, setNumericVal] = useState('');
  const [unitStr, setUnitStr] = useState(COMMON_PRESETS[0].unit);
  const [refRangeStr, setRefRangeStr] = useState(COMMON_PRESETS[0].defaultRef);
  const [manualStatus, setManualStatus] = useState<LabResultEntry['status']>('normal');
  const [labName] = useState('');
  const [notes, setNotes] = useState('');
  const [filterCategory] = useState<string>('ALL');

  const labRadarItems = getPatientLabRadar(patient);

  const handleSelectPreset = (idx: number) => {
    setSelectedPresetIndex(idx);
    if (idx === -1) {
      setCustomTestName('');
      setUnitStr('');
      setRefRangeStr('');
      setManualStatus('normal');
      return;
    }
    const preset = COMMON_PRESETS[idx];
    if (preset) {
      setCustomTestName(preset.nameAr);
      setUnitStr(preset.unit);
      setRefRangeStr(preset.defaultRef);
      if (numericVal && !isNaN(parseFloat(numericVal))) {
        setManualStatus(preset.evaluate(parseFloat(numericVal)));
      }
    }
  };

  const handleNumericChange = (val: string) => {
    setNumericVal(val);
    if (selectedPresetIndex >= 0 && val.trim() !== '') {
      const num = parseFloat(val);
      if (!isNaN(num)) {
        const preset = COMMON_PRESETS[selectedPresetIndex];
        if (preset) {
          setManualStatus(preset.evaluate(num));
        }
      }
    }
  };

  const handleQuickFillFromRadar = (item: LabRadarItem) => {
    const presetIdx = COMMON_PRESETS.findIndex((p) => p.category === item.testCategory);
    if (presetIdx !== -1) {
      handleSelectPreset(presetIdx);
    } else {
      setSelectedPresetIndex(-1);
      setCustomTestName(item.testNameAr);
      setUnitStr('');
      setRefRangeStr(item.referenceTarget || '');
    }
    onShowToast(
      lang === 'ar'
        ? `تم تجهيز نموذج تسجيل (${item.testNameAr})`
        : `Ready to record ${item.testNameEn}`,
      'info'
    );
  };

  const handleSaveLabResult = () => {
    const finalTestName =
      selectedPresetIndex >= 0
        ? COMMON_PRESETS[selectedPresetIndex].nameAr
        : customTestName.trim();

    if (!finalTestName) {
      onShowToast(lang === 'ar' ? 'يرجى تحديد أو كتابة اسم الفحص' : 'Enter test name', 'error');
      return;
    }

    const parsedNum = parseFloat(numericVal);
    const newEntry: LabResultEntry = {
      id: 'lab-' + Date.now(),
      date: dateStr || formatYMD(new Date()),
      testCategory:
        selectedPresetIndex >= 0
          ? COMMON_PRESETS[selectedPresetIndex].category
          : 'other',
      testName: finalTestName,
      numericValue: isNaN(parsedNum) ? undefined : parsedNum,
      unit: unitStr.trim() || undefined,
      referenceRange: refRangeStr.trim() || undefined,
      status: manualStatus,
      labName: labName.trim() || undefined,
      notes: notes.trim() || undefined,
      createdAt: new Date().toISOString(),
    };

    const currentList = patient.labResults || [];
    const updatedList = [newEntry, ...currentList];
    onUpdatePatientLabResults(updatedList);

    setNumericVal('');
    setNotes('');
    onShowToast(
      lang === 'ar'
        ? `تم تسجيل وحفظ فحص (${finalTestName}) بنجاح`
        : `Saved ${finalTestName} successfully`,
      'success'
    );
  };

  const handleDeleteLabResult = (id: string) => {
    const currentList = patient.labResults || [];
    const updated = currentList.filter((l) => l.id !== id);
    onUpdatePatientLabResults(updated);
    onShowToast(lang === 'ar' ? 'تم حذف القراءة المخبرية' : 'Test record deleted', 'info');
  };

  const handleSendWhatsAppReminder = (item: LabRadarItem) => {
    if (!patient.phone) {
      onShowToast(lang === 'ar' ? 'رقم هاتف المريض غير مسجل' : 'No phone number', 'error');
      return;
    }
    const { encodedUrl } = generateLabTestWhatsAppReminder({
      patient,
      testNameAr: item.testNameAr,
      frequencyLabel: item.frequencyLabelAr,
      pharmacyName,
      fastingNote: item.fastingNoteAr,
    });
    window.open(encodedUrl, '_blank');
    onShowToast(
      lang === 'ar'
        ? `تم فتح WhatsApp لإرسال تذكير (${item.testNameAr})`
        : `Opened WhatsApp for ${item.testNameEn}`,
      'success'
    );
  };

  const recordedLabs = (patient.labResults || []).filter((l) => {
    if (filterCategory === 'ALL') return true;
    return l.testCategory === filterCategory;
  });

  return (
    <div className="space-y-4 bg-transparent text-[#242424] dark:text-[#f3f2f1]">
      {/* SECTION 1: SURVEILLANCE RADAR */}
      <div className="space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Microscope className="w-5 h-5 text-[#0078D4] dark:text-[#2899f5]" />
            <div>
              <h4 className="font-semibold text-sm text-[#242424] dark:text-[#f3f2f1]">
                {lang === 'ar'
                  ? 'رادار استحقاق الفحوصات الدورية للمريض'
                  : 'Periodic Clinical Lab Surveillance Radar'}
              </h4>
            </div>
          </div>
        </div>

        {labRadarItems.length === 0 ? (
          <div className="p-5 text-center bg-[#FAF9F8] dark:bg-[#2d2c2c] rounded-[4px] border border-[#EDEBE9] dark:border-[#3b3a39]">
            <CheckCircle2 className="w-7 h-7 text-[#0078D4] dark:text-[#2899f5] mx-auto mb-1.5" />
            <p className="text-xs text-[#605E5C] dark:text-[#a19f9d] font-semibold">
              {lang === 'ar'
                ? 'لا توجد متطلبات فحوصات دورية خاصة بالأدوية الحالية للمريض.'
                : 'No mandatory lab surveillance for current medication profile.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {labRadarItems.map((item) => (
              <div
                key={item.id}
                className="p-3.5 rounded-[4px] border border-[#EDEBE9] dark:border-[#3b3a39] bg-[#FFFFFF] dark:bg-[#201f1e] hover:border-[#0078D4] dark:hover:border-[#2899f5] transition-colors flex flex-col justify-between gap-3"
              >
                <div className="space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-0.5">
                      <div className="font-semibold text-sm text-[#242424] dark:text-[#f3f2f1]">
                        <span>{item.testNameAr}</span>
                      </div>
                      <div className="text-[10px] text-[#605E5C] dark:text-[#a19f9d] font-mono">
                        {item.testNameEn}
                      </div>
                    </div>

                    <span
                      className={`px-2 py-0.5 rounded-[4px] text-[10px] font-semibold font-mono ${
                        item.status === 'overdue'
                          ? 'bg-[#FDF3F3] dark:bg-[#3a1d1d] text-[#A80000] dark:text-[#f1707b] border border-[#E0A8A8] dark:border-[#6e3535]'
                          : 'bg-[#FFF4CE] dark:bg-[#3a3118] text-[#7A5B00] dark:text-[#f3d370] border border-[#FFE699] dark:border-[#6a5a20]'
                      }`}
                    >
                      {item.status === 'overdue'
                        ? `مستحق الآن (+${item.daysOverdue} يوم)`
                        : 'مستحق قريباً'}
                    </span>
                  </div>

                  <div className="text-[11px] text-[#605E5C] dark:text-[#a19f9d] leading-snug">
                    {item.clinicalRationaleAr}
                  </div>
                </div>

                <div className="pt-2 border-t border-[#EDEBE9] dark:border-[#3b3a39] flex items-center justify-between gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => handleQuickFillFromRadar(item)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-[4px] bg-[#0078D4] hover:bg-[#106EBE] text-white font-semibold text-[11px] transition-colors cursor-pointer"
                  >
                    <Plus className="w-3 h-3 text-white" />
                    <span>{lang === 'ar' ? 'تسجيل نتيجة الفحص' : 'Log Result'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSendWhatsAppReminder(item)}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-[4px] bg-[#FFFFFF] dark:bg-[#252423] hover:bg-[#F3F2F1] dark:hover:bg-[#3b3a39] text-[#0078D4] dark:text-[#2899f5] border border-[#EDEBE9] dark:border-[#3b3a39] font-semibold text-[11px] transition-colors cursor-pointer"
                  >
                    <Send className="w-3 h-3 text-[#0078D4] dark:text-[#2899f5]" />
                    <span>{lang === 'ar' ? 'تذكير واتساب' : 'WhatsApp'}</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* SECTION 2: FAST CLINICAL LAB TEST LOGGER */}
      <div className="bg-[#FAF9F8] dark:bg-[#2d2c2c] p-3.5 rounded-[4px] border border-[#EDEBE9] dark:border-[#3b3a39] space-y-3 text-[#242424] dark:text-[#f3f2f1]">
        <div className="flex items-center justify-between">
          <div className="font-semibold text-sm text-[#242424] dark:text-[#f3f2f1] flex items-center gap-2">
            <FileCheck2 className="w-4 h-4 text-[#0078D4] dark:text-[#2899f5]" />
            <span>{lang === 'ar' ? 'تسجيل قراءة فحص مخبري جديدة' : 'Log New Lab Test Result'}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="space-y-1">
            <label className="text-[11px] text-[#605E5C] dark:text-[#a19f9d] font-semibold">
              {lang === 'ar' ? 'اختر التحليل من القائمة' : 'Select Lab Test'}
            </label>
            <select
              value={selectedPresetIndex}
              onChange={(e) => handleSelectPreset(parseInt(e.target.value, 10))}
              className="w-full bg-[#FFFFFF] dark:bg-[#201f1e] border border-[#EDEBE9] dark:border-[#3b3a39] p-2 rounded-[4px] text-[#242424] dark:text-[#f3f2f1] text-xs font-semibold outline-none focus:border-[#0078D4] dark:focus:border-[#2899f5]"
            >
              {COMMON_PRESETS.map((p, idx) => (
                <option key={idx} value={idx}>
                  {p.nameAr}
                </option>
              ))}
              <option value={-1}>{lang === 'ar' ? 'فحص مخصص آخر...' : 'Other Custom...'}</option>
            </select>
          </div>

          {selectedPresetIndex === -1 && (
            <div className="space-y-1">
              <label className="text-[11px] text-[#605E5C] dark:text-[#a19f9d] font-semibold">
                {lang === 'ar' ? 'اسم الفحص المخصص' : 'Custom Test Name'}
              </label>
              <input
                type="text"
                value={customTestName}
                onChange={(e) => setCustomTestName(e.target.value)}
                className="w-full bg-[#FFFFFF] dark:bg-[#201f1e] border border-[#EDEBE9] dark:border-[#3b3a39] p-2 rounded-[4px] text-[#242424] dark:text-[#f3f2f1] text-xs outline-none focus:border-[#0078D4] dark:focus:border-[#2899f5]"
              />
            </div>
          )}

          <div className="space-y-1">
            <label className="text-[11px] text-[#605E5C] dark:text-[#a19f9d] font-semibold">
              {lang === 'ar' ? 'تاريخ إجراء الفحص' : 'Date of Test'}
            </label>
            <input
              type="date"
              value={dateStr}
              onChange={(e) => setDateStr(e.target.value)}
              className="w-full bg-[#FFFFFF] dark:bg-[#201f1e] border border-[#EDEBE9] dark:border-[#3b3a39] p-2 rounded-[4px] text-[#242424] dark:text-[#f3f2f1] text-xs font-mono outline-none focus:border-[#0078D4] dark:focus:border-[#2899f5]"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] text-[#605E5C] dark:text-[#a19f9d] font-semibold">
              <span>{lang === 'ar' ? 'النتيجة / القيمة' : 'Value'}</span>
            </label>
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                step="any"
                value={numericVal}
                onChange={(e) => handleNumericChange(e.target.value)}
                className="w-full bg-[#FFFFFF] dark:bg-[#201f1e] border border-[#EDEBE9] dark:border-[#3b3a39] p-2 rounded-[4px] text-[#242424] dark:text-[#f3f2f1] text-xs font-bold font-mono text-center outline-none focus:border-[#0078D4] dark:focus:border-[#2899f5]"
              />
              <input
                type="text"
                value={unitStr}
                onChange={(e) => setUnitStr(e.target.value)}
                className="w-20 bg-[#FFFFFF] dark:bg-[#201f1e] border border-[#EDEBE9] dark:border-[#3b3a39] p-2 rounded-[4px] text-[#242424] dark:text-[#f3f2f1] text-xs text-center font-mono outline-none focus:border-[#0078D4] dark:focus:border-[#2899f5]"
              />
            </div>
          </div>
        </div>

        <div className="pt-2 flex justify-end">
          <button
            type="button"
            onClick={handleSaveLabResult}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-[4px] bg-[#0078D4] hover:bg-[#106EBE] active:bg-[#005A9E] text-white font-semibold text-xs transition-all cursor-pointer border-0 shadow-none"
          >
            <Plus className="w-3.5 h-3.5 text-white" />
            <span>{lang === 'ar' ? 'حفظ نتيجة الفحص' : 'Save Lab Test Entry'}</span>
          </button>
        </div>
      </div>

      {/* SECTION 3: HISTORICAL LAB RESULTS TABLE */}
      <div className="space-y-3">
        <div className="font-semibold text-sm text-[#242424] dark:text-[#f3f2f1] flex items-center gap-2">
          <Activity className="w-4 h-4 text-[#0078D4] dark:text-[#2899f5]" />
          <span>
            {lang === 'ar'
              ? `سجل التحاليل المخبرية السابقة للمريض (${(patient.labResults || []).length})`
              : `Lab Test History (${(patient.labResults || []).length})`}
          </span>
        </div>

        <div className="border border-[#EDEBE9] dark:border-[#3b3a39] rounded-[4px] overflow-hidden bg-[#FFFFFF] dark:bg-[#201f1e]">
          <table className="w-full text-right dir-rtl text-xs border-collapse">
            <thead className="bg-[#FAF9F8] dark:bg-[#2d2c2c] text-[#242424] dark:text-[#f3f2f1] font-semibold border-b border-[#EDEBE9] dark:border-[#3b3a39]">
              <tr>
                <th className="py-2.5 px-3 text-[11px] uppercase tracking-wider">{lang === 'ar' ? 'التاريخ' : 'Date'}</th>
                <th className="py-2.5 px-3 text-[11px] uppercase tracking-wider">{lang === 'ar' ? 'الفحص المخبري' : 'Test'}</th>
                <th className="py-2.5 px-3 text-[11px] uppercase tracking-wider text-center">{lang === 'ar' ? 'النتيجة' : 'Result'}</th>
                <th className="py-2.5 px-3 text-[11px] uppercase tracking-wider">{lang === 'ar' ? 'المدى المرجعي' : 'Ref Range'}</th>
                <th className="py-2.5 px-3 text-[11px] uppercase tracking-wider">{lang === 'ar' ? 'التقييم' : 'Status'}</th>
                <th className="py-2.5 px-2 text-[11px] uppercase tracking-wider text-center">{lang === 'ar' ? 'إجراء' : 'Action'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EDEBE9] dark:divide-[#3b3a39] text-[#242424] dark:text-[#f3f2f1]">
              {recordedLabs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-[#605E5C] dark:text-[#a19f9d]">
                    {lang === 'ar' ? 'لا توجد فحوصات مخبرية مسجلة.' : 'No lab records found.'}
                  </td>
                </tr>
              ) : (
                recordedLabs.map((lab) => (
                  <tr key={lab.id} className="hover:bg-[#F3F2F1] dark:hover:bg-[#252423]">
                    <td className="py-2.5 px-3 font-mono text-[#605E5C] dark:text-[#a19f9d]">{lab.date}</td>
                    <td className="py-2.5 px-3 font-semibold text-[#242424] dark:text-[#f3f2f1]">{lab.testName}</td>
                    <td className="py-2.5 px-3 text-center font-mono font-bold text-[#242424] dark:text-[#f3f2f1]">{lab.numericValue ?? '—'} {lab.unit || ''}</td>
                    <td className="py-2.5 px-3 font-mono text-[#605E5C] dark:text-[#a19f9d]">{lab.referenceRange || '—'}</td>
                    <td className="py-2.5 px-3 font-semibold">
                      <span className={`px-2 py-0.5 rounded-[4px] text-[10px] font-mono ${
                        lab.status === 'normal'
                          ? 'bg-[#EFF6FC] dark:bg-[#112338] text-[#0078D4] dark:text-[#2899f5] border border-[#C7E0F4] dark:border-[#1e4a6f]'
                          : lab.status === 'borderline'
                          ? 'bg-[#FFF4CE] dark:bg-[#3a3118] text-[#7A5B00] dark:text-[#f3d370] border border-[#FFE699] dark:border-[#6a5a20]'
                          : 'bg-[#FDF3F3] dark:bg-[#3a1d1d] text-[#A80000] dark:text-[#f1707b] border border-[#E0A8A8] dark:border-[#6e3535]'
                      }`}>
                        {lab.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-2 text-center">
                      <button
                        type="button"
                        onClick={() => handleDeleteLabResult(lab.id)}
                        className="text-[#605E5C] dark:text-[#a19f9d] hover:text-[#A80000] dark:hover:text-[#f1707b] p-1 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
