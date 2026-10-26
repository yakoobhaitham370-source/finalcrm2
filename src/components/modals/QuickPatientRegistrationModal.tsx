import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  X,
  User,
  Phone,
  Pill,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
  ChevronLeft,
  Plus,
  Trash2,
  Search,
  RotateCcw,
  Save,
  Clock,
  ShieldAlert,
  ExternalLink,
  Edit3,
  Check,
  Building2,
  FileText,
} from 'lucide-react';
import { Patient, Medication, AllergiesStatus } from '../../types/pharmacy';
import { REGIONAL_BRAND_MAP, normalizeDrugString, getDrugScheduleSuggestion } from '../../data/drugDatabase';
import {
  formatYMD,
  normalizeArabicDigits,
  normalizePhoneNumber,
  calculatePatientAge,
} from '../../utils/pharmacyCalculations';

const DRAFT_STORAGE_KEY = 'crm_registration_draft';

// Common chronic drugs list for 1-tap quick pickers in Iraqi pharmacy context
const COMMON_CHRONIC_DRUGS = [
  { name: 'Glucophage 500mg Tablet', generic: 'Metformin', strength: '500mg', form: 'Tablet' },
  { name: 'Glucophage 1000mg XR', generic: 'Metformin', strength: '1000mg', form: 'XR Tablet' },
  { name: 'Lipitor 20mg Tablet', generic: 'Atorvastatin', strength: '20mg', form: 'Tablet' },
  { name: 'Crestor 10mg Tablet', generic: 'Rosuvastatin', strength: '10mg', form: 'Tablet' },
  { name: 'Concor 5mg Tablet', generic: 'Bisoprolol', strength: '5mg', form: 'Tablet' },
  { name: 'Norvasc 5mg Tablet', generic: 'Amlodipine', strength: '5mg', form: 'Tablet' },
  { name: 'Diovan 80mg Tablet', generic: 'Valsartan', strength: '80mg', form: 'Tablet' },
  { name: 'Exforge 5/160mg Tablet', generic: 'Amlodipine + Valsartan', strength: '5/160mg', form: 'Tablet' },
  { name: 'Jardiance 10mg Tablet', generic: 'Empagliflozin', strength: '10mg', form: 'Tablet' },
  { name: 'Janumet 50/1000mg Tablet', generic: 'Sitagliptin + Metformin', strength: '50/1000mg', form: 'Tablet' },
  { name: 'Controloc 40mg Tablet', generic: 'Pantoprazole', strength: '40mg', form: 'Tablet' },
  { name: 'Nexium 40mg Tablet', generic: 'Esomeprazole', strength: '40mg', form: 'Tablet' },
  { name: 'Plavix 75mg Tablet', generic: 'Clopidogrel', strength: '75mg', form: 'Tablet' },
  { name: 'Aspicot 81mg Tablet', generic: 'Aspirin', strength: '81mg', form: 'Tablet' },
  { name: 'Lasix 40mg Tablet', generic: 'Furosemide', strength: '40mg', form: 'Tablet' },
  { name: 'Augmentin 1g Tablet', generic: 'Amoxicillin + Clavulanic Acid', strength: '1000mg', form: 'Tablet' },
];

interface RegistrationDraft {
  step: number;
  formData: Partial<Patient>;
  medications: Medication[];
  updatedAt: string;
}

