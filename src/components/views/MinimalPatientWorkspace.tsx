import React, { useState, useEffect } from 'react';
import { Patient, FollowUpEntry } from '../../types/pharmacy';
import { calculatePDC, formatYMD } from '../../utils/pharmacyCalculations';
import { getPatientLabRadar } from '../../utils/clinicalIntelligence';

interface MinimalPatientWorkspaceProps {
  patients: Patient[];
  selectedPatientId?: string;
  followUps: FollowUpEntry[];
  lang: 'ar' | 'en';
  onSavePatient: (updatedPatient: Patient) => void;
  onArchivePatient: (patientId: string) => void;
  onSelectPatient: (patientId: string) => void;
  onShowToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export const MinimalPatientWorkspace: React.FC<MinimalPatientWorkspaceProps> = ({
  patients,
  selectedPatientId,
  followUps,
  lang,
  onSavePatient,
  onArchivePatient,
  onSelectPatient,
  onShowToast,
}) => {
  const activePatients = patients.filter(p => !p.isArchived);
  
  // Active selected patient
  const [currentPatient, setCurrentPatient] = useState<Patient>(() => {
    if (selectedPatientId) {
      const match = activePatients.find(p => p.id === selectedPatientId);
      if (match) return match;
    }
    return activePatients[0] || {
      id: 'PT-1001',
      name: 'حيدر علي عبد الحسين',
      phone: '07701234567',
      age: 58,
      gender: 'M',
      familyTag: 'عائلة عبد الحسين',
      loyaltyPoints: 120,
      allergies: 'بنسلين (Penicillin)',
      notes: 'يعاني من ارتفاع ضغط الدم والسكري النوع الثاني منذ 5 سنوات. منتظم على الصرف.',
      isArchived: false,
      createdAt: new Date().toISOString(),
      medications: [
        {
          id: 'M1',
          name: 'Glucophage 1000mg',
          dosage: '1000mg',
          daysSupply: 30,
          lastDispenseDate: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        },
        {
          id: 'M2',
          name: 'Concor 5mg',
          dosage: '5mg',
          daysSupply: 30,
          lastDispenseDate: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        },
      ],
      vitals: [
        { id: 'v1', date: '2026-10-15', bp: '130/82', sugar: '120', hba1c: '7.2', misc: '' },
        { id: 'v2', date: '2026-08-10', bp: '138/88', sugar: '135', hba1c: '7.8', misc: '' },
      ],
    };
  });

  useEffect(() => {
    if (selectedPatientId) {
      const match = activePatients.find(p => p.id === selectedPatientId);
      if (match) setCurrentPatient(match);
    }
  }, [selectedPatientId, patients]);

  // Form Fields State for Left Column
  const [formName, setFormName] = useState(currentPatient.name);
  const [formPhone, setFormPhone] = useState(currentPatient.phone);
  const [formAge, setFormAge] = useState(currentPatient.age?.toString() || '');
  const [formAllergies, setFormAllergies] = useState(currentPatient.allergies || '');
  const [formNotes, setFormNotes] = useState(currentPatient.notes || '');
  
  const latestVital = currentPatient.vitals?.[0] || { bp: '130/82', hba1c: '7.2', sugar: '', misc: '' };
  const [formBp, setFormBp] = useState(latestVital.bp || '130/82');
  const [formHba1c, setFormHba1c] = useState(latestVital.hba1c?.toString() || '7.2');
  const [formMedName, setFormMedName] = useState(currentPatient.medications?.[0]?.name || 'Glucophage 1000mg');
  const [formMedDose, setFormMedDose] = useState(currentPatient.medications?.[0]?.dosage || '1000mg');

  useEffect(() => {
    setFormName(currentPatient.name);
    setFormPhone(currentPatient.phone);
    setFormAge(currentPatient.age?.toString() || '');
    setFormAllergies(currentPatient.allergies || '');
    setFormNotes(currentPatient.notes || '');
    setFormBp(currentPatient.vitals?.[0]?.bp || '130/82');
    setFormHba1c(currentPatient.vitals?.[0]?.hba1c?.toString() || '7.2');
    setFormMedName(currentPatient.medications?.[0]?.name || '');
    setFormMedDose(currentPatient.medications?.[0]?.dosage || '');
  }, [currentPatient]);

  // Left Nav Rail Selection state
  const [navTab, setNavTab] = useState<'patients' | 'schedules' | 'analytics'>('patients');

  // Save Handler
  const handleSave = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const ageNum = parseInt(formAge, 10);
    const updatedMeds = [...(currentPatient.medications || [])];
    if (updatedMeds.length > 0 && formMedName) {
      updatedMeds[0] = { ...updatedMeds[0], name: formMedName, dosage: formMedDose };
    }

    const updatedVitals = [...(currentPatient.vitals || [])];
    if (updatedVitals.length > 0) {
      updatedVitals[0] = { ...updatedVitals[0], bp: formBp, hba1c: formHba1c };
    } else {
      updatedVitals.push({
        id: 'v-' + Date.now(),
        date: new Date().toISOString().split('T')[0],
        bp: formBp,
        hba1c: formHba1c,
        sugar: '',
        misc: '',
      });
    }

    const updated: Patient = {
      ...currentPatient,
      name: formName,
      phone: formPhone,
      age: isNaN(ageNum) ? undefined : ageNum,
      allergies: formAllergies,
      notes: formNotes,
      medications: updatedMeds,
      vitals: updatedVitals,
    };

    onSavePatient(updated);
    setCurrentPatient(updated);
    onShowToast(
      lang === 'ar' ? 'تم حفظ سجلات المريض بنجاح' : 'Patient records saved successfully',
      'success'
    );
  };