interface QuickPatientRegistrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  patients: Patient[];
  lang: 'ar' | 'en';
  isCloudConnected?: boolean;
  onSavePatient: (patient: Patient) => void;
  onOpenPatientDossier: (patientId: string) => void;
  onShowToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export const QuickPatientRegistrationModal: React.FC<QuickPatientRegistrationModalProps> = ({
  isOpen,
  onClose,
  patients = [],
  lang,
  isCloudConnected = false,
  onSavePatient,
  onOpenPatientDossier,
  onShowToast,
}) => {
  const [step, setStep] = useState<number>(1);
  const [isSaving, setIsSaving] = useState(false);
  const [savedPatientResult, setSavedPatientResult] = useState<Patient | null>(null);

  // Draft recovery state
  const [detectedDraft, setDetectedDraft] = useState<RegistrationDraft | null>(null);

  // Form State
  const [formData, setFormData] = useState<{
    id: string;
    name: string;
    phone: string;
    phoneUnavailable: boolean;
    dob: string;
    age: number;
    gender: 'M' | 'F' | 'Other';
    familyTag: string;
    allergiesStatus: AllergiesStatus;
    allergies: string;
    hasAcknowledgedSharedPhone: boolean;
    notes: string;
  }>({
    id: '',
    name: '',
    phone: '',
    phoneUnavailable: false,
    dob: '',
    age: 0,
    gender: 'M',
    familyTag: '',
    allergiesStatus: 'not_recorded',
    allergies: '',
    hasAcknowledgedSharedPhone: false,
    notes: '',
  });

  const [medications, setMedications] = useState<Medication[]>([]);
  const [medSearchQuery, setMedSearchQuery] = useState('');
  const [lastSavedDraftTime, setLastSavedDraftTime] = useState<string | null>(null);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

  const nameInputRef = useRef<HTMLInputElement>(null);
  const phoneInputRef = useRef<HTMLInputElement>(null);

  // On open: Initialize new patient ID and check for draft
  useEffect(() => {
    if (!isOpen) {
      setStep(1);
      setSavedPatientResult(null);
      setIsSaving(false);
      return;
    }

    // Check for saved draft in localStorage
    try {
      const savedRaw = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (savedRaw) {
        const parsed: RegistrationDraft = JSON.parse(savedRaw);
        if (parsed && (parsed.formData?.name || parsed.formData?.phone || parsed.medications?.length)) {
          setDetectedDraft(parsed);
        }
      }
    } catch (e) {
      console.warn('Failed to read registration draft:', e);
    }

    // Reset default form state
    setFormData({
      id: 'PT-' + Date.now().toString().slice(-6),
      name: '',
      phone: '',
      phoneUnavailable: false,
      dob: '',
      age: 0,
      gender: 'M',
      familyTag: '',
      allergiesStatus: 'not_recorded',
      allergies: '',
      hasAcknowledgedSharedPhone: false,
      notes: '',
    });
    setMedications([]);
    setStep(1);
    setSavedPatientResult(null);

    setTimeout(() => {
      nameInputRef.current?.focus();
    }, 100);
  }, [isOpen]);

  // Save Draft to LocalStorage whenever form data or step changes
  useEffect(() => {
    if (!isOpen || savedPatientResult) return;

    // Only save if there is some typed input
    const hasContent = formData.name.trim() || formData.phone.trim() || medications.length > 0;
    if (!hasContent) return;

    const draftData: RegistrationDraft = {
      step,
      formData,
      medications,
      updatedAt: new Date().toISOString(),
    };

    try {
      localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draftData));
      const formattedTime = new Date().toLocaleTimeString(lang === 'ar' ? 'ar-EG' : 'en-US', {
        hour: '2-digit',
        minute: '2-digit',
      });
      setLastSavedDraftTime(formattedTime);
    } catch (e) {
      console.warn('Failed to save draft:', e);
    }
  }, [isOpen, step, formData, medications, savedPatientResult, lang]);

  const handleResumeDraft = () => {
    if (!detectedDraft) return;
    if (detectedDraft.formData) {
      setFormData(prev => ({
        ...prev,
        ...detectedDraft.formData,
        id: detectedDraft.formData.id || prev.id,
      }));
    }
    if (Array.isArray(detectedDraft.medications)) {
      setMedications(detectedDraft.medications);
    }
    if (detectedDraft.step && detectedDraft.step >= 1 && detectedDraft.step <= 3) {
      setStep(detectedDraft.step);
    }
    setDetectedDraft(null);
    onShowToast(lang === 'ar' ? 'تم استئناف مسودة التسجيل بنجاح' : 'Draft resumed', 'success');
  };

  const handleDiscardDraft = () => {
    try {
      localStorage.removeItem(DRAFT_STORAGE_KEY);
    } catch (e) {}
    setDetectedDraft(null);
    setLastSavedDraftTime(null);
    onShowToast(lang === 'ar' ? 'تم البدء بمسودة جديدة' : 'New registration started', 'info');
  };

  const clearCurrentDraft = () => {
    try {
      localStorage.removeItem(DRAFT_STORAGE_KEY);
    } catch (e) {}
    setLastSavedDraftTime(null);
    setDetectedDraft(null);
  };

  // Immediate Duplicate Phone Detection
  const matchingPhonePatients = useMemo(() => {
    if (formData.phoneUnavailable || !formData.phone.trim()) return [];
    const normalized = normalizePhoneNumber(formData.phone);
    if (normalized.length < 5) return [];

    return patients.filter(p => {
      if (p.isArchived || p.phoneUnavailable) return false;
      const existingNormalized = normalizePhoneNumber(p.phone || '');
      return existingNormalized.length >= 5 && existingNormalized === normalized;
    });
  }, [patients, formData.phone, formData.phoneUnavailable]);

  // Drug Database Lookup for Step 2
  const searchedDrugSuggestions = useMemo(() => {
    const q = medSearchQuery.trim().toLowerCase();
    if (!q) return COMMON_CHRONIC_DRUGS.slice(0, 8);

    const matches: typeof COMMON_CHRONIC_DRUGS = [];

    COMMON_CHRONIC_DRUGS.forEach(d => {
      if (d.name.toLowerCase().includes(q) || d.generic.toLowerCase().includes(q)) {
        matches.push(d);
      }
    });

    // Also check regional brand map keys
    Object.keys(REGIONAL_BRAND_MAP).forEach(brand => {
      if (brand.toLowerCase().includes(q) && !matches.some(m => m.name.toLowerCase().includes(brand))) {
        const generic = REGIONAL_BRAND_MAP[brand];
        const formattedBrand = brand.charAt(0).toUpperCase() + brand.slice(1);
        matches.push({
          name: `${formattedBrand} Tablet`,
          generic: generic.charAt(0).toUpperCase() + generic.slice(1),
          strength: '',
          form: 'Tablet',
        });
      }
    });

    return matches.slice(0, 10);
  }, [medSearchQuery]);

  if (!isOpen) return null;

  // Step 1 Validation & Next
  const handleGoToStep2 = () => {
    if (!formData.name.trim()) {
      onShowToast(lang === 'ar' ? 'يرجى إدخال اسم المريض الثلاثي' : 'Please enter full patient name', 'error');
      nameInputRef.current?.focus();
      return;
    }

    if (!formData.phoneUnavailable) {
      if (!formData.phone.trim()) {
        onShowToast(lang === 'ar' ? 'يرجى إدخال رقم الهاتف أو تحديد "رقم الهاتف غير متوفر"' : 'Enter phone or check unavailable', 'error');
        phoneInputRef.current?.focus();
        return;
      }

      if (matchingPhonePatients.length > 0 && !formData.hasAcknowledgedSharedPhone) {
        onShowToast(
          lang === 'ar'
            ? 'توجد حسابات سابقة بنفس رقم الهاتف. يرجى تأكيد الاشتراك العائلي للمتابعة.'
            : 'Please acknowledge shared phone number before proceeding.',
          'error'
        );
        return;
      }
    }

    setStep(2);
  };

  // Add Medication in Step 2
  const handleAddMedicationItem = (drugName: string, defaultSupply = 30) => {
    if (!drugName.trim()) return;

    const suggestion = getDrugScheduleSuggestion(drugName);
    const newMed: Medication = {
      id: `med-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: drugName.trim(),
      lastDispenseDate: formatYMD(new Date()),
      daysSupply: defaultSupply,
      dosage: '1 حبة',
      timing: suggestion.timing,
      mealRelation: suggestion.mealRelation,
    };

    setMedications(prev => [newMed, ...prev]);
    setMedSearchQuery('');
    onShowToast(lang === 'ar' ? `تمت إضافة (${drugName})` : `Added ${drugName}`, 'success');
  };

  const handleRemoveMedication = (id?: string, index?: number) => {
    setMedications(prev => prev.filter((m, idx) => (id ? m.id !== id : idx !== index)));
  };

  const handleMedChange = (index: number, field: keyof Medication, value: any) => {
    setMedications(prev => {
      const copy = [...prev];
      if (copy[index]) {
        copy[index] = { ...copy[index], [field]: value };
      }
      return copy;
    });
  };

  // Save Final Record in Step 3
  const handleFinalSave = () => {
    if (isSaving) return;
    setIsSaving(true);

    const cleanPhone = formData.phoneUnavailable ? '' : normalizeArabicDigits(formData.phone.trim());

    const finalPatient: Patient = {
      id: formData.id || 'PT-' + Date.now().toString().slice(-6),
      name: formData.name.trim(),
      phone: cleanPhone,
      phoneUnavailable: formData.phoneUnavailable,
      dob: formData.dob || undefined,
      age: formData.age || 0,
      gender: formData.gender,
      familyTag: formData.familyTag.trim() || undefined,
      loyaltyPoints: 0,
      allergiesStatus: formData.allergiesStatus,
      allergies: formData.allergiesStatus === 'recorded' ? formData.allergies.trim() : undefined,
      hasAcknowledgedSharedPhone: formData.hasAcknowledgedSharedPhone,
      notes: formData.notes.trim() || undefined,
      medications: medications.map(m => ({
        ...m,
        daysSupply: Number(m.daysSupply) > 0 ? Number(m.daysSupply) : 30,
      })),
      vitals: [],
      labResults: [],
      scans: [],
      createdAt: new Date().toISOString(),
      isArchived: false,
    };

    onSavePatient(finalPatient);
    setSavedPatientResult(finalPatient);
    clearCurrentDraft();
    setIsSaving(false);
  };

  const handleSafeCloseModal = () => {
    if (savedPatientResult) {
      onClose();
      return;
    }
    const hasData = formData.name.trim() || formData.phone.trim() || medications.length > 0;
    if (hasData) {
      setShowDiscardConfirm(true);
    } else {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[#201f1e] border border-[#EDEBE9] dark:border-[#3b3a39] rounded-[8px] max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[94vh] text-[#242424] dark:text-[#f3f2f1]">
        {/* Modal Top Header */}
        <div className="px-4 py-3 bg-[#FAF9F8] dark:bg-[#2d2c2c] border-b border-[#EDEBE9] dark:border-[#3b3a39] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-[#EFF6FC] dark:bg-[#004578]/50 flex items-center justify-center text-[#0078D4] dark:text-[#2899f5] font-bold text-sm">
              {savedPatientResult ? '✓' : step}
            </div>
            <div>
              <h2 className="font-bold text-sm text-[#242424] dark:text-[#f3f2f1]">
                {lang === 'ar' ? 'تسجيل مريض جديد (Quick Registration)' : 'Quick Patient Registration'}
              </h2>
              <p className="text-[11px] text-[#605E5C] dark:text-[#a19f9d]">
                {step === 1 && (lang === 'ar' ? 'الخطوة 1 من 3: البيانات الشخصية والهاتف' : 'Step 1 of 3: Patient Details')}
                {step === 2 && (lang === 'ar' ? 'الخطوة 2 من 3: الأدوية الموصوفة (اختياري)' : 'Step 2 of 3: Prescribed Medicines (Optional)')}
                {step === 3 && (lang === 'ar' ? 'الخطوة 3 من 3: مراجعة البيانات وتأكيد الحفظ' : 'Step 3 of 3: Review & Save')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {lastSavedDraftTime && !savedPatientResult && (
              <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-mono text-[#605E5C] dark:text-[#a19f9d] bg-[#EDEBE9] dark:bg-[#3b3a39] px-2 py-0.5 rounded-[4px]">
                <Clock className="w-3 h-3 text-[#0078D4]" />
                <span>{lang === 'ar' ? `محفوظ ${lastSavedDraftTime}` : `Saved ${lastSavedDraftTime}`}</span>
              </span>
            )}
            <button
              onClick={handleSafeCloseModal}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center text-[#605E5C] dark:text-[#a19f9d] hover:text-[#242424] dark:hover:text-[#f3f2f1] rounded-[4px] cursor-pointer"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Wizard Progress Bar */}
        {!savedPatientResult && (
          <div className="bg-[#FAF9F8] dark:bg-[#252423] border-b border-[#EDEBE9] dark:border-[#3b3a39] px-4 py-2 flex items-center justify-between text-xs">
            <button
              onClick={() => setStep(1)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-[4px] font-semibold transition-colors cursor-pointer ${
                step === 1
                  ? 'bg-[#0078D4] text-white'
                  : step > 1
                  ? 'bg-[#EFF6FC] dark:bg-[#004578]/30 text-[#0078D4] dark:text-[#2899f5]'
                  : 'text-[#605E5C] dark:text-[#a19f9d]'
              }`}
            >
              <span>1. {lang === 'ar' ? 'المريض' : 'Patient'}</span>
            </button>

            <span className="px-2 text-[#C8C6C4] dark:text-[#484644]">➔</span>

            <button
              onClick={() => step > 1 && setStep(2)}
              disabled={step < 2}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-[4px] font-semibold transition-colors ${
                step === 2
                  ? 'bg-[#0078D4] text-white cursor-pointer'
                  : step > 2
                  ? 'bg-[#EFF6FC] dark:bg-[#004578]/30 text-[#0078D4] dark:text-[#2899f5] cursor-pointer'
                  : 'text-[#605E5C] dark:text-[#a19f9d] cursor-not-allowed opacity-60'
              }`}
            >
              <span>2. {lang === 'ar' ? 'الأدوية' : 'Medicines'}</span>
            </button>

            <span className="px-2 text-[#C8C6C4] dark:text-[#484644]">➔</span>

            <button
              onClick={() => step > 2 && setStep(3)}
              disabled={step < 3}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-[4px] font-semibold transition-colors ${
                step === 3
                  ? 'bg-[#0078D4] text-white cursor-pointer'
                  : 'text-[#605E5C] dark:text-[#a19f9d] cursor-not-allowed opacity-60'
              }`}
            >
              <span>3. {lang === 'ar' ? 'المراجعة' : 'Review'}</span>
            </button>
          </div>
        )}

        {/* Draft Detected Alert Banner */}
        {detectedDraft && !savedPatientResult && (
          <div className="bg-[#EFF6FC] dark:bg-[#004578]/40 border-b border-[#0078D4]/30 p-3 flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#0078D4] shrink-0" />
              <div>
                <strong className="text-[#0078D4] dark:text-[#2899f5]">
                  {lang === 'ar' ? 'توجد مسودة تسجيل سابقة!' : 'Unfinished Draft Found!'}
                </strong>{' '}
                <span className="text-[#605E5C] dark:text-[#a19f9d]">
                  {lang === 'ar'
                    ? `تاريخ الحفظ (${new Date(detectedDraft.updatedAt).toLocaleTimeString()}). هل تريد استئنافها؟`
                    : `Saved at ${new Date(detectedDraft.updatedAt).toLocaleTimeString()}. Resume draft?`}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={handleResumeDraft}
                className="min-h-[36px] px-3 py-1 bg-[#0078D4] text-white rounded-[4px] font-semibold hover:bg-[#106EBE] transition-colors cursor-pointer"
              >
                {lang === 'ar' ? 'استئناف' : 'Resume'}
              </button>
              <button
                onClick={handleDiscardDraft}
                className="min-h-[36px] px-2.5 py-1 text-[#605E5C] dark:text-[#a19f9d] hover:text-[#A80000] font-semibold cursor-pointer"
              >
                {lang === 'ar' ? 'تجاهل' : 'Discard'}
              </button>
            </div>
          </div>
        )}

        {/* MODAL BODY */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1 text-xs">
          {/* SUCCESS VIEW (AFTER SAVING) */}
          {savedPatientResult ? (
            <div className="py-8 text-center space-y-5 animate-in zoom-in-95 duration-200">
              <div className="w-16 h-16 bg-[#107C41]/10 text-[#107C41] rounded-full flex items-center justify-center mx-auto text-3xl font-bold">
                ✓
              </div>

              <div className="space-y-1.5">
                <h3 className="text-lg font-bold text-[#242424] dark:text-[#f3f2f1]">
                  {lang === 'ar' ? `تم حفظ ملف المريض (${savedPatientResult.name}) بنجاح!` : `Patient (${savedPatientResult.name}) Saved Successfully!`}
                </h3>
                <p className="text-xs text-[#605E5C] dark:text-[#a19f9d]">
                  {lang === 'ar'
                    ? `رمز المريض: ${savedPatientResult.id} • ${savedPatientResult.medications.length} دواء مسجل`
                    : `Patient ID: ${savedPatientResult.id} • ${savedPatientResult.medications.length} meds registered`}
                </p>
              </div>

              {/* Local vs Cloud Sync Indicator */}
              <div className="max-w-md mx-auto p-3 rounded-[6px] bg-[#FAF9F8] dark:bg-[#252423] border border-[#EDEBE9] dark:border-[#3b3a39] flex items-center justify-around text-xs">
                <div className="flex items-center gap-1.5 text-[#107C41] font-semibold">
                  <span>💾</span>
                  <span>{lang === 'ar' ? 'حفظ محلي مؤكد' : 'Saved Locally'}</span>
                </div>
                <span className="text-[#C8C6C4]">|</span>
                {isCloudConnected ? (
                  <div className="flex items-center gap-1.5 text-[#0078D4] font-semibold">
                    <span>☁️</span>
                    <span>{lang === 'ar' ? 'مزامنة السحابة جارية' : 'Cloud Sync Active'}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-[#605E5C] dark:text-[#a19f9d]">
                    <span>☁️</span>
                    <span>{lang === 'ar' ? 'وضع أوفلاين' : 'Offline Mode'}</span>
                  </div>
                )}
              </div>

              {/* Post-Registration Actions */}
              <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
                <button
                  onClick={() => {
                    const savedId = savedPatientResult.id;
                    onClose();
                    onOpenPatientDossier(savedId);
                  }}
                  className="w-full sm:w-auto min-h-[48px] px-5 py-2.5 bg-[#0078D4] hover:bg-[#106EBE] active:bg-[#005A9E] text-white rounded-[6px] font-bold text-sm flex items-center justify-center gap-2 cursor-pointer shadow-md transition-colors"
                >
                  <FileText className="w-4 h-4" />
                  <span>{lang === 'ar' ? 'فتح ملف المريض الكامل' : 'Open Patient Record'}</span>
                </button>

                <button
                  onClick={() => {
                    setSavedPatientResult(null);
                    setFormData({
                      id: 'PT-' + Date.now().toString().slice(-6),
                      name: '',
                      phone: '',
                      phoneUnavailable: false,
                      dob: '',
                      age: 0,
                      gender: 'M',
                      familyTag: '',
                      allergiesStatus: 'not_recorded',
                      allergies: '',
                      hasAcknowledgedSharedPhone: false,
                      notes: '',
                    });
                    setMedications([]);
                    setStep(1);
                    setTimeout(() => nameInputRef.current?.focus(), 100);
                  }}
                  className="w-full sm:w-auto min-h-[48px] px-5 py-2.5 bg-white dark:bg-[#252423] text-[#242424] dark:text-[#f3f2f1] border border-[#EDEBE9] dark:border-[#3b3a39] hover:bg-[#FAF9F8] dark:hover:bg-[#2d2c2c] rounded-[6px] font-semibold text-sm flex items-center justify-center gap-2 cursor-pointer transition-colors"
                >
                  <Plus className="w-4 h-4 text-[#0078D4]" />
                  <span>{lang === 'ar' ? 'تسجيل مريض آخر' : 'Add Another Patient'}</span>
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* STEP 1: PATIENT DETAILS */}
              {step === 1 && (
                <div className="space-y-4 animate-in fade-in duration-150">
                  {/* Full Name Field */}
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-[#242424] dark:text-[#f3f2f1]">
                      {lang === 'ar' ? 'اسم المريض الثلاثي *' : 'Patient Full Name *'}
                    </label>
                    <input
                      ref={nameInputRef}
                      type="text"
                      autoComplete="name"
                      value={formData.name}
                      onChange={e => setFormData(p => ({ ...p, name: e.target.value }))}
                      placeholder={lang === 'ar' ? 'مثال: أحمد عبد الله جاسم' : 'e.g., Ahmed Abdullah Jasim'}
                      className="w-full bg-white dark:bg-[#252423] border border-[#EDEBE9] dark:border-[#3b3a39] focus:border-[#0078D4] dark:focus:border-[#2899f5] rounded-[4px] px-3 py-2.5 text-[16px] sm:text-xs outline-none transition-colors"
                    />
                  </div>

                  {/* Phone Field & Duplicate Detection */}
                  <div className="space-y-2 bg-[#FAF9F8] dark:bg-[#252423] p-3 rounded-[6px] border border-[#EDEBE9] dark:border-[#3b3a39]">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-[#242424] dark:text-[#f3f2f1]">
                        {lang === 'ar' ? 'رقم الهاتف (عراقي أو دولي)' : 'Phone Number (Local/Intl)'}
                      </label>

                      {/* Phone Unavailable Checkbox */}
                      <label className="flex items-center gap-2 text-xs text-[#605E5C] dark:text-[#a19f9d] cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={formData.phoneUnavailable}
                          onChange={e => {
                            const checked = e.target.checked;
                            setFormData(p => ({
                              ...p,
                              phoneUnavailable: checked,
                              phone: checked ? '' : p.phone,
                              hasAcknowledgedSharedPhone: false,
                            }));
                          }}
                          className="w-4 h-4 rounded-xs border-[#0078D4] accent-[#0078D4] cursor-pointer"
                        />
                        <span className="font-semibold text-[#0078D4] dark:text-[#2899f5]">
                          {lang === 'ar' ? 'رقم الهاتف غير متوفر' : 'Phone unavailable'}
                        </span>
                      </label>
                    </div>

                    {!formData.phoneUnavailable ? (
                      <input
                        ref={phoneInputRef}
                        type="tel"
                        inputMode="tel"
                        autoComplete="tel"
                        dir="ltr"
                        value={formData.phone}
                        onChange={e => {
                          const val = normalizeArabicDigits(e.target.value);
                          setFormData(p => ({ ...p, phone: val, hasAcknowledgedSharedPhone: false }));
                        }}
                        placeholder="0770xxxxxxx / +964..."
                        className="w-full bg-white dark:bg-[#201f1e] border border-[#EDEBE9] dark:border-[#3b3a39] focus:border-[#0078D4] dark:focus:border-[#2899f5] rounded-[4px] px-3 py-2.5 text-[16px] sm:text-xs outline-none transition-colors font-mono"
                      />
                    ) : (
                      <div className="p-2.5 bg-[#EDEBE9] dark:bg-[#3b3a39] text-[#605E5C] dark:text-[#a19f9d] rounded-[4px] text-xs italic">
                        {lang === 'ar'
                          ? 'تم تحديد الهاتف كـ "غير متوفر". سيتم إيقاف التذكيرات التلقائية عبر الواتساب لهذه الحالة.'
                          : 'Phone marked unavailable. Automatic messaging actions will be disabled.'}
                      </div>
                    )}

                    {/* Immediate Duplicate Phone Warning Banner */}
                    {matchingPhonePatients.length > 0 && !formData.phoneUnavailable && (
                      <div className="mt-2 p-3 bg-[#FFF4CE] dark:bg-[#3a3118] border border-[#FFE699] dark:border-[#5a4c21] rounded-[6px] text-xs space-y-2 animate-in fade-in duration-150">
                        <div className="flex items-start gap-2 text-[#7A5B00] dark:text-[#f3d36b]">
                          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                          <div>
                            <strong>{lang === 'ar' ? 'تم العثور على مريض مسجل سابقاً بنفس رقم الهاتف:' : 'Existing patient(s) found with this phone:'}</strong>
                            <div className="mt-1 space-y-1">
                              {matchingPhonePatients.map(p => (
                                <div key={p.id} className="flex items-center justify-between bg-white/80 dark:bg-[#201f1e]/80 p-1.5 rounded-[4px] border border-[#FFE699]">
                                  <span className="font-semibold text-[#242424] dark:text-[#f3f2f1]">
                                    {p.name} ({p.id})
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      onClose();
                                      onOpenPatientDossier(p.id);
                                    }}
                                    className="text-[11px] font-bold text-[#0078D4] hover:underline flex items-center gap-1 cursor-pointer"
                                  >
                                    <span>{lang === 'ar' ? 'فتح الملف' : 'Open Record'}</span>
                                    <ExternalLink className="w-3 h-3" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>

                        {/* Mandatory Acknowledgement Checkbox */}
                        <label className="flex items-center gap-2 pt-1 border-t border-[#FFE699] dark:border-[#5a4c21] cursor-pointer text-[#7A5B00] dark:text-[#f3d36b] font-semibold">
                          <input
                            type="checkbox"
                            checked={formData.hasAcknowledgedSharedPhone}
                            onChange={e => setFormData(p => ({ ...p, hasAcknowledgedSharedPhone: e.target.checked }))}
                            className="w-4 h-4 rounded-xs border-[#7A5B00] accent-[#0078D4] cursor-pointer"
                          />
                          <span>
                            {lang === 'ar'
                              ? 'أقر بأن رقم الهاتف مشترك بين أفراد نفس العائلة (أقارب)'
                              : 'I acknowledge this phone is shared by family members'}
                          </span>
                        </label>
                      </div>
                    )}
                  </div>

                  {/* DOB / Age / Gender / Family Tag Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {/* Birth Date */}
                    <div className="space-y-1">
                      <label className="block text-xs font-semibold text-[#605E5C] dark:text-[#a19f9d]">
                        {lang === 'ar' ? 'تاريخ الميلاد (اختياري)' : 'Date of Birth (Optional)'}
                      </label>
                      <input
                        type="date"
                        dir="ltr"
                        value={formData.dob}
                        onChange={e => {
                          const val = e.target.value;
                          const age = calculatePatientAge(val);
                          setFormData(p => ({ ...p, dob: val, age }));
                        }}
                        className="w-full bg-white dark:bg-[#252423] border border-[#EDEBE9] dark:border-[#3b3a39] focus:border-[#0078D4] rounded-[4px] px-2.5 py-2 text-[16px] sm:text-xs outline-none font-mono"
                      />
                    </div>

                    {/* Gender */}
                    <div className="space-y-1">
                      <label className="block text-xs font-semibold text-[#605E5C] dark:text-[#a19f9d]">
                        {lang === 'ar' ? 'الجنس' : 'Gender'}
                      </label>
                      <select
                        value={formData.gender}
                        onChange={e => setFormData(p => ({ ...p, gender: e.target.value as any }))}
                        className="w-full bg-white dark:bg-[#252423] border border-[#EDEBE9] dark:border-[#3b3a39] focus:border-[#0078D4] rounded-[4px] px-2.5 py-2 text-[16px] sm:text-xs outline-none cursor-pointer"
                      >
                        <option value="M">{lang === 'ar' ? 'ذكر (Male)' : 'Male'}</option>
                        <option value="F">{lang === 'ar' ? 'أنثى (Female)' : 'Female'}</option>
                        <option value="Other">{lang === 'ar' ? 'غير ذلك' : 'Other'}</option>
                      </select>
                    </div>

                    {/* Family Tag */}
                    <div className="space-y-1">
                      <label className="block text-xs font-semibold text-[#605E5C] dark:text-[#a19f9d]">
                        {lang === 'ar' ? 'رمز / عائلة المريض (اختياري)' : 'Family Tag (Optional)'}
                      </label>
                      <input
                        type="text"
                        value={formData.familyTag}
                        onChange={e => setFormData(p => ({ ...p, familyTag: e.target.value }))}
                        placeholder={lang === 'ar' ? 'مثال: آل العلي' : 'e.g. Al-Ali Family'}
                        className="w-full bg-white dark:bg-[#252423] border border-[#EDEBE9] dark:border-[#3b3a39] focus:border-[#0078D4] rounded-[4px] px-2.5 py-2 text-[16px] sm:text-xs outline-none"
                      />
                    </div>
                  </div>

                  {/* 3-Way Allergies Selector */}
                  <div className="space-y-2 bg-[#FAF9F8] dark:bg-[#252423] p-3 rounded-[6px] border border-[#EDEBE9] dark:border-[#3b3a39]">
                    <label className="block text-xs font-bold text-[#242424] dark:text-[#f3f2f1]">
                      {lang === 'ar' ? 'حالة التوثيق للحساسية الدوائية *' : 'Allergy Documentation Status *'}
                    </label>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <label
                        className={`p-2.5 rounded-[4px] border text-xs font-semibold flex items-center gap-2 cursor-pointer transition-colors ${
                          formData.allergiesStatus === 'not_recorded'
                            ? 'bg-[#EFF6FC] dark:bg-[#004578]/50 border-[#0078D4] text-[#0078D4] dark:text-[#2899f5]'
                            : 'bg-white dark:bg-[#201f1e] border-[#EDEBE9] dark:border-[#3b3a39] text-[#605E5C] dark:text-[#a19f9d]'
                        }`}
                      >
                        <input
                          type="radio"
                          name="allergiesStatus"
                          value="not_recorded"
                          checked={formData.allergiesStatus === 'not_recorded'}
                          onChange={() => setFormData(p => ({ ...p, allergiesStatus: 'not_recorded' }))}
                          className="accent-[#0078D4]"
                        />
                        <span>{lang === 'ar' ? 'غير مسجلة (Not recorded)' : 'Not recorded'}</span>
                      </label>

                      <label
                        className={`p-2.5 rounded-[4px] border text-xs font-semibold flex items-center gap-2 cursor-pointer transition-colors ${
                          formData.allergiesStatus === 'nkda'
                            ? 'bg-[#EFF6FC] dark:bg-[#004578]/50 border-[#0078D4] text-[#0078D4] dark:text-[#2899f5]'
                            : 'bg-white dark:bg-[#201f1e] border-[#EDEBE9] dark:border-[#3b3a39] text-[#605E5C] dark:text-[#a19f9d]'
                        }`}
                      >
                        <input
                          type="radio"
                          name="allergiesStatus"
                          value="nkda"
                          checked={formData.allergiesStatus === 'nkda'}
                          onChange={() => setFormData(p => ({ ...p, allergiesStatus: 'nkda' }))}
                          className="accent-[#0078D4]"
                        />
                        <span>{lang === 'ar' ? 'لا توجد حساسية معروفة (NKDA)' : 'NKDA (No Known Allergies)'}</span>
                      </label>

                      <label
                        className={`p-2.5 rounded-[4px] border text-xs font-semibold flex items-center gap-2 cursor-pointer transition-colors ${
                          formData.allergiesStatus === 'recorded'
                            ? 'bg-[#FDF3F3] dark:bg-[#3a1d1d] border-[#A80000] text-[#A80000] dark:text-[#f87171]'
                            : 'bg-white dark:bg-[#201f1e] border-[#EDEBE9] dark:border-[#3b3a39] text-[#605E5C] dark:text-[#a19f9d]'
                        }`}
                      >
                        <input
                          type="radio"
                          name="allergiesStatus"
                          value="recorded"
                          checked={formData.allergiesStatus === 'recorded'}
                          onChange={() => setFormData(p => ({ ...p, allergiesStatus: 'recorded' }))}
                          className="accent-[#A80000]"
                        />
                        <span>{lang === 'ar' ? 'حساسية مسجلة ⚠️' : 'Known Allergy ⚠️'}</span>
                      </label>
                    </div>

                    {formData.allergiesStatus === 'recorded' && (
                      <input
                        type="text"
                        value={formData.allergies}
                        onChange={e => setFormData(p => ({ ...p, allergies: e.target.value }))}
                        placeholder={lang === 'ar' ? 'حدد المواد المسببة للحساسية (مثال: Penicillin, Sulfa)' : 'Specify allergic agents (e.g. Penicillin)'}
                        className="w-full bg-white dark:bg-[#201f1e] border border-[#A80000] rounded-[4px] px-3 py-2 text-[16px] sm:text-xs outline-none mt-2"
                      />
                    )}
                  </div>

                  {/* Notes Field */}
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-[#605E5C] dark:text-[#a19f9d]">
                      {lang === 'ar' ? 'ملاحظات سريرية أو إدارية (اختياري)' : 'Clinical Notes (Optional)'}
                    </label>
                    <textarea
                      rows={2}
                      value={formData.notes}
                      onChange={e => setFormData(p => ({ ...p, notes: e.target.value }))}
                      placeholder={lang === 'ar' ? 'أي ملاحظات تشخيصية أو تعليمات خاصة...' : 'Any diagnostic or special notes...'}
                      className="w-full bg-white dark:bg-[#252423] border border-[#EDEBE9] dark:border-[#3b3a39] focus:border-[#0078D4] rounded-[4px] p-2.5 text-[16px] sm:text-xs outline-none"
                    />
                  </div>
                </div>
              )}

              {/* STEP 2: PRESCRIBED MEDICINES */}
              {step === 2 && (
                <div className="space-y-4 animate-in fade-in duration-150">
                  {/* Searchable Drug Picker */}
                  <div className="space-y-2 bg-[#FAF9F8] dark:bg-[#252423] p-3 rounded-[6px] border border-[#EDEBE9] dark:border-[#3b3a39]">
                    <label className="block text-xs font-bold text-[#242424] dark:text-[#f3f2f1]">
                      {lang === 'ar' ? 'ابحث في قاعدة أدوية الصيدلية وأضف الخطة العلاجية' : 'Search Pharmacy Medication Database'}
                    </label>

                    <div className="relative">
                      <Search className="w-4 h-4 text-[#605E5C] absolute right-3 top-3" />
                      <input
                        type="text"
                        value={medSearchQuery}
                        onChange={e => setMedSearchQuery(e.target.value)}
                        placeholder={lang === 'ar' ? 'ابحث باسم الدواء التجاري أو العلمي (مثال: Glucophage, Lipitor, Concor)...' : 'Search brand or generic drug name...'}
                        className="w-full bg-white dark:bg-[#201f1e] border border-[#EDEBE9] dark:border-[#3b3a39] focus:border-[#0078D4] rounded-[4px] px-9 py-2.5 text-[16px] sm:text-xs outline-none"
                      />
                    </div>

                    {/* Drug Suggestions List */}
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {searchedDrugSuggestions.map((item, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleAddMedicationItem(item.name)}
                          className="px-2.5 py-1 rounded-[4px] bg-white dark:bg-[#201f1e] border border-[#EDEBE9] dark:border-[#3b3a39] hover:border-[#0078D4] text-[#242424] dark:text-[#f3f2f1] text-[11px] font-semibold flex items-center gap-1.5 cursor-pointer transition-colors shadow-2xs"
                        >
                          <Plus className="w-3 h-3 text-[#0078D4]" />
                          <span>{item.name}</span>
                          <span className="text-[9px] text-[#605E5C] dark:text-[#a19f9d]">({item.generic})</span>
                        </button>
                      ))}
                    </div>

                    {/* Custom Medicine Entry */}
                    {medSearchQuery.trim() && (
                      <div className="pt-2 border-t border-[#EDEBE9] dark:border-[#3b3a39] flex items-center justify-between">
                        <span className="text-xs text-[#605E5C]">
                          {lang === 'ar' ? `لم تجد الدواء المطلوب؟ إضافة "${medSearchQuery.trim()}" يدويًا:` : `Add custom drug "${medSearchQuery.trim()}":`}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleAddMedicationItem(medSearchQuery.trim())}
                          className="px-3 py-1 bg-[#0078D4] text-white rounded-[4px] font-semibold text-xs flex items-center gap-1 cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>{lang === 'ar' ? 'إضافة دواء يدوي' : 'Add Custom'}</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Selected Medications List */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-xs text-[#242424] dark:text-[#f3f2f1]">
                        {lang === 'ar' ? `الأدوية المسجلة بالخطة (${medications.length})` : `Selected Medications (${medications.length})`}
                      </h4>
                      <span className="text-[11px] text-[#605E5C]">
                        {lang === 'ar' ? 'يمكن إضافة أو تخطي الأدوية الآن وإكمالها لاحقاً' : 'Adding meds is optional during registration'}
                      </span>
                    </div>

                    {medications.length === 0 ? (
                      <div className="p-6 text-center border border-dashed border-[#EDEBE9] dark:border-[#3b3a39] rounded-[6px] text-[#605E5C] dark:text-[#a19f9d]">
                        <Pill className="w-8 h-8 text-[#C8C6C4] mx-auto mb-2" />
                        <p className="font-semibold text-xs">
                          {lang === 'ar' ? 'لم يتم إضافة أدوية بعد' : 'No medications added yet'}
                        </p>
                        <p className="text-[11px] text-[#8A8886] mt-1">
                          {lang === 'ar' ? 'اختر من الأدوية المقترحة أعلاه أو اضغط المتابعة' : 'Select from suggestions above or click Continue'}
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        {medications.map((med, idx) => (
                          <div
                            key={med.id || idx}
                            className="p-3 bg-white dark:bg-[#252423] border border-[#EDEBE9] dark:border-[#3b3a39] rounded-[6px] space-y-2"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <input
                                type="text"
                                value={med.name}
                                onChange={e => handleMedChange(idx, 'name', e.target.value)}
                                className="font-bold text-xs text-[#0078D4] dark:text-[#2899f5] bg-transparent border-0 border-b border-[#EDEBE9] outline-none flex-1 py-1"
                              />
                              <button
                                type="button"
                                onClick={() => handleRemoveMedication(med.id, idx)}
                                className="p-1 text-[#605E5C] hover:text-[#A80000] cursor-pointer"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                              <div>
                                <label className="block text-[10px] text-[#605E5C] font-semibold">
                                  {lang === 'ar' ? 'أيام الصرف (Supply Days)' : 'Days Supply'}
                                </label>
                                <input
                                  type="number"
                                  inputMode="numeric"
                                  value={med.daysSupply}
                                  onChange={e => handleMedChange(idx, 'daysSupply', parseInt(e.target.value, 10) || 30)}
                                  className="w-full bg-[#FAF9F8] dark:bg-[#201f1e] border border-[#EDEBE9] dark:border-[#3b3a39] rounded-[4px] px-2 py-1 outline-none text-xs font-mono"
                                />
                              </div>

                              <div>
                                <label className="block text-[10px] text-[#605E5C] font-semibold">
                                  {lang === 'ar' ? 'تاريخ الصرف' : 'Dispense Date'}
                                </label>
                                <input
                                  type="date"
                                  dir="ltr"
                                  value={med.lastDispenseDate}
                                  onChange={e => handleMedChange(idx, 'lastDispenseDate', e.target.value)}
                                  className="w-full bg-[#FAF9F8] dark:bg-[#201f1e] border border-[#EDEBE9] dark:border-[#3b3a39] rounded-[4px] px-2 py-1 outline-none text-xs font-mono"
                                />
                              </div>

                              <div>
                                <label className="block text-[10px] text-[#605E5C] font-semibold">
                                  {lang === 'ar' ? 'الجرعة والتوقيت' : 'Timing'}
                                </label>
                                <select
                                  value={med.timing || 'morning'}
                                  onChange={e => handleMedChange(idx, 'timing', e.target.value)}
                                  className="w-full bg-[#FAF9F8] dark:bg-[#201f1e] border border-[#EDEBE9] dark:border-[#3b3a39] rounded-[4px] px-2 py-1 outline-none text-xs cursor-pointer"
                                >
                                  <option value="morning">{lang === 'ar' ? 'صباحاً' : 'Morning'}</option>
                                  <option value="noon">{lang === 'ar' ? 'ظهراً' : 'Noon'}</option>
                                  <option value="evening">{lang === 'ar' ? 'مساءً' : 'Evening'}</option>
                                  <option value="bedtime">{lang === 'ar' ? 'قبل النوم' : 'Bedtime'}</option>
                                  <option value="bid">{lang === 'ar' ? 'مرتين يومياً' : 'Twice Daily (BID)'}</option>
                                </select>
                              </div>

                              <div>
                                <label className="block text-[10px] text-[#605E5C] font-semibold">
                                  {lang === 'ar' ? 'العلاقة بالطعام' : 'Meal Relation'}
                                </label>
                                <select
                                  value={med.mealRelation || 'after_meal'}
                                  onChange={e => handleMedChange(idx, 'mealRelation', e.target.value)}
                                  className="w-full bg-[#FAF9F8] dark:bg-[#201f1e] border border-[#EDEBE9] dark:border-[#3b3a39] rounded-[4px] px-2 py-1 outline-none text-xs cursor-pointer"
                                >
                                  <option value="before_meal">{lang === 'ar' ? 'قبل الطعام' : 'Before Meal'}</option>
                                  <option value="with_meal">{lang === 'ar' ? 'مع الطعام' : 'With Meal'}</option>
                                  <option value="after_meal">{lang === 'ar' ? 'بعد الطعام' : 'After Meal'}</option>
                                  <option value="empty_stomach">{lang === 'ar' ? 'معدة فارغة' : 'Empty Stomach'}</option>
                                </select>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* STEP 3: REVIEW & CONFIRM */}
              {step === 3 && (
                <div className="space-y-4 animate-in fade-in duration-150">
                  <h3 className="font-bold text-sm text-[#242424] dark:text-[#f3f2f1]">
                    {lang === 'ar' ? 'مراجعة بيانات المريض قبل الحفظ النهائى' : 'Review Patient Details Before Saving'}
                  </h3>

                  {/* Summary Card 1: Patient Info */}
                  <div className="p-3.5 bg-[#FAF9F8] dark:bg-[#252423] border border-[#EDEBE9] dark:border-[#3b3a39] rounded-[6px] space-y-2">
                    <div className="flex items-center justify-between border-b border-[#EDEBE9] dark:border-[#3b3a39] pb-2">
                      <span className="font-bold text-xs text-[#0078D4] dark:text-[#2899f5] flex items-center gap-1.5">
                        <User className="w-4 h-4" />
                        <span>{lang === 'ar' ? 'البيانات الشخصية الهامة' : 'Patient Information'}</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => setStep(1)}
                        className="text-xs font-semibold text-[#0078D4] hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>{lang === 'ar' ? 'تعديل' : 'Edit'}</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-[#605E5C] block">{lang === 'ar' ? 'الاسم:' : 'Name:'}</span>
                        <strong className="text-[#242424] dark:text-[#f3f2f1]">{formData.name}</strong>
                      </div>

                      <div>
                        <span className="text-[#605E5C] block">{lang === 'ar' ? 'الهاتف:' : 'Phone:'}</span>
                        {formData.phoneUnavailable ? (
                          <span className="text-[#A80000] font-semibold">{lang === 'ar' ? 'غير متوفر' : 'Unavailable'}</span>
                        ) : (
                          <strong className="font-mono text-[#242424] dark:text-[#f3f2f1]">{formData.phone}</strong>
                        )}
                      </div>

                      <div>
                        <span className="text-[#605E5C] block">{lang === 'ar' ? 'العمر / الجنس:' : 'Age / Gender:'}</span>
                        <span>{formData.age ? `${formData.age} سنة` : 'غير محدد'} • {formData.gender}</span>
                      </div>

                      <div>
                        <span className="text-[#605E5C] block">{lang === 'ar' ? 'رمز العائلة:' : 'Family Tag:'}</span>
                        <span>{formData.familyTag || 'لا يوجد'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Summary Card 2: Allergies */}
                  <div className="p-3.5 bg-[#FAF9F8] dark:bg-[#252423] border border-[#EDEBE9] dark:border-[#3b3a39] rounded-[6px] space-y-2">
                    <div className="flex items-center justify-between border-b border-[#EDEBE9] dark:border-[#3b3a39] pb-2">
                      <span className="font-bold text-xs text-[#0078D4] dark:text-[#2899f5] flex items-center gap-1.5">
                        <ShieldAlert className="w-4 h-4" />
                        <span>{lang === 'ar' ? 'توثيق الحساسية الدوائية' : 'Allergy Documentation'}</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => setStep(1)}
                        className="text-xs font-semibold text-[#0078D4] hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>{lang === 'ar' ? 'تعديل' : 'Edit'}</span>
                      </button>
                    </div>

                    <div className="text-xs">
                      {formData.allergiesStatus === 'not_recorded' && (
                        <span className="text-[#605E5C] font-semibold">{lang === 'ar' ? 'لم يتم تسجيل الحساسية بعد (Not recorded)' : 'Not recorded'}</span>
                      )}
                      {formData.allergiesStatus === 'nkda' && (
                        <span className="text-[#107C41] font-semibold">{lang === 'ar' ? 'لا توجد حساسية معروفة (NKDA)' : 'NKDA (No Known Allergies)'}</span>
                      )}
                      {formData.allergiesStatus === 'recorded' && (
                        <span className="text-[#A80000] font-bold">⚠️ {formData.allergies}</span>
                      )}
                    </div>
                  </div>

                  {/* Summary Card 3: Prescribed Meds */}
                  <div className="p-3.5 bg-[#FAF9F8] dark:bg-[#252423] border border-[#EDEBE9] dark:border-[#3b3a39] rounded-[6px] space-y-2">
                    <div className="flex items-center justify-between border-b border-[#EDEBE9] dark:border-[#3b3a39] pb-2">
                      <span className="font-bold text-xs text-[#0078D4] dark:text-[#2899f5] flex items-center gap-1.5">
                        <Pill className="w-4 h-4" />
                        <span>{lang === 'ar' ? `الأدوية المسجلة بالخطة (${medications.length})` : `Prescribed Meds (${medications.length})`}</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => setStep(2)}
                        className="text-xs font-semibold text-[#0078D4] hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>{lang === 'ar' ? 'تعديل' : 'Edit'}</span>
                      </button>
                    </div>

                    {medications.length === 0 ? (
                      <p className="text-xs text-[#605E5C] italic">
                        {lang === 'ar' ? 'لم يتم تسجيل أدوية في مرحلة التسجيل الأولى.' : 'No medications added in initial registration.'}
                      </p>
                    ) : (
                      <div className="space-y-1.5">
                        {medications.map((m, idx) => (
                          <div key={idx} className="flex items-center justify-between text-xs py-1 border-b border-[#EDEBE9]/60 dark:border-[#3b3a39]/60 last:border-0">
                            <span className="font-semibold text-[#242424] dark:text-[#f3f2f1]">
                              {idx + 1}. {m.name}
                            </span>
                            <span className="text-[11px] font-mono text-[#605E5C]">
                              {m.daysSupply} {lang === 'ar' ? 'يوم' : 'days'}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* MODAL FOOTER */}
        {!savedPatientResult && (
          <div className="px-4 py-3 bg-[#FAF9F8] dark:bg-[#2d2c2c] border-t border-[#EDEBE9] dark:border-[#3b3a39] flex items-center justify-between pb-safe">
            {step > 1 ? (
              <button
                type="button"
                onClick={() => setStep(step - 1)}
                className="min-h-[44px] px-4 py-2 bg-white dark:bg-[#252423] border border-[#EDEBE9] dark:border-[#3b3a39] text-[#242424] dark:text-[#f3f2f1] hover:bg-[#FAF9F8] rounded-[4px] font-semibold text-xs flex items-center gap-1.5 cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
                <span>{lang === 'ar' ? 'السابق' : 'Back'}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSafeCloseModal}
                className="min-h-[44px] px-3 py-2 text-[#605E5C] hover:text-[#242424] font-semibold text-xs cursor-pointer"
              >
                {lang === 'ar' ? 'إلغاء' : 'Cancel'}
              </button>
            )}

            {step < 3 ? (
              <button
                type="button"
                onClick={step === 1 ? handleGoToStep2 : () => setStep(3)}
                className="min-h-[44px] px-5 py-2 bg-[#0078D4] hover:bg-[#106EBE] active:bg-[#005A9E] text-white rounded-[4px] font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-sm transition-colors"
              >
                <span>{lang === 'ar' ? 'المتابعة للخطوة التالية' : 'Continue'}</span>
                <ChevronLeft className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                disabled={isSaving}
                onClick={handleFinalSave}
                className={`min-h-[48px] px-6 py-2.5 bg-[#107C41] hover:bg-[#0e6e39] active:bg-[#0b5c30] text-white rounded-[6px] font-bold text-sm flex items-center gap-2 cursor-pointer shadow-md transition-all ${
                  isSaving ? 'opacity-60 cursor-not-allowed' : ''
                }`}
              >
                <Save className="w-4 h-4 text-white" />
                <span>
                  {isSaving
                    ? (lang === 'ar' ? 'جارِ الحفظ...' : 'Saving...')
                    : (lang === 'ar' ? 'تأكيد وحفظ المريض 💾' : 'Confirm & Save Patient 💾')}
                </span>
              </button>
            )}
          </div>
        )}

        {/* Discard Draft Confirmation Modal */}
        {showDiscardConfirm && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
            <div className="bg-white dark:bg-[#201f1e] border border-[#EDEBE9] dark:border-[#3b3a39] p-4 rounded-[6px] max-w-sm w-full space-y-3 shadow-xl">
              <h4 className="font-bold text-sm text-[#242424] dark:text-[#f3f2f1]">
                {lang === 'ar' ? 'إغلاق التسجيل السريع؟' : 'Close Quick Registration?'}
              </h4>
              <p className="text-xs text-[#605E5C] dark:text-[#a19f9d]">
                {lang === 'ar'
                  ? 'سيتم حفظ مسودتك تلقائياً حتى تتمكن من استئناف التسجيل في أي وقت.'
                  : 'Your draft progress will be saved so you can resume anytime.'}
              </p>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  onClick={() => setShowDiscardConfirm(false)}
                  className="px-3 py-1.5 bg-[#EDEBE9] dark:bg-[#3b3a39] text-[#242424] dark:text-[#f3f2f1] text-xs font-semibold rounded-[4px] cursor-pointer"
                >
                  {lang === 'ar' ? 'البقاء' : 'Stay'}
                </button>
                <button
                  onClick={() => {
                    setShowDiscardConfirm(false);
                    onClose();
                  }}
                  className="px-3 py-1.5 bg-[#A80000] text-white text-xs font-semibold rounded-[4px] cursor-pointer"
                >
                  {lang === 'ar' ? 'إغلاق وحفظ المسودة' : 'Close & Keep Draft'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