  const handleArchive = () => {
    if (window.confirm(lang === 'ar' ? `هل أنت تأكد من أرشفة سجل المريض ${currentPatient.name}؟` : `Archive record for ${currentPatient.name}?`)) {
      onArchivePatient(currentPatient.id);
      onShowToast(lang === 'ar' ? 'تمت أرشفة السجل' : 'Record archived', 'info');
    }
  };

  const pdc = calculatePDC(currentPatient);
  const labRadar = getPatientLabRadar(currentPatient);
  const overdueLabs = labRadar.filter(r => r.status === 'overdue');

  return (
    <div className="min-h-screen bg-[#FFFFFF] dark:bg-[#11100f] text-[#111111] dark:text-[#f3f2f1] font-sans flex flex-col antialiased selection:bg-[#111111] selection:text-[#FFFFFF]">
      <div className="flex flex-1 w-full">
        {/* ==================================================================== */}
        {/* 1. MINIMAL LEFT SIDEBAR NAVIGATION RAIL (Text links only)           */}
        {/* ==================================================================== */}
        <aside className="w-56 shrink-0 border-r border-[#E5E7EB] dark:border-[#3b3a39] p-8 flex flex-col justify-between select-none">
          <div className="space-y-12">
            {/* Header / Brand */}
            <div>
              <div className="font-extrabold text-sm tracking-widest uppercase text-[#111111] dark:text-[#f3f2f1]">
                Rx CRM
              </div>
              <div className="text-[11px] text-[#666666] dark:text-[#a19f9d] mt-1 font-mono">
                HIGH-CONTRAST
              </div>
            </div>

            {/* Navigation Links - Text Only, No Icons */}
            <nav className="flex flex-col space-y-6">
              <button
                onClick={() => setNavTab('patients')}
                className={`text-left text-sm tracking-wide cursor-pointer transition-colors ${
                  navTab === 'patients'
                    ? 'font-extrabold text-[#111111] dark:text-[#f3f2f1] underline underline-offset-4'
                    : 'font-medium text-[#666666] dark:text-[#a19f9d] hover:text-[#111111] dark:hover:text-[#f3f2f1]'
                }`}
              >
                {lang === 'ar' ? 'المرضى (Patients)' : 'Patients'}
              </button>

              <button
                onClick={() => setNavTab('schedules')}
                className={`text-left text-sm tracking-wide cursor-pointer transition-colors ${
                  navTab === 'schedules'
                    ? 'font-extrabold text-[#111111] dark:text-[#f3f2f1] underline underline-offset-4'
                    : 'font-medium text-[#666666] dark:text-[#a19f9d] hover:text-[#111111] dark:hover:text-[#f3f2f1]'
                }`}
              >
                {lang === 'ar' ? 'المواعيد (Schedules)' : 'Schedules'}
              </button>

              <button
                onClick={() => setNavTab('analytics')}
                className={`text-left text-sm tracking-wide cursor-pointer transition-colors ${
                  navTab === 'analytics'
                    ? 'font-extrabold text-[#111111] dark:text-[#f3f2f1] underline underline-offset-4'
                    : 'font-medium text-[#666666] dark:text-[#a19f9d] hover:text-[#111111] dark:hover:text-[#f3f2f1]'
                }`}
              >
                {lang === 'ar' ? 'التحليلات (Analytics)' : 'Analytics'}
              </button>
            </nav>

            {/* Patient Selector list */}
            {navTab === 'patients' && (
              <div className="pt-8 border-t border-[#E5E7EB] dark:border-[#3b3a39] space-y-3">
                <div className="text-[11px] font-bold uppercase tracking-wider text-[#666666] dark:text-[#a19f9d]">
                  {lang === 'ar' ? 'دليل المرضى' : 'DIRECTORY'}
                </div>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {activePatients.slice(0, 10).map(p => (
                    <button
                      key={p.id}
                      onClick={() => {
                        onSelectPatient(p.id);
                        setCurrentPatient(p);
                      }}
                      className={`block w-full text-left text-xs truncate py-1 transition-colors cursor-pointer ${
                        p.id === currentPatient.id
                          ? 'font-bold text-[#111111] dark:text-[#f3f2f1] border-l-2 border-[#111111] dark:border-[#f3f2f1] pl-2'
                          : 'text-[#666666] dark:text-[#a19f9d] hover:text-[#111111] dark:hover:text-[#f3f2f1] pl-2'
                      }`}
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* System Footer Note */}
          <div className="text-[10px] font-mono text-[#666666] dark:text-[#a19f9d]">
            SYSTEM VER 4.2
          </div>
        </aside>

        {/* ==================================================================== */}
        {/* MAIN WORKSPACE AREA                                                  */}
        {/* ==================================================================== */}
        <main className="flex-1 p-12 md:p-16 max-w-7xl mx-auto space-y-12">
          {/* ================================================================== */}
          {/* 2. MAIN HEADER AREA                                                */}
          {/* ================================================================== */}
          <header className="border-b border-[#E5E7EB] dark:border-[#3b3a39] pb-8 space-y-4">
            <div className="flex flex-col md:flex-row md:items-baseline justify-between gap-4">
              <div>
                <div className="text-[11px] uppercase tracking-widest font-mono font-bold text-[#666666] dark:text-[#a19f9d] mb-1">
                  {currentPatient.id} • {currentPatient.familyTag || (lang === 'ar' ? 'ملف فردي' : 'INDIVIDUAL FILE')}
                </div>
                {/* Massive Bold Typography */}
                <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-[#111111] dark:text-[#f3f2f1]">
                  {currentPatient.name}
                </h1>
              </div>

              {/* High-Level Status Badge */}
              <div className="flex items-center gap-3">
                {overdueLabs.length > 0 ? (
                  <span className="bg-[#D92D20] text-white text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-none">
                    {lang === 'ar' ? 'تحليل متأخر (Critical Lab)' : 'Critical Lab Overdue'}
                  </span>
                ) : (
                  <span className="bg-[#111111] dark:bg-[#201f1e] text-white text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-none border border-transparent dark:border-[#3b3a39]">
                    {lang === 'ar' ? 'علاج نشط (Active Treatment)' : 'Active Treatment'}
                  </span>
                )}

                <span className="border border-[#111111] dark:border-[#3b3a39] text-[#111111] dark:text-[#f3f2f1] text-xs font-mono font-bold px-3 py-1 rounded-none">
                  PDC: {pdc}%
                </span>
              </div>
            </div>

            {/* Quick Metadata Bar */}
            <div className="flex items-center gap-8 text-xs font-mono text-[#666666] dark:text-[#a19f9d] pt-2">
              <div>
                <span className="text-[#111111] dark:text-[#f3f2f1] font-bold">{lang === 'ar' ? 'الهاتف:' : 'TEL:'}</span>{' '}
                <span dir="ltr">{currentPatient.phone}</span>
              </div>
              <div>
                <span className="text-[#111111] dark:text-[#f3f2f1] font-bold">{lang === 'ar' ? 'العمر:' : 'AGE:'}</span>{' '}
                {currentPatient.age ? `${currentPatient.age} YRS` : 'N/A'}
              </div>
              <div>
                <span className="text-[#111111] dark:text-[#f3f2f1] font-bold">{lang === 'ar' ? 'الحساسية:' : 'ALLERGIES:'}</span>{' '}
                {currentPatient.allergies || 'NONE RECORDED'}
              </div>
            </div>
          </header>

          {/* ================================================================== */}
          {/* 3. CLEAN, TWO-COLUMN CONTENT GRID                                   */}
          {/* ================================================================== */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
            {/* ------------------------------------------------------------------ */}
            {/* LEFT COLUMN: Patient Vitals & Information Form                    */}
            {/* High-contrast input styling (sharp corners, border-bottom focus)   */}
            {/* ------------------------------------------------------------------ */}
            <section className="space-y-8">
              <div className="border-b border-[#111111] dark:border-[#f3f2f1] pb-2">
                <h2 className="text-sm uppercase tracking-widest font-extrabold text-[#111111] dark:text-[#f3f2f1]">
                  {lang === 'ar' ? 'بيانات المريض والعلامات الحيوية' : 'Patient Vitals & Information Form'}
                </h2>
              </div>

              <form onSubmit={handleSave} className="space-y-6">
                {/* Full Name */}
                <div className="space-y-1">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[#666666] dark:text-[#a19f9d]">
                    {lang === 'ar' ? 'الاسم الكامل (Full Name)' : 'Full Name'}
                  </label>
                  <input
                    type="text"
                    value={formName}
                    onChange={e => setFormName(e.target.value)}
                    className="w-full bg-transparent border-b border-[#E5E7EB] dark:border-[#3b3a39] focus:border-[#111111] dark:focus:border-[#f3f2f1] py-2 text-sm text-[#111111] dark:text-[#f3f2f1] font-semibold outline-none rounded-none transition-colors"
                  />
                </div>

                {/* Phone & Age Grid */}
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-1">
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-[#666666] dark:text-[#a19f9d]">
                      {lang === 'ar' ? 'رقم الهاتف (Contact Phone)' : 'Contact Phone'}
                    </label>
                    <input
                      type="text"
                      value={formPhone}
                      onChange={e => setFormPhone(e.target.value)}
                      dir="ltr"
                      className="w-full bg-transparent border-b border-[#E5E7EB] dark:border-[#3b3a39] focus:border-[#111111] dark:focus:border-[#f3f2f1] py-2 text-sm text-[#111111] dark:text-[#f3f2f1] font-mono outline-none rounded-none transition-colors"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-[#666666] dark:text-[#a19f9d]">
                      {lang === 'ar' ? 'العمر (Age)' : 'Age (Years)'}
                    </label>
                    <input
                      type="number"
                      value={formAge}
                      onChange={e => setFormAge(e.target.value)}
                      className="w-full bg-transparent border-b border-[#E5E7EB] dark:border-[#3b3a39] focus:border-[#111111] dark:focus:border-[#f3f2f1] py-2 text-sm text-[#111111] dark:text-[#f3f2f1] font-mono outline-none rounded-none transition-colors"
                    />
                  </div>
                </div>

                {/* Blood Pressure & HbA1c */}
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-1">
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-[#666666] dark:text-[#a19f9d]">
                      {lang === 'ar' ? 'ضغط الدم (Blood Pressure)' : 'Blood Pressure (mmHg)'}
                    </label>
                    <input
                      type="text"
                      value={formBp}
                      onChange={e => setFormBp(e.target.value)}
                      placeholder="120/80"
                      className="w-full bg-transparent border-b border-[#E5E7EB] dark:border-[#3b3a39] focus:border-[#111111] dark:focus:border-[#f3f2f1] py-2 text-sm text-[#111111] dark:text-[#f3f2f1] font-mono outline-none rounded-none transition-colors"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-[#666666] dark:text-[#a19f9d]">
                      {lang === 'ar' ? 'السكر التراكمي (HbA1c %)' : 'HbA1c Level (%)'}
                    </label>
                    <input
                      type="text"
                      value={formHba1c}
                      onChange={e => setFormHba1c(e.target.value)}
                      placeholder="7.2"
                      className="w-full bg-transparent border-b border-[#E5E7EB] dark:border-[#3b3a39] focus:border-[#111111] dark:focus:border-[#f3f2f1] py-2 text-sm text-[#111111] dark:text-[#f3f2f1] font-mono outline-none rounded-none transition-colors"
                    />
                  </div>
                </div>

                {/* Primary Medication Name & Dosage */}
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-1">
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-[#666666] dark:text-[#a19f9d]">
                      {lang === 'ar' ? 'العلاج الرئيسي (Medication Name)' : 'Primary Medication'}
                    </label>
                    <input
                      type="text"
                      value={formMedName}
                      onChange={e => setFormMedName(e.target.value)}
                      className="w-full bg-transparent border-b border-[#E5E7EB] dark:border-[#3b3a39] focus:border-[#111111] dark:focus:border-[#f3f2f1] py-2 text-sm text-[#111111] dark:text-[#f3f2f1] font-semibold outline-none rounded-none transition-colors"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-[#666666] dark:text-[#a19f9d]">
                      {lang === 'ar' ? 'الجرعة (Dosage)' : 'Dosage'}
                    </label>
                    <input
                      type="text"
                      value={formMedDose}
                      onChange={e => setFormMedDose(e.target.value)}
                      className="w-full bg-transparent border-b border-[#E5E7EB] dark:border-[#3b3a39] focus:border-[#111111] dark:focus:border-[#f3f2f1] py-2 text-sm text-[#111111] dark:text-[#f3f2f1] font-mono outline-none rounded-none transition-colors"
                    />
                  </div>
                </div>

                {/* Allergies */}
                <div className="space-y-1">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[#666666] dark:text-[#a19f9d]">
                    {lang === 'ar' ? 'التحسس الدوائي (Allergies)' : 'Known Allergies'}
                  </label>
                  <input
                    type="text"
                    value={formAllergies}
                    onChange={e => setFormAllergies(e.target.value)}
                    className="w-full bg-transparent border-b border-[#E5E7EB] dark:border-[#3b3a39] focus:border-[#111111] dark:focus:border-[#f3f2f1] py-2 text-sm text-[#111111] dark:text-[#f3f2f1] outline-none rounded-none transition-colors"
                  />
                </div>

                {/* Practitioner Clinical Notes */}
                <div className="space-y-1">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[#666666] dark:text-[#a19f9d]">
                    {lang === 'ar' ? 'الملاحظات السريرية (Clinical Notes)' : 'Practitioner Clinical Notes'}
                  </label>
                  <textarea
                    rows={3}
                    value={formNotes}
                    onChange={e => setFormNotes(e.target.value)}
                    className="w-full bg-transparent border-b border-[#E5E7EB] dark:border-[#3b3a39] focus:border-[#111111] dark:focus:border-[#f3f2f1] py-2 text-sm text-[#111111] dark:text-[#f3f2f1] outline-none rounded-none transition-colors resize-none"
                  />
                </div>
              </form>
            </section>

            {/* ------------------------------------------------------------------ */}
            {/* RIGHT COLUMN: Treatment History Timeline                           */}
            {/* Separated only by thin light gray rules and heavy text contrast    */}
            {/* ------------------------------------------------------------------ */}
            <section className="space-y-8">
              <div className="border-b border-[#111111] dark:border-[#f3f2f1] pb-2">
                <h2 className="text-sm uppercase tracking-widest font-extrabold text-[#111111] dark:text-[#f3f2f1]">
                  {lang === 'ar' ? 'سجل العلاج والمتابعة التاريخية' : 'Treatment History Timeline'}
                </h2>
              </div>

              <div className="space-y-0">
                {/* Timeline Item 1: Upcoming Scheduled Action */}
                <div className="py-6 border-b border-[#E5E7EB] dark:border-[#3b3a39] space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-mono text-[#666666] dark:text-[#a19f9d]">
                    <span>UPCOMING SCHEDULED ACTION</span>
                    <span className="font-bold text-[#111111] dark:text-[#f3f2f1]">NEXT DUE: 2026-11-01</span>
                  </div>
                  <div className="font-bold text-sm text-[#111111] dark:text-[#f3f2f1]">
                    {lang === 'ar' ? 'موعد تكرار صرف الوصفة المزمنة (Refill Due)' : 'Chronic Refill Dispatch & Adherence Check'}
                  </div>
                  <p className="text-xs text-[#666666] dark:text-[#a19f9d] leading-relaxed">
                    {lang === 'ar'
                      ? `استحقاق صرف ${formMedName || 'الدواء المزمن'} مع إجراء تقييم الالتزام بالدواء وترشيد الجرعات.`
                      : `Scheduled refill for ${formMedName || 'chronic medications'} alongside adherence evaluation.`}
                  </p>
                </div>

                {/* Timeline Item 2: Lab Test Review */}
                {labRadar.length > 0 && (
                  <div className="py-6 border-b border-[#E5E7EB] dark:border-[#3b3a39] space-y-2">
                    <div className="flex items-center justify-between text-[11px] font-mono text-[#666666] dark:text-[#a19f9d]">
                      <span>LABORATORY RADAR</span>
                      <span className="font-bold text-[#D92D20]">OVERDUE TEST</span>
                    </div>
                    <div className="font-bold text-sm text-[#111111] dark:text-[#f3f2f1]">
                      {labRadar[0].testNameAr} ({labRadar[0].testNameEn})
                    </div>
                    <p className="text-xs text-[#666666] dark:text-[#a19f9d] leading-relaxed">
                      {labRadar[0].fastingNoteAr || 'فحص دوري مطلوب لتقييم كفاءة الخطة العلاجية والسيطرة على المرض.'}
                    </p>
                  </div>
                )}

                {/* Timeline Item 3: Past Clinical Dispense Note */}
                <div className="py-6 border-b border-[#E5E7EB] dark:border-[#3b3a39] space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-mono text-[#666666] dark:text-[#a19f9d]">
                    <span>DISPENSE RECORD #8901</span>
                    <span>2026-09-28</span>
                  </div>
                  <div className="font-bold text-sm text-[#111111] dark:text-[#f3f2f1]">
                    {lang === 'ar' ? 'تكرار صرف شهر كامل — 30 يوماً' : 'Full Month Dispense Executed'}
                  </div>
                  <div className="text-xs font-mono text-[#111111] dark:text-[#f3f2f1]">
                    • Glucophage 1000mg x60 tabs | Concor 5mg x30 tabs
                  </div>
                  <p className="text-xs text-[#666666] dark:text-[#a19f9d] leading-relaxed">
                    {lang === 'ar'
                      ? 'تم التأكد من سلامة الكلى والضغط. المريض لا يعاني من أي أعراض جانبية.'
                      : 'Renal function and BP verified within target ranges.'}
                  </p>
                </div>

                {/* Timeline Item 4: Initial Registration */}
                <div className="py-6 border-b border-[#E5E7EB] dark:border-[#3b3a39] space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-mono text-[#666666] dark:text-[#a19f9d]">
                    <span>INITIAL ENROLLMENT</span>
                    <span>2026-05-10</span>
                  </div>
                  <div className="font-bold text-sm text-[#111111] dark:text-[#f3f2f1]">
                    {lang === 'ar' ? 'تسجيل المريض في برنامج الرعاية السريرية' : 'Chronic Care Program Registration'}
                  </div>
                  <p className="text-xs text-[#666666] dark:text-[#a19f9d] leading-relaxed">
                    {lang === 'ar'
                      ? 'تم تسجيل ملف المريض وتحديد بروتوكول الصرف الشهري والتذكير التلقائي.'
                      : 'Patient enrolled in automated monthly refill tracking.'}
                  </p>
                </div>
              </div>
            </section>
          </div>
        </main>
      </div>

      {/* ==================================================================== */}
      {/* 4. ACTIONABLE BOTTOM TOOLBAR                                         */}
      {/* Primary "Save Records" button (Solid Black, sharp corners)           */}
      {/* Secondary text-link "Archive File" button                           */}
      {/* ==================================================================== */}
      <footer className="sticky bottom-0 z-40 bg-[#FFFFFF] dark:bg-[#201f1e] border-t border-[#E5E7EB] dark:border-[#3b3a39] py-4 px-8 md:px-16 flex items-center justify-between">
        <div className="text-xs font-mono text-[#666666] dark:text-[#a19f9d] hidden sm:block">
          {lang === 'ar' ? `المريض المحدد: ${currentPatient.name}` : `ACTIVE FILE: ${currentPatient.name}`}
        </div>

        <div className="flex items-center gap-8 ml-auto sm:ml-0">
          {/* Secondary Action: Text Link */}
          <button
            type="button"
            onClick={handleArchive}
            className="text-sm font-semibold text-[#111111] dark:text-[#f3f2f1] underline hover:text-[#666666] dark:hover:text-[#a19f9d] cursor-pointer transition-colors"
          >
            {lang === 'ar' ? 'أرشفة السجل (Archive File)' : 'Archive File'}
          </button>

          {/* Primary Action: Solid Black, sharp corners (0px border-radius) */}
          <button
            type="button"
            onClick={() => handleSave()}
            className="bg-[#111111] dark:bg-[#0078D4] hover:bg-black dark:hover:bg-[#106EBE] text-[#FFFFFF] font-extrabold text-sm uppercase tracking-wider px-8 py-3.5 rounded-none shadow-none cursor-pointer transition-all border-0"
          >
            {lang === 'ar' ? 'حفظ السجلات (Save Records)' : 'Save Records'}
          </button>
        </div>
      </footer>
    </div>
  );
};
