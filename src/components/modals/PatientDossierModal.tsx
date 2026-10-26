import React, { useState, useEffect, useRef } from 'react';
import {
  FileText,
  X,
  HeartPulse,
  Image as ImageIcon,
  Calendar,
  Printer,
  Copy,
  MessageSquare,
  Plus,
  Trash2,
  ExternalLink,
  ShieldAlert,
  ZoomIn,
  UploadCloud,
  CheckCircle2,
  HardDrive,
  User,
  Sparkles,
  ShoppingBag,
  Truck,
  AlertTriangle,
  Zap,
  Clock,
  Phone,
  Microscope,
  Search,
  Filter,
  Layers,
  Maximize2,
  Minimize2,
  Save,
  Loader2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import QRCode from 'qrcode';
import { Patient, Medication, VitalsEntry, LabScan, FollowUpEntry, RefillRecord } from '../../types/pharmacy';
import { MedicationRefillTimeline } from '../medications/MedicationRefillTimeline';
import { LabTrackerPanel } from '../labs/LabTrackerPanel';
import {
  getDrugScheduleSuggestion,
} from '../../data/drugDatabase';
import {
  formatYMD,
  formatPhoneForWhatsApp,
  calculatePatientAge,
  generateThermalSlipText,
  calculateDaysRemaining,
} from '../../utils/pharmacyCalculations';
import { uploadScanImageToDrive } from '../../services/apiService';
import { PatientAdherenceVitalsChart } from '../charts/PatientAdherenceVitalsChart';
import { ImagePreviewModal } from './ImagePreviewModal';
import {
  getCrossSellRecommendations,
  getPatientLabRadar,
  generateLabTestWhatsAppReminder,
  generateOneClickWhatsAppRefill,
  CrossSellItem,
} from '../../utils/clinicalIntelligence';
import { AiRxExtractionModal } from './AiRxExtractionModal';
import { saveScanImage, getScanImage, enrichPatientScans, deleteScanImage } from '../../utils/scanStorage';
import { compressMedicalImage } from '../../utils/imageCompressor';

// Internal Scan Card subcomponent with reliable IndexedDB + Google Drive resolution
const ScanCard: React.FC<{
  scan: LabScan;
  lang: 'ar' | 'en';
  onPreview: (scan: LabScan) => void;
  onDelete: (scanId: string) => void;
}> = ({ scan, lang, onPreview, onDelete }) => {
  const [imgSrc, setImgSrc] = useState<string>(scan.dataUrl || scan.previewUrl || scan.thumbnailUrl || scan.driveUrl || '');
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    let active = true;
    if (scan.dataUrl && scan.dataUrl.length > 50) {
      setImgSrc(scan.dataUrl);
      return;
    }

    if (scan.id) {
      getScanImage(scan.id).then(cached => {
        if (active && cached && cached.length > 50) {
          setImgSrc(cached);
        }
      });
    }

    if (scan.previewUrl) {
      setImgSrc(scan.previewUrl);
    } else if (scan.fileId) {
      setImgSrc(`https://lh3.googleusercontent.com/d/${scan.fileId}`);
    } else if (scan.driveUrl) {
      const match = scan.driveUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
      if (match && match[1]) {
        setImgSrc(`https://lh3.googleusercontent.com/d/${match[1]}`);
      }
    }

    return () => {
      active = false;
    };
  }, [scan.id, scan.dataUrl, scan.previewUrl, scan.driveUrl, scan.fileId]);

  return (
    <div className="border border-[#EDEBE9] dark:border-[#3b3a39] rounded-[4px] overflow-hidden bg-white dark:bg-[#252423] group relative flex flex-col hover:border-[#0078D4] dark:hover:border-[#2899f5] transition-colors">
      {/* Image Thumbnail Container */}
      <div
        onClick={() => onPreview({ ...scan, dataUrl: imgSrc || scan.dataUrl })}
        className="relative h-40 bg-[#FAF9F8] dark:bg-[#2d2c2c] cursor-pointer overflow-hidden flex items-center justify-center group border-b border-[#EDEBE9] dark:border-[#3b3a39]"
        title={lang === 'ar' ? 'اضغط للمعاينة بالدقة الكاملة' : 'Click for full-res preview'}
      >
        {imgSrc && !hasError ? (
          <img
            src={imgSrc}
            alt={scan.title || 'Scan'}
            onError={() => {
              if (!hasError && scan.fileId && !imgSrc.includes('thumbnail')) {
                setImgSrc(`https://drive.google.com/thumbnail?id=${scan.fileId}&sz=w2000`);
                setHasError(true);
              } else {
                setHasError(true);
              }
            }}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex flex-col items-center justify-center gap-1.5 text-[#605E5C] dark:text-[#a19f9d]">
            <ImageIcon className="w-8 h-8 text-[#605E5C] dark:text-[#a19f9d]" />
            <span className="text-[10px] text-[#605E5C] dark:text-[#a19f9d]">{lang === 'ar' ? 'انقر للمعاينة' : 'Click to inspect'}</span>
          </div>
        )}

        {/* Hover Overlay */}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
          <span className="px-3 py-1.5 rounded-[4px] bg-[#0078D4] text-white font-semibold text-xs flex items-center gap-1.5">
            <ZoomIn className="w-4 h-4 text-white" />
            <span>{lang === 'ar' ? 'معاينة بالدقة الكاملة' : 'Full Preview'}</span>
          </span>
        </div>

        {/* Storage badge */}
        <div className="absolute top-2 left-2">
          {scan.driveUrl ? (
            <span className="text-[10px] px-2 py-0.5 rounded-[4px] bg-[#EFF6FC] dark:bg-[#112338] text-[#0078D4] dark:text-[#60a5fa] border border-[#C7E0F4] dark:border-[#1e3a8a] font-semibold flex items-center gap-1">
              <span>☁️ Drive</span>
            </span>
          ) : (
            <span className="text-[10px] px-2 py-0.5 rounded-[4px] bg-white dark:bg-[#201f1e] text-[#242424] dark:text-[#f3f2f1] border border-[#EDEBE9] dark:border-[#3b3a39] font-semibold flex items-center gap-1">
              <span>💾 Local</span>
            </span>
          )}
        </div>
      </div>

      {/* Card Footer Details */}
      <div className="p-2.5 bg-white dark:bg-[#252423] border-t border-[#EDEBE9] dark:border-[#3b3a39] flex-1 flex flex-col justify-between gap-2">
        <div>
          <div className="font-semibold text-xs text-[#242424] dark:text-[#f3f2f1] truncate" title={scan.title}>
            {scan.title || (lang === 'ar' ? 'وصفة طبية' : 'Prescription Scan')}
          </div>
          <div className="text-[10px] text-[#605E5C] dark:text-[#a19f9d] flex items-center justify-between mt-1 font-mono">
            <span>{scan.date}</span>
            {scan.fileSize && <span>{scan.fileSize}</span>}
          </div>
        </div>

        <div className="flex items-center justify-between pt-1 border-t border-[#EDEBE9] dark:border-[#3b3a39] gap-1">
          <button
            type="button"
            onClick={() => onPreview({ ...scan, dataUrl: imgSrc || scan.dataUrl })}
            className="text-[11px] font-semibold text-[#0078D4] dark:text-[#2899f5] hover:underline flex items-center gap-1 cursor-pointer"
          >
            <ZoomIn className="w-3.5 h-3.5" />
            <span>{lang === 'ar' ? 'معاينة' : 'Preview'}</span>
          </button>

          <div className="flex items-center gap-1">
            {scan.driveUrl && (
              <a
                href={scan.driveUrl}
                target="_blank"
                rel="noreferrer"
                title={lang === 'ar' ? 'فتح في Google Drive' : 'Open in Google Drive'}
                className="p-1 rounded-[4px] text-[#605E5C] dark:text-[#a19f9d] hover:text-[#0078D4] dark:hover:text-[#2899f5] transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
            <button
              type="button"
              onClick={() => onDelete(scan.id!)}
              title={lang === 'ar' ? 'حذف الصورة' : 'Delete'}
              className="p-1 rounded-[4px] text-[#605E5C] dark:text-[#a19f9d] hover:text-[#A80000] dark:hover:text-[#f87171] transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

interface PatientDossierModalProps {
  isOpen: boolean;
  onClose: () => void;
  patient: Patient | null;
  patients?: Patient[];
  initialTab?: string;
  followUps?: FollowUpEntry[];
  pharmacyName: string;
  gasUrl: string;
  lang: 'ar' | 'en';
  onSavePatient: (patient: Patient) => void;
  onDeletePatient?: (patientId: string) => void;
  onOpenHouseholdModal: (familyTag: string) => void;
  onOpenNewFollowUp?: () => void;
  onShowToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export const PatientDossierModal: React.FC<PatientDossierModalProps> = ({
  isOpen,
  onClose,
  patient,
  patients = [],
  initialTab = 'regimen',
  followUps = [],
  pharmacyName,
  gasUrl,
  lang,
  onSavePatient,
  onDeletePatient,
  onOpenHouseholdModal,
  onOpenNewFollowUp,
  onShowToast,
}) => {
  const [activeTab, setActiveTab] = useState<string>(initialTab);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [showUnsavedConfirm, setShowUnsavedConfirm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Form state
  const [formData, setFormData] = useState<Patient>({
    id: '',
    name: '',
    phone: '',
    dob: '',
    age: 0,
    gender: 'M',
    familyTag: '',
    loyaltyPoints: 0,
    allergies: '',
    allergiesStatus: 'not_recorded',
    hasAcknowledgedSharedPhone: false,
    notes: '',
    medications: [],
    vitals: [],
    labResults: [],
    scans: [],
    createdAt: new Date().toISOString(),
    isArchived: false,
  });

  // Vitals inputs
  const [newSys, setNewSys] = useState('');
  const [newDia, setNewDia] = useState('');
  const [newSugar, setNewSugar] = useState('');
  const [newMisc, setNewMisc] = useState('');

  // Thermal QR code
  const [qrDataUrl, setQrDataUrl] = useState<string>('');

  // Scan upload & In-app preview state
  const [isUploadingScan, setIsUploadingScan] = useState(false);
  const [previewingScan, setPreviewingScan] = useState<LabScan | null>(null);
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [medSearchTerm, setMedSearchTerm] = useState<string>('');
  const [medFilterStatus, setMedFilterStatus] = useState<'all' | 'overdue' | 'dueSoon' | 'stable'>('all');
  const [expandAllTimelines, setExpandAllTimelines] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const firstMedInputRef = useRef<HTMLInputElement>(null);
  const tabsScrollRef = useRef<HTMLDivElement>(null);
  const tabButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  // Auto-scroll active tab into view when activeTab changes (phone & touch friendly)
  useEffect(() => {
    if (tabButtonRefs.current[activeTab]) {
      tabButtonRefs.current[activeTab]?.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center',
      });
    }
  }, [activeTab]);

  const handleScrollTabs = (direction: 'left' | 'right') => {
    if (tabsScrollRef.current) {
      const scrollOffset = direction === 'left' ? -180 : 180;
      tabsScrollRef.current.scrollBy({ left: scrollOffset, behavior: 'smooth' });
    }
  };

  // Track loaded patient ID and open state to prevent flickering and re-render loops
  const lastLoadedPatientIdRef = useRef<string | null>(null);
  const isCurrentlyOpenRef = useRef<boolean>(false);

  useEffect(() => {
    if (!isOpen) {
      isCurrentlyOpenRef.current = false;
      lastLoadedPatientIdRef.current = null;
      return;
    }

    const currentPatientKey = patient?.id || '__NEW_PATIENT__';

    if (!isCurrentlyOpenRef.current || lastLoadedPatientIdRef.current !== currentPatientKey) {
      isCurrentlyOpenRef.current = true;
      lastLoadedPatientIdRef.current = currentPatientKey;

      if (patient) {
        setFormData({
          ...patient,
          medications: patient.medications ? [...patient.medications] : [],
          vitals: patient.vitals ? [...patient.vitals] : [],
          labResults: patient.labResults ? [...patient.labResults] : [],
          scans: patient.scans ? [...patient.scans] : [],
        });

        enrichPatientScans(patient).then(enriched => {
          if (enriched && Array.isArray(enriched.scans) && enriched.scans.length > 0) {
            setFormData(prev => {
              if (prev.id !== patient.id) return prev;
              return {
                ...prev,
                scans: enriched.scans,
              };
            });
          }
        });
      } else {
        setFormData({
          id: 'PT-' + Date.now().toString().slice(-6),
          name: '',
          phone: '',
          dob: '',
          age: 0,
          gender: 'M',
          familyTag: '',
          loyaltyPoints: 0,
          allergies: '',
          notes: '',
          medications: [
            {
              name: '',
              lastDispenseDate: formatYMD(new Date()),
              daysSupply: 30,
              timing: 'morning',
              mealRelation: 'after_meal',
            },
          ],
          vitals: [],
          labResults: [],
          scans: [],
          createdAt: new Date().toISOString(),
          isArchived: false,
        });
      }

      setIsDirty(false);
      setShowUnsavedConfirm(false);
      setActiveTab(initialTab || 'regimen');
    }
  }, [isOpen, patient?.id, initialTab]);

  const matchingPhonePatients = React.useMemo(() => {
    if (!formData.phone || formData.phone.trim().length < 5) return [];
    const cleanedInput = formData.phone.replace(/\D/g, '');
    return (patients || []).filter(
      p => p.id !== formData.id && p.phone && p.phone.replace(/\D/g, '') === cleanedInput
    );
  }, [patients, formData.id, formData.phone]);

  const handleSafeClose = () => {
    if (isDirty) {
      setShowUnsavedConfirm(true);
    } else {
      onClose();
    }
  };

  useEffect(() => {
    if (activeTab === 'thermal' && formData.name) {
      const summary = `PATIENT: ${formData.name} | TEL: ${formData.phone} | MEDS: ${(formData.medications || []).map(m => m.name).filter(Boolean).join(', ')}`;
      QRCode.toDataURL(summary, { margin: 1, width: 140 }, (err, url) => {
        if (!err && url) setQrDataUrl(url);
      });
    }
  }, [activeTab, formData.name, formData.phone, formData.medications]);

  if (!isOpen) return null;

  const handleDobChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    const age = calculatePatientAge(val);
    setFormData(prev => ({ ...prev, dob: val, age }));
  };

  const handleAddMedication = () => {
    setFormData(prev => ({
      ...prev,
      medications: [
        {
          id: `med-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          name: '',
          lastDispenseDate: formatYMD(new Date()),
          daysSupply: '' as any,
          timing: 'morning',
          mealRelation: 'after_meal',
        },
        ...prev.medications,
      ],
    }));
    setTimeout(() => {
      firstMedInputRef.current?.focus();
    }, 60);
  };

  const handleApplyAiRx = (data: { name: string; phone: string; age?: number; medications: Medication[] }) => {
    setFormData(prev => {
      let newDob = prev.dob;
      let newAge = prev.age;
      if (data.age && (!prev.age || prev.age === 0)) {
        newAge = data.age;
        const approxYear = new Date().getFullYear() - data.age;
        newDob = `${approxYear}-01-01`;
      }
      return {
        ...prev,
        name: data.name && data.name !== 'مريض غير مسجل' ? data.name : prev.name || data.name,
        phone: data.phone || prev.phone,
        age: newAge,
        dob: newDob,
        medications: data.medications.length > 0 ? [...data.medications, ...prev.medications] : prev.medications,
      };
    });
    onShowToast(lang === 'ar' ? 'تم تطبيق بيانات الروشتة في الملف' : 'Prescription applied to dossier', 'success');
  };

  const handleAddCrossSellToRegimen = (item: CrossSellItem) => {
    const isAlreadyAdded = formData.medications.some(m => m.name.toLowerCase().includes(item.name.toLowerCase()));
    if (isAlreadyAdded) {
      onShowToast(lang === 'ar' ? 'هذا المكمل مسجل بالفعل في الخطة' : 'Item already in regimen', 'info');
      return;
    }
    setFormData(prev => ({
      ...prev,
      medications: [
        {
          id: `med-${Date.now()}`,
          name: item.name,
          lastDispenseDate: formatYMD(new Date()),
          daysSupply: '' as any,
          timing: 'morning',
          mealRelation: 'after_meal',
        },
        ...prev.medications,
      ],
    }));
    onShowToast(
      lang === 'ar' ? `تمت إضافة (${item.name}) إلى قائمة الأدوية المقررة` : `Added ${item.name} to regimen`,
      'success'
    );
  };

  const handleRemoveMedication = (index: number) => {
    setFormData(prev => ({
      ...prev,
      medications: prev.medications.filter((_, i) => i !== index),
    }));
  };

  const handleMedChange = (index: number, field: keyof Medication, val: any) => {
    setFormData(prev => {
      const copy = [...prev.medications];
      copy[index] = { ...copy[index], [field]: val };

      if (field === 'name' && val) {
        const suggestion = getDrugScheduleSuggestion(val);
        copy[index].timing = suggestion.timing;
        copy[index].mealRelation = suggestion.mealRelation;
      }
      return { ...prev, medications: copy };
    });
  };

  const handleUpdateMedRefillHistory = (medIndex: number, newHistory: RefillRecord[]) => {
    setFormData(prev => {
      const copy = [...prev.medications];
      if (copy[medIndex]) {
        copy[medIndex] = {
          ...copy[medIndex],
          refillHistory: newHistory,
        };
      }
      return { ...prev, medications: copy };
    });
  };

  const handleFastRefillAllMeds = (days = 30) => {
    const today = formatYMD(new Date());
    setFormData(prev => ({
      ...prev,
      medications: prev.medications.map(m => {
        if (!m.name.trim()) return m;
        const medDays = Number(m.daysSupply) > 0 ? Number(m.daysSupply) : (days || 30);
        const newRecord: RefillRecord = {
          date: today,
          daysSupply: medDays,
          note: 'صرف سريع بالصيدلية (Fast Refill All)',
        };
        const updatedHistory = [...(m.refillHistory || []), newRecord];
        return {
          ...m,
          lastDispenseDate: today,
          daysSupply: medDays,
          refillHistory: updatedHistory,
        };
      }),
    }));
    onShowToast(
      lang === 'ar'
        ? '⚡ تم تكرار وصرف جميع الأدوية بنجاح بحسب أيام الصرف المقررة لكل دواء'
        : '⚡ Refilled all medications from today based on their days supply',
      'success'
    );
  };

  const handleFastRefillSingleMed = (medIndex: number, days = 30) => {
    const today = formatYMD(new Date());
    const targetMed = formData.medications[medIndex];
    if (!targetMed) return;

    setFormData(prev => {
      const copy = [...prev.medications];
      const target = copy[medIndex];
      if (!target) return prev;
      const newRecord: RefillRecord = {
        date: today,
        daysSupply: days,
        note: 'صرف سريع (Fast Refill)',
      };
      copy[medIndex] = {
        ...target,
        lastDispenseDate: today,
        daysSupply: days,
        refillHistory: [...(target.refillHistory || []), newRecord],
      };
      return {
        ...prev,
        medications: copy,
      };
    });
    onShowToast(
      lang === 'ar'
        ? `⚡ تم تكرار وصرف (${targetMed.name}) لـ ${days} يوماً`
        : `⚡ Refilled ${targetMed.name} for ${days} days`,
      'success'
    );
  };

  const handleOneClickWhatsAppRefill = () => {
    if (!formData.phone) {
      onShowToast(lang === 'ar' ? 'رقم هاتف المريض غير مسجل' : 'No phone number', 'error');
      return;
    }
    const cleanMeds = formData.medications.filter(m => m.name.trim());
    if (cleanMeds.length === 0) {
      onShowToast(lang === 'ar' ? 'لا توجد أدوية مسجلة' : 'No medications', 'error');
      return;
    }
    const { encodedUrl } = generateOneClickWhatsAppRefill({
      patient: formData,
      selectedMedications: cleanMeds.map(m => m.name.trim()),
      pharmacyName,
      includeDelivery: true,
    });
    window.open(encodedUrl, '_blank');
    onShowToast(lang === 'ar' ? 'تم فتح WhatsApp لحجز التكرار والتوصيل' : 'Opened WhatsApp Refill', 'success');
  };

  const handleAddVitals = () => {
    if (!newSys && !newSugar) {
      onShowToast(lang === 'ar' ? 'يرجى إدخال الضغط أو السكر على الأقل' : 'Enter BP or Glucose', 'error');
      return;
    }

    const sysNum = parseInt(newSys, 10);
    const diaNum = parseInt(newDia, 10);
    const sugarNum = parseInt(newSugar, 10);

    const bpStr = newSys && newDia ? `${newSys}/${newDia}` : newSys ? `${newSys}/—` : '—';
    const entry: VitalsEntry = {
      id: 'v-' + Date.now(),
      date: new Date().toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US'),
      bp: bpStr,
      systolic: isNaN(sysNum) ? undefined : sysNum,
      diastolic: isNaN(diaNum) ? undefined : diaNum,
      sugar: newSugar || '—',
      glucose: isNaN(sugarNum) ? undefined : sugarNum,
      misc: newMisc || (lang === 'ar' ? 'قراءة روتينية' : 'Routine Reading'),
      assessment:
        sysNum && sysNum >= 140
          ? (lang === 'ar' ? 'ضغط مرتفع (يحتاج متابعة)' : 'High BP (Follow up)')
          : sugarNum && sugarNum >= 180
          ? (lang === 'ar' ? 'سكر مرتفع (يحتاج ضبط)' : 'High Glucose (Adjust)')
          : (lang === 'ar' ? 'ضمن النطاق المقبول' : 'Within normal limits'),
    };

    setFormData(prev => ({
      ...prev,
      vitals: [entry, ...(prev.vitals || [])],
    }));

    setNewSys('');
    setNewDia('');
    setNewSugar('');
    setNewMisc('');
    onShowToast(lang === 'ar' ? 'تم تسجيل القراءة الحيوية بنجاح' : 'Vitals logged', 'success');
  };

  const handleScanUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingScan(true);
    try {
      const compressed = await compressMedicalImage(file, 1600, 0.82);
      const base64 = compressed.base64;
      const scanId = 'scan-' + Date.now();
      const fileSizeStr = compressed.fileSizeStr;

      await saveScanImage(scanId, base64, {
        title: file.name,
        patientId: formData.id,
        size: fileSizeStr,
      });

      const newScan: LabScan = {
        id: scanId,
        date: new Date().toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US'),
        title: file.name,
        dataUrl: base64,
        fileSize: fileSizeStr,
        uploadStatus: gasUrl ? 'uploading' : 'local_only',
      };

      setFormData(prev => ({
        ...prev,
        scans: [newScan, ...(prev.scans || [])],
      }));

      setIsUploadingScan(false);
      onShowToast(
        lang === 'ar'
          ? `تم حفظ صورة الوصفة بنجاح (${fileSizeStr})`
          : `Prescription scan saved (${fileSizeStr})`,
        'success'
      );

      if (gasUrl) {
        try {
          const driveRes = await uploadScanImageToDrive(
            gasUrl,
            formData.id || formData.name || 'Patient',
            file.name,
            base64
          );

          if (driveRes && driveRes.success) {
            const updatedScans = (formData.scans || []).map(s =>
              s.id === scanId
                ? {
                    ...s,
                    driveUrl: driveRes.fileUrl,
                    previewUrl: driveRes.previewUrl || driveRes.fileUrl,
                    thumbnailUrl: driveRes.thumbnailUrl,
                    fileId: driveRes.fileId,
                    uploadStatus: 'saved_to_drive' as const,
                  }
                : s
            );

            setFormData(prev => ({
              ...prev,
              scans: (prev.scans || []).map(s =>
                s.id === scanId
                  ? {
                      ...s,
                      driveUrl: driveRes.fileUrl,
                      previewUrl: driveRes.previewUrl || driveRes.fileUrl,
                      thumbnailUrl: driveRes.thumbnailUrl,
                      fileId: driveRes.fileId,
                      uploadStatus: 'saved_to_drive',
                    }
                  : s
              ),
            }));

            // Immediately auto-persist to Google Sheet so Drive URL appears in column 9
            if (formData.id && formData.name) {
              onSavePatient({
                ...formData,
                scans: updatedScans,
              });
            }

            onShowToast(
              lang === 'ar'
                ? 'تم رفع وحفظ الصورة بنجاح على Google Drive وتحديث الشيت ☁️'
                : 'Uploaded to Google Drive & updated Google Sheet ☁️',
              'success'
            );
          }
        } catch (driveErr) {
          console.warn('Google Drive scan upload background error:', driveErr);
        }
      }
    } catch (err: any) {
      console.error('Scan processing error:', err);
      setIsUploadingScan(false);
      onShowToast(
        lang === 'ar' ? 'حدث خطأ أثناء معالجة الصورة' : 'Error processing image',
        'error'
      );
    }
  };

  const handleDeleteScan = async (scanId: string) => {
    await deleteScanImage(scanId);
    setFormData(prev => ({
      ...prev,
      scans: (prev.scans || []).filter(s => s.id !== scanId),
    }));
    onShowToast(lang === 'ar' ? 'تم حذف الصورة' : 'Scan removed', 'info');
  };

  const handleSave = () => {
    if (isSaving) return;

    const rawName = (formData.name || '').trim();
    const fallbackId = formData.id || ('PT-' + Date.now().toString().slice(-6));
    const finalName = rawName || (lang === 'ar' ? `مريض (${fallbackId})` : `Patient (${fallbackId})`);

    const rawPhone = (formData.phone || '').trim();
    const isPhoneMissing = !rawPhone;

    const cleanMeds = (formData.medications || [])
      .filter(m => m && m.name && m.name.trim())
      .map(m => ({
        ...m,
        daysSupply: Number(m.daysSupply) > 0 ? Number(m.daysSupply) : 30,
      }));

    const finalPatient: Patient = {
      ...formData,
      id: fallbackId,
      name: finalName,
      phone: rawPhone,
      phoneUnavailable: isPhoneMissing ? true : Boolean(formData.phoneUnavailable),
      hasAcknowledgedSharedPhone: true,
      medications: cleanMeds,
      vitals: formData.vitals || [],
      scans: formData.scans || [],
      labResults: formData.labResults || [],
      createdAt: formData.createdAt || new Date().toISOString(),
    };

    setIsSaving(true);
    setIsDirty(false);

    try {
      onSavePatient(finalPatient);
      onShowToast(
        lang === 'ar'
          ? `تم حفظ ملف (${finalName}) بنجاح! 💾`
          : `Patient dossier (${finalName}) saved successfully! 💾`,
        'success'
      );
      onClose();
    } catch (err: any) {
      console.error('Error saving patient dossier:', err);
      onShowToast(lang === 'ar' ? 'حدث خطأ أثناء حفظ الملف' : 'Error saving dossier', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const totalMedsCount = formData.medications.filter(m => m.name.trim()).length;
  const overdueMedsCount = formData.medications.filter(
    m => m.name.trim() && calculateDaysRemaining(m.lastDispenseDate, Number(m.daysSupply) || 30) <= 0
  ).length;
  const dueSoonMedsCount = formData.medications.filter(m => {
    if (!m.name.trim()) return false;
    const d = calculateDaysRemaining(m.lastDispenseDate, Number(m.daysSupply) || 30);
    return d > 0 && d <= 3;
  }).length;
  const stableMedsCount = formData.medications.filter(m => {
    if (!m.name.trim()) return false;
    const d = calculateDaysRemaining(m.lastDispenseDate, Number(m.daysSupply) || 30);
    return d > 3;
  }).length;

  const filteredMedications = formData.medications.filter(m => {
    if (medSearchTerm.trim()) {
      const term = medSearchTerm.toLowerCase().trim();
      if (!m.name.toLowerCase().includes(term)) return false;
    }
    if (medFilterStatus === 'all') return true;
    const days = calculateDaysRemaining(m.lastDispenseDate, Number(m.daysSupply) || 30);
    if (medFilterStatus === 'overdue') return days <= 0;
    if (medFilterStatus === 'dueSoon') return days > 0 && days <= 3;
    if (medFilterStatus === 'stable') return days > 3;
    return true;
  });

  const crossSellItems = getCrossSellRecommendations(formData.medications);
  const labRadarItems = getPatientLabRadar(formData);
  const thermalSlipText = generateThermalSlipText(formData, pharmacyName);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-black/60 backdrop-blur-sm">
      <div className="bg-[#FFFFFF] dark:bg-[#201f1e] border border-[#EDEBE9] dark:border-[#3b3a39] rounded-[4px] max-w-4xl w-full shadow-lg overflow-hidden flex flex-col max-h-[92vh] text-[#242424] dark:text-[#f3f2f1]">
        {/* Modal Top Header */}
        <div className="p-3 bg-[#FAF9F8] dark:bg-[#2d2c2c] border-b border-[#EDEBE9] dark:border-[#3b3a39] flex items-center justify-between">
          <div className="font-semibold text-sm sm:text-base text-[#242424] dark:text-[#f3f2f1] flex items-center gap-2">
            <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-[#0078D4] dark:text-[#2899f5]" />
            <span>
              {formData.name
                ? `${lang === 'ar' ? 'الملف السريري:' : 'Clinical Dossier:'} ${formData.name}`
                : lang === 'ar'
                ? 'تسجيل مريض مزمن جديد'
                : 'New Chronic Patient Dossier'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsAiModalOpen(true)}
              className="flex items-center gap-1.5 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-[4px] bg-[#EFF6FC] dark:bg-[#112338] hover:bg-[#DEECF9] dark:hover:bg-[#1a365d] text-[#0078D4] dark:text-[#60a5fa] border border-[#C7E0F4] dark:border-[#1e3a8a] font-semibold text-xs transition-colors cursor-pointer"
              title={lang === 'ar' ? 'استخراج وتصحيح بيانات الروشتة بالذكاء الاصطناعي' : 'AI Rx Extraction'}
            >
              <Sparkles className="w-3.5 h-3.5 text-[#0078D4] dark:text-[#60a5fa]" />
              <span>{lang === 'ar' ? 'استخراج ذكي ⚡' : 'AI Rx Extract ⚡'}</span>
            </button>
            <button
              onClick={handleSafeClose}
              className="p-1 rounded-[4px] text-[#605E5C] dark:text-[#a19f9d] hover:text-[#242424] dark:hover:text-[#f3f2f1] hover:bg-[#EDEBE9] dark:hover:bg-[#3b3a39] transition-colors cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* HIGH-VELOCITY PHARMACY HUD BAR */}
        <div className="bg-[#FFFFFF] dark:bg-[#201f1e] px-3 py-1.5 border-b border-[#EDEBE9] dark:border-[#3b3a39] flex items-center justify-between flex-wrap gap-2 text-xs">
          {/* Patient Quick Context */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1 font-semibold text-[#242424] dark:text-[#f3f2f1]">
              <User className="w-3.5 h-3.5 text-[#0078D4] dark:text-[#2899f5] shrink-0" />
              <span>{formData.name || (lang === 'ar' ? 'مريض جديد' : 'New Patient')}</span>
              {Boolean(formData.age && formData.age > 0) && (
                <span className="text-[11px] font-normal text-[#605E5C] dark:text-[#a19f9d]">({formData.age}y)</span>
              )}
            </div>

            {/* Phone & Instant Contact */}
            {formData.phone && (
              <div className="flex items-center gap-1 font-mono text-[#242424] dark:text-[#f3f2f1] bg-[#FAF9F8] dark:bg-[#252423] px-1.5 py-0.2 rounded-[4px] border border-[#EDEBE9] dark:border-[#3b3a39]">
                <span className="text-[11px]">{formData.phone}</span>
                <button
                  type="button"
                  onClick={() => {
                    const cleanPhone = formData.phone.replace(/\D/g, '');
                    window.open(`https://wa.me/${cleanPhone}`, '_blank');
                  }}
                  title={lang === 'ar' ? 'محادثة واتساب' : 'Open WhatsApp'}
                  className="text-[#0078D4] dark:text-[#2899f5] hover:underline p-0.5 cursor-pointer"
                >
                  <MessageSquare className="w-3 h-3" />
                </button>
                <a
                  href={`tel:${formData.phone}`}
                  title={lang === 'ar' ? 'اتصال هاتف' : 'Call'}
                  className="text-[#605E5C] dark:text-[#a19f9d] hover:text-[#242424] dark:hover:text-[#f3f2f1] p-0.5"
                >
                  <Phone className="w-3 h-3" />
                </a>
              </div>
            )}

            {/* Known Allergies Clinical Radar Badge */}
            {formData.allergies ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.2 rounded-[4px] text-[10px] font-semibold bg-[#FDF3F3] dark:bg-[#3a1d1d] text-[#A80000] dark:text-[#f87171] border border-[#E0A8A8] dark:border-[#7f1d1d]">
                <AlertTriangle className="w-3 h-3 text-[#A80000] dark:text-[#f87171] shrink-0" />
                <span>{lang === 'ar' ? 'حساسية:' : 'Allergy:'} {formData.allergies}</span>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setActiveTab('demographics')}
                className="text-[10px] text-[#605E5C] dark:text-[#a19f9d] hover:text-[#242424] dark:hover:text-[#f3f2f1] transition-colors cursor-pointer"
                title={lang === 'ar' ? 'تسجيل حساسية للمريض' : 'Record allergy'}
              >
                + {lang === 'ar' ? 'حساسية' : 'Allergy'}
              </button>
            )}

            {/* Family Tag */}
            {formData.familyTag && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenHouseholdModal(formData.familyTag!);
                }}
                className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-[4px] text-[10px] font-semibold bg-[#EFF6FC] dark:bg-[#112338] text-[#0078D4] dark:text-[#60a5fa] border border-[#C7E0F4] dark:border-[#1e3a8a] hover:bg-[#DEECF9] transition-colors cursor-pointer"
                title={lang === 'ar' ? 'صرف وتوحيد العائلة' : 'Household Sync'}
              >
                <span>👨‍👩‍👧‍👦 {formData.familyTag}</span>
              </button>
            )}

            {/* Overdue Labs Alert in Top HUD */}
            {labRadarItems.filter(l => l.status === 'overdue').length > 0 && (
              <button
                type="button"
                onClick={() => setActiveTab('vitals')}
                className="inline-flex items-center gap-1 px-2 py-0.2 rounded-[4px] text-[10px] font-semibold bg-[#FDF3F3] dark:bg-[#3a1d1d] text-[#A80000] dark:text-[#f87171] border border-[#E0A8A8] dark:border-[#7f1d1d] cursor-pointer"
                title={lang === 'ar' ? 'فحوصات دورية مستحقة للمريض' : 'Overdue Lab Tests'}
              >
                <Microscope className="w-3 h-3 text-[#A80000] dark:text-[#f87171] shrink-0" />
                <span>
                  {labRadarItems.filter(l => l.status === 'overdue').length}{' '}
                  {lang === 'ar' ? 'تحاليل مستحقة' : 'Labs Overdue'}
                </span>
              </button>
            )}
          </div>

          {/* Quick Refill & Regimen Summary */}
          <div className="flex items-center gap-1.5">
            {formData.medications.length > 0 && (
              <div className="flex items-center gap-1 text-[11px]">
                {(() => {
                  const dueMeds = formData.medications.filter(m => {
                    if (!m.name.trim()) return false;
                    const r = calculateDaysRemaining(m.lastDispenseDate, m.daysSupply);
                    return r <= 3;
                  });
                  if (dueMeds.length > 0) {
                    return (
                      <span className="px-1.5 py-0.2 rounded-[4px] text-[10px] font-semibold bg-[#FDF3F3] dark:bg-[#3a1d1d] text-[#A80000] dark:text-[#f87171] border border-[#E0A8A8] dark:border-[#7f1d1d] flex items-center gap-1">
                        <Clock className="w-3 h-3 text-[#A80000] dark:text-[#f87171]" />
                        <span>{dueMeds.length} {lang === 'ar' ? 'مستحق' : 'due'}</span>
                      </span>
                    );
                  }
                  return (
                    <span className="px-1.5 py-0.2 rounded-[4px] text-[10px] font-semibold bg-[#EFF6FC] dark:bg-[#112338] text-[#0078D4] dark:text-[#60a5fa] border border-[#C7E0F4] dark:border-[#1e3a8a] flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-[#0078D4] dark:text-[#60a5fa]" />
                      <span>{lang === 'ar' ? 'منتظم' : 'Stable'}</span>
                    </span>
                  );
                })()}
              </div>
            )}

            {/* Fast 30-Day Refill All Button in HUD */}
            {formData.medications.some(m => m.name.trim()) && (
              <button
                type="button"
                onClick={() => handleFastRefillAllMeds(30)}
                className="flex items-center gap-1 px-2 py-0.5 rounded-[4px] bg-[#0078D4] hover:bg-[#106EBE] active:bg-[#005A9E] text-white font-semibold text-[10px] transition-all cursor-pointer whitespace-nowrap border-0 shadow-none min-h-[44px]"
                title={lang === 'ar' ? 'تكرار جميع الأدوية 30 يوماً وصرفها من اليوم بضغطة واحدة' : 'Fast Refill All 30 Days'}
              >
                <Zap className="w-3 h-3 text-white" />
                <span>{lang === 'ar' ? 'تكرار الكل ⚡' : 'Refill 30d ⚡'}</span>
              </button>
            )}

            {/* Instant Pocket Slip Button in HUD */}
            <button
              type="button"
              onClick={() => setActiveTab('thermal')}
              className={`flex items-center gap-1 px-2 py-0.5 rounded-[4px] font-semibold text-[10px] transition-all cursor-pointer whitespace-nowrap min-h-[44px] ${
                activeTab === 'thermal'
                  ? 'bg-[#0078D4] text-white'
                  : 'bg-[#EFF6FC] dark:bg-[#112338] hover:bg-[#DEECF9] dark:hover:bg-[#1a365d] text-[#0078D4] dark:text-[#60a5fa] border border-[#C7E0F4] dark:border-[#1e3a8a]'
              }`}
              title={lang === 'ar' ? 'عرض وطباعة البطاقة الفورية (Pocket Slip)' : 'View & Print Pocket Slip'}
            >
              <Printer className="w-3 h-3" />
              <span>{lang === 'ar' ? 'بطاقة 🖨️' : 'Slip 🖨️'}</span>
            </button>
          </div>
        </div>

        {/* Dossier Tabs - Fluent UI Pivot with High Accessibility & Phone Navigation */}
        <div
          className="bg-[#FAF9F8] dark:bg-[#2d2c2c] border-b border-[#EDEBE9] dark:border-[#3b3a39] select-none flex flex-col"
        >
          {/* Phone View Quick Selector (sm:hidden) */}
          <div className="sm:hidden flex items-center justify-between gap-2 px-3 py-1.5 bg-[#F3F2F1] dark:bg-[#252423] border-b border-[#EDEBE9] dark:border-[#383736]">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#605E5C] dark:text-[#a19f9d] shrink-0">
              <span>📑</span>
              <span>{lang === 'ar' ? 'انتقال سريع:' : 'Quick Tab:'}</span>
            </div>
            <div className="relative flex-1 max-w-[220px]">
              <select
                value={activeTab}
                onChange={e => setActiveTab(e.target.value as any)}
                aria-label={lang === 'ar' ? 'انتقال سريع لأقسام الملف' : 'Quick jump to dossier section'}
                className="w-full text-xs font-semibold bg-white dark:bg-[#201f1e] text-[#0078D4] dark:text-[#60a5fa] border border-[#0078D4]/40 dark:border-[#2899f5]/40 rounded-[4px] px-2 py-1 pr-6 focus:outline-none focus:ring-2 focus:ring-[#0078D4] shadow-xs cursor-pointer min-h-[36px]"
              >
                {[
                  { id: 'regimen', label: lang === 'ar' ? `الأدوية ومخطط الصرف ⏱️ (${formData.medications?.length || 0})` : `Regimen & Timelines ⏱️ (${formData.medications?.length || 0})` },
                  { id: 'demographics', label: lang === 'ar' ? 'البيانات الشخصية 👤' : 'Demographics & Family 👤' },
                  { id: 'analytics', label: lang === 'ar' ? 'مؤشرات الالتزام 📈' : 'Adherence Chart 📈' },
                  { id: 'vitals', label: lang === 'ar' ? `رادار التحاليل 🔬 ${labRadarItems.filter(l => l.status === 'overdue').length ? `(! ${labRadarItems.filter(l => l.status === 'overdue').length})` : ''}` : `Labs & Vitals 🔬 ${labRadarItems.filter(l => l.status === 'overdue').length ? `(! ${labRadarItems.filter(l => l.status === 'overdue').length})` : ''}` },
                  { id: 'scans', label: lang === 'ar' ? `صور الروشتات 📷 (${formData.scans?.length || 0})` : `Scans 📷 (${formData.scans?.length || 0})` },
                  { id: 'schedule', label: lang === 'ar' ? 'جدول الجرعات 💊' : 'Pill Schedule 💊' },
                  { id: 'thermal', label: lang === 'ar' ? 'البطاقة الفورية 🖨️' : 'Pocket Slip 🖨️' },
                ].map(opt => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Horizontal Scrollable Tabs with Phone Touch Controls */}
          <div className="relative flex items-center px-1 sm:px-2 py-1">
            {/* Scroll Left Button for Phone / Tablet */}
            <button
              type="button"
              onClick={() => handleScrollTabs('left')}
              aria-label={lang === 'ar' ? 'التمرير لليمين' : 'Scroll Left'}
              className="sm:hidden flex items-center justify-center w-7 h-9 rounded-[4px] text-[#605E5C] hover:text-[#242424] hover:bg-[#EDEBE9] dark:text-[#a19f9d] dark:hover:bg-[#383736] shrink-0 cursor-pointer transition-colors active:scale-95"
              title={lang === 'ar' ? 'السابق' : 'Previous'}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            {/* Scroll Container with snap scrolling & hidden scrollbar */}
            <div
              ref={tabsScrollRef}
              role="tablist"
              aria-label={lang === 'ar' ? 'أقسام ملف المريض' : 'Patient Dossier Navigation'}
              className="flex-1 flex items-center gap-1 sm:gap-1.5 overflow-x-auto scroll-smooth snap-x snap-mandatory overscroll-x-contain touch-pan-x py-0.5 px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {[
                {
                  id: 'regimen',
                  labelAr: 'الأدوية ومخطط الصرف ⏱️',
                  labelEn: 'Regimen & Timelines ⏱️',
                  shortLabelAr: 'الأدوية ⏱️',
                  shortLabelEn: 'Regimen ⏱️',
                  count: formData.medications?.length || 0,
                },
                {
                  id: 'demographics',
                  labelAr: 'البيانات الشخصية 👤',
                  labelEn: 'Demographics & Family 👤',
                  shortLabelAr: 'البيانات 👤',
                  shortLabelEn: 'Demographics 👤',
                },
                {
                  id: 'analytics',
                  labelAr: 'مؤشرات الالتزام 📈',
                  labelEn: 'Adherence Chart 📈',
                  shortLabelAr: 'الالتزام 📈',
                  shortLabelEn: 'Adherence 📈',
                },
                {
                  id: 'vitals',
                  labelAr: 'رادار التحاليل والمؤشرات 🔬',
                  labelEn: 'Labs & Vitals 🔬',
                  shortLabelAr: 'التحاليل 🔬',
                  shortLabelEn: 'Labs 🔬',
                  alert: labRadarItems.filter(l => l.status === 'overdue').length,
                },
                {
                  id: 'scans',
                  labelAr: 'صور الروشتات 📷',
                  labelEn: 'Scans 📷',
                  shortLabelAr: 'الروشتات 📷',
                  shortLabelEn: 'Scans 📷',
                  count: formData.scans?.length || 0,
                },
                {
                  id: 'schedule',
                  labelAr: 'جدول الجرعات 💊',
                  labelEn: 'Pill Schedule 💊',
                  shortLabelAr: 'الجرعات 💊',
                  shortLabelEn: 'Schedule 💊',
                },
                {
                  id: 'thermal',
                  labelAr: 'البطاقة الفورية 🖨️',
                  labelEn: 'Pocket Slip 🖨️',
                  shortLabelAr: 'البطاقة 🖨️',
                  shortLabelEn: 'Slip 🖨️',
                  isHighlight: true,
                },
              ].map(tab => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    ref={el => {
                      tabButtonRefs.current[tab.id] = el;
                    }}
                    role="tab"
                    aria-selected={isActive}
                    tabIndex={0}
                    onClick={() => setActiveTab(tab.id)}
                    className={`group shrink-0 snap-start flex items-center gap-1.5 min-h-[44px] px-2.5 sm:px-3 py-1.5 rounded-[4px] text-xs font-semibold whitespace-nowrap transition-all duration-150 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-[#0078D4] active:scale-[0.98] ${
                      isActive
                        ? 'bg-[#EFF6FC] dark:bg-[#112338] text-[#0078D4] dark:text-[#60a5fa] border border-[#C7E0F4] dark:border-[#1e3a8a] border-b-[3px] border-b-[#0078D4] dark:border-b-[#2899f5] shadow-xs'
                        : 'bg-white dark:bg-[#252423] text-[#484644] dark:text-[#a19f9d] hover:text-[#242424] dark:hover:text-[#f3f2f1] hover:bg-[#F3F2F1] dark:hover:bg-[#2d2c2c] border border-[#EDEBE9] dark:border-[#3b3a39]'
                    } ${tab.isHighlight && !isActive ? 'hover:border-[#C7E0F4] dark:hover:border-[#1e3a8a] hover:text-[#0078D4] dark:hover:text-[#60a5fa]' : ''}`}
                  >
                    {/* Compact label on mobile, full label on sm+ screens */}
                    <span className="sm:hidden font-medium">{lang === 'ar' ? tab.shortLabelAr : tab.shortLabelEn}</span>
                    <span className="hidden sm:inline">{lang === 'ar' ? tab.labelAr : tab.labelEn}</span>

                    {typeof tab.count === 'number' && (
                      <span
                        className={`text-[10px] px-1.5 py-0.2 rounded-[4px] font-mono font-bold leading-tight ${
                          isActive
                            ? 'bg-[#0078D4] text-white'
                            : 'bg-[#EDEBE9] dark:bg-[#3b3a39] text-[#605E5C] dark:text-[#a19f9d] group-hover:bg-[#E1DFDD] dark:group-hover:bg-[#484644] group-hover:text-[#242424] dark:group-hover:text-[#f3f2f1]'
                        }`}
                      >
                        {tab.count}
                      </span>
                    )}
                    {Boolean(tab.alert && tab.alert > 0) && (
                      <span
                        className="text-[10px] px-1.5 py-0.2 rounded-[4px] font-bold bg-[#FDF3F3] dark:bg-[#3a1d1d] text-[#A80000] dark:text-[#f87171] border border-[#E0A8A8] dark:border-[#7f1d1d]"
                        title={lang === 'ar' ? 'فحوصات مستحقة' : 'Overdue labs'}
                      >
                        {tab.alert} !
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Scroll Right Button for Phone / Tablet */}
            <button
              type="button"
              onClick={() => handleScrollTabs('right')}
              aria-label={lang === 'ar' ? 'التمرير لليسار' : 'Scroll Right'}
              className="sm:hidden flex items-center justify-center w-7 h-9 rounded-[4px] text-[#605E5C] hover:text-[#242424] hover:bg-[#EDEBE9] dark:text-[#a19f9d] dark:hover:bg-[#383736] shrink-0 cursor-pointer transition-colors active:scale-95"
              title={lang === 'ar' ? 'التالي' : 'Next'}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tab Body */}
        <div className="p-3 sm:p-4 overflow-y-auto space-y-3 text-xs flex-1 bg-white dark:bg-[#201f1e]">
          {/* TAB 1: REGIMEN & REFILL TIMELINES */}
          {activeTab === 'regimen' && (
            <div className="space-y-4">
              {/* High-Velocity Fast Action & Filter Toolbar */}
              <div className="bg-[#FAF9F8] dark:bg-[#2d2c2c] p-3 rounded-[4px] border border-[#EDEBE9] dark:border-[#3b3a39] space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={handleAddMedication}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-[4px] bg-[#0078D4] hover:bg-[#106EBE] active:bg-[#005A9E] text-white font-semibold text-xs cursor-pointer transition-all border-0 shadow-none"
                    >
                      <Plus className="w-3.5 h-3.5 text-white" />
                      <span>{lang === 'ar' ? 'إضافة دواء' : 'Add Medication'}</span>
                    </button>

                    {formData.medications.some(m => m.name.trim()) && (
                      <button
                        type="button"
                        onClick={() => handleFastRefillAllMeds(30)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-[4px] bg-[#FFFFFF] dark:bg-[#252423] hover:bg-[#F3F2F1] dark:hover:bg-[#3b3a39] text-[#0078D4] dark:text-[#2899f5] border border-[#C7E0F4] dark:border-[#1e3a8a] font-semibold text-xs cursor-pointer transition-all"
                      >
                        <Zap className="w-3.5 h-3.5 text-[#0078D4] dark:text-[#2899f5]" />
                        <span>{lang === 'ar' ? 'تكرار شهري للكل (30 يوم) ⚡' : 'Refill All 30d ⚡'}</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => setExpandAllTimelines(prev => !prev)}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-[4px] border text-xs font-semibold cursor-pointer transition-all ${
                        expandAllTimelines
                          ? 'bg-[#EFF6FC] dark:bg-[#112338] text-[#0078D4] dark:text-[#2899f5] border-[#C7E0F4] dark:border-[#1e3a8a]'
                          : 'bg-[#FFFFFF] dark:bg-[#252423] hover:bg-[#F3F2F1] dark:hover:bg-[#3b3a39] text-[#242424] dark:text-[#f3f2f1] border-[#EDEBE9] dark:border-[#3b3a39]'
                      }`}
                      title={lang === 'ar' ? 'عرض أو إخفاء كافة الخطوط الزمنية للأدوية' : 'Expand or collapse all refill timeline tracks'}
                    >
                      {expandAllTimelines ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                      <span>
                        {expandAllTimelines
                          ? (lang === 'ar' ? 'طي كافة المخططات' : 'Collapse All Timelines')
                          : (lang === 'ar' ? 'عرض كافة المخططات' : 'Expand All Timelines')}
                      </span>
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    {formData.phone && formData.medications.some(m => m.name.trim()) && (
                      <button
                        type="button"
                        onClick={handleOneClickWhatsAppRefill}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-[4px] bg-[#FFFFFF] dark:bg-[#252423] hover:bg-[#DEECF9] dark:hover:bg-[#1a365d] text-[#0078D4] dark:text-[#2899f5] border border-[#C7E0F4] dark:border-[#1e3a8a] font-semibold text-xs cursor-pointer transition-all"
                        title={lang === 'ar' ? 'إرسال رابط حجز التكرار الفوري وتوصيل المنازل عبر واتساب' : '1-Click WhatsApp Refill & Delivery'}
                      >
                        <Truck className="w-3.5 h-3.5 text-[#0078D4] dark:text-[#2899f5]" />
                        <span>{lang === 'ar' ? 'حجز وتوصيل واتساب 📲' : 'WhatsApp Refill 📲'}</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setActiveTab('thermal')}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-[4px] bg-white dark:bg-[#252423] hover:bg-[#EFF6FC] dark:hover:bg-[#112338] text-[#0078D4] dark:text-[#2899f5] text-xs font-semibold transition-all cursor-pointer border border-[#C7E0F4] dark:border-[#1e3a8a]"
                      title={lang === 'ar' ? 'طباعة وعرض البطاقة الفورية' : 'View & Print Pocket Slip'}
                    >
                      <Printer className="w-3.5 h-3.5 text-[#0078D4] dark:text-[#2899f5]" />
                      <span>{lang === 'ar' ? 'البطاقة الفورية 🖨️' : 'Pocket Slip 🖨️'}</span>
                    </button>
                  </div>
                </div>

                {/* Search & Status Filters Bar */}
                {formData.medications.length > 0 && (
                  <div className="flex items-center justify-between flex-wrap gap-2 pt-2 border-t border-[#EDEBE9] dark:border-[#3b3a39]">
                    {/* Search Input */}
                    <div className="relative flex-1 min-w-[200px]">
                      <Search className="w-3.5 h-3.5 text-[#605E5C] dark:text-[#a19f9d] absolute left-2.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={medSearchTerm}
                        onChange={e => setMedSearchTerm(e.target.value)}
                        placeholder={lang === 'ar' ? 'بحث باسم الدواء...' : 'Filter by drug name...'}
                        className="w-full bg-[#FFFFFF] dark:bg-[#201f1e] border border-[#EDEBE9] dark:border-[#3b3a39] pl-8 pr-2.5 py-1 rounded-[4px] text-xs text-[#242424] dark:text-[#f3f2f1] outline-none focus:border-[#0078D4] dark:focus:border-[#2899f5]"
                      />
                      {medSearchTerm && (
                        <button
                          type="button"
                          onClick={() => setMedSearchTerm('')}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-[#605E5C] dark:text-[#a19f9d] hover:text-[#242424] dark:hover:text-[#f3f2f1]"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>

                    {/* Status Filter Pills */}
                    <div className="flex items-center gap-1 overflow-x-auto scrollbar-thin">
                      {[
                        { id: 'all', labelAr: 'الكل', labelEn: 'All', count: totalMedsCount },
                        { id: 'overdue', labelAr: 'منتهي الصرف ⚠️', labelEn: 'Overdue ⚠️', count: overdueMedsCount, isCritical: overdueMedsCount > 0 },
                        { id: 'dueSoon', labelAr: 'ينفذ قريباً ⏱️', labelEn: 'Due Soon ⏱️', count: dueSoonMedsCount, isWarning: dueSoonMedsCount > 0 },
                        { id: 'stable', labelAr: 'منتظم ✅', labelEn: 'Stable ✅', count: stableMedsCount },
                      ].map(f => {
                        const isActive = medFilterStatus === f.id;
                        return (
                          <button
                            key={f.id}
                            type="button"
                            onClick={() => setMedFilterStatus(f.id as any)}
                            className={`px-2.5 py-1 rounded-[4px] text-[11px] font-semibold whitespace-nowrap flex items-center gap-1 transition-all cursor-pointer ${
                              isActive
                                ? 'bg-[#0078D4] text-white shadow-2xs'
                                : f.isCritical
                                ? 'bg-[#FDF3F3] dark:bg-[#3a1d1d] text-[#A80000] dark:text-[#f87171] border border-[#E0A8A8] dark:border-[#7f1d1d]'
                                : f.isWarning
                                ? 'bg-[#FFF4CE] dark:bg-[#3a3118] text-[#7A5B00] dark:text-[#f3d370] border border-[#FFE699] dark:border-[#6a5a20]'
                                : 'bg-[#FFFFFF] dark:bg-[#201f1e] text-[#605E5C] dark:text-[#a19f9d] hover:text-[#242424] dark:hover:text-[#f3f2f1] border border-[#EDEBE9] dark:border-[#3b3a39]'
                            }`}
                          >
                            <span>{lang === 'ar' ? f.labelAr : f.labelEn}</span>
                            <span className={`text-[10px] font-mono px-1 rounded-[3px] ${
                              isActive
                                ? 'bg-white/20 text-white'
                                : 'bg-[#EDEBE9] dark:bg-[#3b3a39] text-[#242424] dark:text-[#f3f2f1]'
                            }`}>
                              {f.count}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Meds items */}
              <div className="space-y-3">
                {formData.medications.length === 0 && (
                  <div className="p-8 text-center bg-[#FAF9F8] dark:bg-[#2d2c2c] rounded-[4px] border border-dashed border-[#EDEBE9] dark:border-[#3b3a39] space-y-2">
                    <p className="text-[#605E5C] dark:text-[#a19f9d] text-xs">
                      {lang === 'ar'
                        ? 'لا توجد أدوية مسجلة بعد. اضغط على "إضافة دواء" لإدراج الأدوية ومتابعة خط زمني دقيق لمواعيد الصرف والالتزام الدوائي.'
                        : 'No medications recorded yet. Click "Add Medication" to track regimen and adherence timelines.'}
                    </p>
                  </div>
                )}

                {formData.medications.length > 0 && filteredMedications.length === 0 && (
                  <div className="p-6 text-center bg-[#FAF9F8] dark:bg-[#2d2c2c] rounded-[4px] border border-[#EDEBE9] dark:border-[#3b3a39] space-y-2">
                    <p className="text-[#605E5C] dark:text-[#a19f9d] text-xs">
                      {lang === 'ar'
                        ? 'لا توجد أدوية تطابق معايير التصفية والبحث الحالية.'
                        : 'No medications match current filter/search criteria.'}
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setMedSearchTerm('');
                        setMedFilterStatus('all');
                      }}
                      className="px-3 py-1 bg-[#0078D4] text-white rounded-[4px] text-xs font-semibold cursor-pointer"
                    >
                      {lang === 'ar' ? 'عرض جميع الأدوية' : 'Clear Filters'}
                    </button>
                  </div>
                )}

                {filteredMedications.map((m) => {
                  const actualIdx = formData.medications.findIndex(item => item === m || (item.id && item.id === m.id));
                  const idx = actualIdx !== -1 ? actualIdx : 0;

                  const daysRemaining = calculateDaysRemaining(m.lastDispenseDate, Number(m.daysSupply) || 30);
                  const isOverdue = daysRemaining <= 0;
                  const isDueSoon = daysRemaining > 0 && daysRemaining <= 3;

                  return (
                    <div
                      key={m.id || `med-row-${idx}`}
                      className="p-3.5 rounded-[4px] bg-white dark:bg-[#252423] border border-[#EDEBE9] dark:border-[#3b3a39] space-y-3 transition-all hover:border-[#0078D4] dark:hover:border-[#2899f5]"
                    >
                      {/* Medication Main Header & Details Row */}
                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-start">
                        {/* Drug Name & Status */}
                        <div className="sm:col-span-5 space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-mono font-bold text-[#0078D4] dark:text-[#2899f5] bg-[#EFF6FC] dark:bg-[#112338] px-1.5 py-0.2 rounded-[3px] border border-[#C7E0F4] dark:border-[#1e3a8a]">
                              #{idx + 1}
                            </span>
                            {m.name.trim() && (
                              <span
                                className={`text-[10px] px-2 py-0.5 rounded-[4px] font-semibold border ${
                                  isOverdue
                                    ? 'bg-[#FDF3F3] dark:bg-[#3a1d1d] text-[#A80000] dark:text-[#f87171] border-[#E0A8A8] dark:border-[#7f1d1d]'
                                    : isDueSoon
                                    ? 'bg-[#FFF4CE] dark:bg-[#3a3118] text-[#7A5B00] dark:text-[#f3d370] border-[#FFE699] dark:border-[#6a5a20]'
                                    : 'bg-[#EFF6FC] dark:bg-[#112338] text-[#0078D4] dark:text-[#2899f5] border-[#C7E0F4] dark:border-[#1e3a8a]'
                                }`}
                              >
                                {isOverdue
                                  ? `${lang === 'ar' ? 'منتهي الصرف' : 'Overdue'} (+${Math.abs(daysRemaining)} ${lang === 'ar' ? 'يوم' : 'd'})`
                                  : isDueSoon
                                  ? `${lang === 'ar' ? 'ينفذ قريباً' : 'Due Soon'} (${daysRemaining} ${lang === 'ar' ? 'يوم' : 'd'})`
                                  : `${lang === 'ar' ? 'مستقر' : 'Stable'} (${daysRemaining} ${lang === 'ar' ? 'يوم' : 'd'})`}
                              </span>
                            )}
                          </div>
                          <input
                            ref={idx === 0 ? firstMedInputRef : undefined}
                            type="text"
                            value={m.name}
                            onChange={e => handleMedChange(idx, 'name', e.target.value)}
                            placeholder="Glucophage, Concor, Lipitor..."
                            className="w-full bg-white dark:bg-[#201f1e] border border-[#EDEBE9] dark:border-[#3b3a39] p-2 rounded-[4px] text-[#242424] dark:text-[#f3f2f1] font-semibold text-xs outline-none focus:border-[#0078D4] dark:focus:border-[#2899f5]"
                          />
                        </div>

                        {/* Last Dispense Date */}
                        <div className="sm:col-span-3 space-y-1">
                          <label className="text-[10px] text-[#605E5C] dark:text-[#a19f9d] font-semibold">{lang === 'ar' ? 'تاريخ آخر صرف' : 'Last Dispense'}</label>
                          <input
                            type="date"
                            value={m.lastDispenseDate}
                            onChange={e => handleMedChange(idx, 'lastDispenseDate', e.target.value)}
                            className="w-full bg-white dark:bg-[#201f1e] border border-[#EDEBE9] dark:border-[#3b3a39] p-2 rounded-[4px] text-[#242424] dark:text-[#f3f2f1] text-xs font-mono outline-none focus:border-[#0078D4] dark:focus:border-[#2899f5]"
                          />
                        </div>

                        {/* Days Supply & Presets */}
                        <div className="sm:col-span-2 space-y-1">
                          <label className="text-[10px] text-[#605E5C] dark:text-[#a19f9d] font-semibold">{lang === 'ar' ? 'الكمية (أيام)' : 'Days'}</label>
                          <input
                            type="number"
                            min={1}
                            max={365}
                            value={m.daysSupply === undefined || m.daysSupply === null ? '' : m.daysSupply}
                            onChange={e => {
                              const rawVal = e.target.value;
                              if (rawVal === '') {
                                handleMedChange(idx, 'daysSupply', '' as any);
                              } else {
                                const parsed = parseInt(rawVal, 10);
                                handleMedChange(idx, 'daysSupply', isNaN(parsed) ? '' as any : parsed);
                              }
                            }}
                            onBlur={() => {}}
                            placeholder=""
                            className="w-full bg-white dark:bg-[#201f1e] border border-[#EDEBE9] dark:border-[#3b3a39] p-2 rounded-[4px] text-[#242424] dark:text-[#f3f2f1] text-xs font-semibold text-center outline-none focus:border-[#0078D4] dark:focus:border-[#2899f5] font-mono"
                          />
                          <div className="flex items-center justify-center gap-1 pt-0.5">
                            {[15, 30, 60, 90].map(daysOption => (
                              <button
                                key={daysOption}
                                type="button"
                                onClick={() => handleMedChange(idx, 'daysSupply', daysOption)}
                                className={`px-1 py-0.5 rounded-[3px] text-[9px] font-mono font-semibold transition-all cursor-pointer ${
                                  Number(m.daysSupply) === daysOption
                                    ? 'bg-[#0078D4] text-white'
                                    : 'bg-[#FAF9F8] dark:bg-[#2d2c2c] text-[#605E5C] dark:text-[#a19f9d] border border-[#EDEBE9] dark:border-[#3b3a39] hover:bg-[#F3F2F1] dark:hover:bg-[#3b3a39]'
                                }`}
                                title={`${daysOption} ${lang === 'ar' ? 'يوم' : 'days'}`}
                              >
                                {daysOption}d
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Quick Dispense & Actions */}
                        <div className="sm:col-span-2 flex items-center justify-end gap-1.5 pt-4">
                          {m.name.trim() && (
                            <button
                              type="button"
                              onClick={() => handleFastRefillSingleMed(idx, Number(m.daysSupply) || 30)}
                              className="px-2.5 py-1.5 rounded-[4px] bg-[#0078D4] hover:bg-[#106EBE] active:bg-[#005A9E] text-white text-[11px] font-semibold transition-all cursor-pointer whitespace-nowrap border-0 shadow-none flex items-center gap-1"
                              title={lang === 'ar' ? 'صرف وتكرار هذا الدواء اليوم' : 'Dispense today'}
                            >
                              <Zap className="w-3.5 h-3.5 text-white" />
                              <span>{lang === 'ar' ? 'صرف اليوم' : 'Dispense'}</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleRemoveMedication(idx)}
                            className="p-1.5 rounded-[4px] text-[#605E5C] dark:text-[#a19f9d] hover:text-[#A80000] dark:hover:text-[#f87171] hover:bg-[#FDF3F3] dark:hover:bg-[#3a1d1d] transition-colors cursor-pointer"
                            title={lang === 'ar' ? 'حذف الدواء' : 'Delete Medication'}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Dosage Schedule Selectors (Timing & Meal Relation) */}
                      {m.name.trim() && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-2 bg-[#FAF9F8] dark:bg-[#2d2c2c] rounded-[4px] border border-[#EDEBE9] dark:border-[#3b3a39]">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] text-[#605E5C] dark:text-[#a19f9d] font-semibold shrink-0">
                              {lang === 'ar' ? 'التوقيت:' : 'Timing:'}
                            </span>
                            <select
                              value={m.timing || 'morning'}
                              onChange={e => handleMedChange(idx, 'timing', e.target.value)}
                              className="w-full bg-[#FFFFFF] dark:bg-[#201f1e] border border-[#EDEBE9] dark:border-[#3b3a39] p-1 rounded-[4px] text-[#242424] dark:text-[#f3f2f1] text-[11px] outline-none focus:border-[#0078D4] dark:focus:border-[#2899f5]"
                            >
                              <option value="morning">{lang === 'ar' ? 'صباحاً' : 'Morning'}</option>
                              <option value="afternoon">{lang === 'ar' ? 'ظهراً' : 'Afternoon'}</option>
                              <option value="evening">{lang === 'ar' ? 'مساءً' : 'Evening'}</option>
                              <option value="bedtime">{lang === 'ar' ? 'قبل النوم' : 'Bedtime'}</option>
                              <option value="twice_daily">{lang === 'ar' ? 'مرتان يومياً' : 'Twice daily'}</option>
                              <option value="thrice_daily">{lang === 'ar' ? '3 مرات يومياً' : 'Thrice daily'}</option>
                              <option value="as_needed">{lang === 'ar' ? 'عند الحاجة' : 'As needed'}</option>
                            </select>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] text-[#605E5C] dark:text-[#a19f9d] font-semibold shrink-0">
                              {lang === 'ar' ? 'الطعام:' : 'Meal:'}
                            </span>
                            <select
                              value={m.mealRelation || 'after_meal'}
                              onChange={e => handleMedChange(idx, 'mealRelation', e.target.value)}
                              className="w-full bg-[#FFFFFF] dark:bg-[#201f1e] border border-[#EDEBE9] dark:border-[#3b3a39] p-1 rounded-[4px] text-[#242424] dark:text-[#f3f2f1] text-[11px] outline-none focus:border-[#0078D4] dark:focus:border-[#2899f5]"
                            >
                              <option value="after_meal">{lang === 'ar' ? 'بعد الطعام' : 'After meal'}</option>
                              <option value="before_meal">{lang === 'ar' ? 'قبل الطعام' : 'Before meal'}</option>
                              <option value="with_meal">{lang === 'ar' ? 'مع الطعام' : 'With meal'}</option>
                              <option value="empty_stomach">{lang === 'ar' ? 'على معدة فارغة' : 'On empty stomach'}</option>
                            </select>
                          </div>
                        </div>
                      )}

                      {/* Visual Timeline of Previous Refill Dates */}
                      {m.name.trim() && (
                        <MedicationRefillTimeline
                          medication={m}
                          lang={lang}
                          defaultExpanded={expandAllTimelines}
                          onUpdateRefillHistory={newHistory => handleUpdateMedRefillHistory(idx, newHistory)}
                        />
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Clinical Cross-Selling Section */}
              {crossSellItems.length > 0 && (
                <div className="p-3.5 rounded-[4px] bg-[#FAF9F8] dark:bg-[#2d2c2c] border border-[#EDEBE9] dark:border-[#3b3a39] space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="font-semibold text-sm text-[#242424] dark:text-[#f3f2f1] flex items-center gap-2">
                      <ShoppingBag className="w-4 h-4 text-[#0078D4] dark:text-[#2899f5]" />
                      <span>{lang === 'ar' ? 'محرك البيع المتقاطع السريري للمكملات والمستلزمات' : 'Clinical Cross-Selling & Care Add-ons'}</span>
                    </div>
                    <span className="text-[10px] text-[#0078D4] dark:text-[#2899f5] font-semibold px-2 py-0.5 rounded-[4px] bg-[#EFF6FC] dark:bg-[#112338] border border-[#C7E0F4] dark:border-[#1e3a8a]">
                      {crossSellItems.length} {lang === 'ar' ? 'توصيات سريرية' : 'Recommendations'}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                    {crossSellItems.map(item => (
                      <div
                        key={item.id}
                        className="p-3 rounded-[4px] bg-white dark:bg-[#252423] border border-[#EDEBE9] dark:border-[#3b3a39] space-y-2 flex flex-col justify-between"
                      >
                        <div className="space-y-1">
                          <div className="flex items-start justify-between gap-1">
                            <span className="font-semibold text-xs text-[#242424] dark:text-[#f3f2f1]">{item.name}</span>
                            <span className="px-1.5 py-0.5 rounded-[4px] text-[9px] font-semibold bg-[#EFF6FC] dark:bg-[#112338] text-[#0078D4] dark:text-[#2899f5] border border-[#C7E0F4] dark:border-[#1e3a8a] shrink-0">
                              {item.estimatedMargin}
                            </span>
                          </div>
                          <p className="text-[11px] text-[#605E5C] dark:text-[#a19f9d] leading-snug">
                            {lang === 'ar' ? item.clinicalRationaleAr : item.clinicalRationaleEn}
                          </p>
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-[#EDEBE9] dark:border-[#3b3a39]">
                          <span className="text-[10px] text-[#605E5C] dark:text-[#a19f9d] font-medium">{item.suggestedAction}</span>
                          <button
                            type="button"
                            onClick={() => handleAddCrossSellToRegimen(item)}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-[4px] bg-[#0078D4] hover:bg-[#106EBE] text-white font-semibold text-[11px] transition-colors cursor-pointer border-0 shadow-none"
                          >
                            <Plus className="w-3 h-3 text-white" />
                            <span>{lang === 'ar' ? 'إضافة للخطة' : 'Add to Regimen'}</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: DEMOGRAPHICS & FAMILY */}
          {activeTab === 'demographics' && (
            <div className="space-y-4">
              {formData.familyTag && (
                <div className="bg-[#EFF6FC] dark:bg-[#112338] border border-[#C7E0F4] dark:border-[#1e3a8a] p-3 rounded-[4px] flex items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold text-sm text-[#0078D4] dark:text-[#2899f5] flex items-center gap-1.5">
                      <span>👨‍👩‍👧‍👦</span>
                      <span>{lang === 'ar' ? 'المريض مرتبط بعائلة:' : 'Linked Family:'} {formData.familyTag}</span>
                    </div>
                    <div className="text-[11px] text-[#605E5C] dark:text-[#a19f9d] mt-0.5">
                      {lang === 'ar'
                        ? 'يمكنك توحيد مواعيد صرف وصيدلية أفراد العائلة في رحلة واحدة وحساب الحبات الناقصة.'
                        : 'Coordinate refills for the entire family in one visit using bridge dose calculation.'}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenHouseholdModal(formData.familyTag!);
                    }}
                    className="px-3 py-1.5 rounded-[4px] bg-[#0078D4] hover:bg-[#106EBE] text-white font-semibold text-xs transition-colors whitespace-nowrap cursor-pointer border-0 shadow-none"
                  >
                    {lang === 'ar' ? 'توحيد صرف العائلة ⚡' : 'Household Sync ⚡'}
                  </button>
                </div>
              )}

              {/* Shared Phone Duplicate Warning Banner */}
              {matchingPhonePatients.length > 0 && (
                <div className="p-3 bg-[#FFF4CE] dark:bg-amber-950/60 border border-[#FDE047]/60 dark:border-amber-800 rounded-[4px] space-y-2 text-xs text-amber-900 dark:text-amber-200">
                  <div className="font-bold flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>{lang === 'ar' ? 'تنبيه: رقم الهاتف مسجل لمريض آخر بالمنظومة' : 'Warning: Phone number already registered to another patient!'}</span>
                  </div>
                  <div>
                    {lang === 'ar' ? 'المرضى المشاركون لهذا الرقم:' : 'Matching patients with this phone:'}{' '}
                    <strong>{matchingPhonePatients.map(p => `${p.name} (${p.id})`).join(', ')}</strong>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer font-semibold pt-1">
                    <input
                      type="checkbox"
                      checked={Boolean(formData.hasAcknowledgedSharedPhone)}
                      onChange={e => {
                        setFormData(prev => ({ ...prev, hasAcknowledgedSharedPhone: e.target.checked }));
                        setIsDirty(true);
                      }}
                      className="w-4 h-4 text-[#0078D4] rounded-[2px]"
                    />
                    <span>{lang === 'ar' ? 'أقر بأن هذا الرقم مشترك بين المريضين (مثلاً أفراد عائلة واحدة)' : 'I acknowledge that this phone number is shared'}</span>
                  </label>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="font-semibold text-[#242424] dark:text-[#f3f2f1]">
                    {lang === 'ar' ? 'الاسم الكامل للمريض *' : 'Full Name *'}
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={e => {
                      setFormData({ ...formData, name: e.target.value });
                      setIsDirty(true);
                    }}
                    placeholder={lang === 'ar' ? 'مثال: أحمد عبد الله الجبوري' : 'e.g. John Doe'}
                    className="w-full bg-white dark:bg-[#252423] border border-[#EDEBE9] dark:border-[#3b3a39] text-[#242424] dark:text-[#f3f2f1] rounded-[4px] p-2 text-[16px] sm:text-xs outline-none focus:border-[#0078D4] dark:focus:border-[#2899f5] font-semibold"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="font-semibold text-[#242424] dark:text-[#f3f2f1]">
                      {lang === 'ar' ? 'رقم الهاتف (WhatsApp / SMS)' : 'Phone (WhatsApp/SMS)'}
                    </label>
                    <label className="flex items-center gap-1.5 text-xs text-[#605E5C] dark:text-[#a19f9d] cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={Boolean(formData.phoneUnavailable)}
                        onChange={e => {
                          const checked = e.target.checked;
                          setFormData(prev => ({
                            ...prev,
                            phoneUnavailable: checked,
                            phone: checked ? '' : prev.phone,
                          }));
                          setIsDirty(true);
                        }}
                        className="w-3.5 h-3.5 accent-[#0078D4] cursor-pointer"
                      />
                      <span>{lang === 'ar' ? 'غير متوفر' : 'Unavailable'}</span>
                    </label>
                  </div>
                  <input
                    type="tel"
                    disabled={Boolean(formData.phoneUnavailable)}
                    value={formData.phone}
                    onChange={e => {
                      setFormData({ ...formData, phone: e.target.value, phoneUnavailable: false });
                      setIsDirty(true);
                    }}
                    placeholder={formData.phoneUnavailable ? (lang === 'ar' ? 'رقم الهاتف غير متوفر' : 'Phone unavailable') : '07700000000 / +964...'}
                    className="w-full bg-white dark:bg-[#252423] border border-[#EDEBE9] dark:border-[#3b3a39] text-[#242424] dark:text-[#f3f2f1] rounded-[4px] p-2 text-[16px] sm:text-xs outline-none focus:border-[#0078D4] dark:focus:border-[#2899f5] font-mono disabled:bg-[#FAF9F8] dark:disabled:bg-[#1a1918] disabled:text-[#8A8886]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-[#242424] dark:text-[#f3f2f1]">
                    {lang === 'ar' ? 'تاريخ الميلاد' : 'Date of Birth'}
                  </label>
                  <input
                    type="date"
                    value={formData.dob || ''}
                    onChange={e => {
                      handleDobChange(e);
                      setIsDirty(true);
                    }}
                    className="w-full bg-white dark:bg-[#252423] border border-[#EDEBE9] dark:border-[#3b3a39] text-[#242424] dark:text-[#f3f2f1] rounded-[4px] p-2 text-[16px] sm:text-xs outline-none focus:border-[#0078D4] dark:focus:border-[#2899f5] font-mono"
                  />
                  {formData.age ? (
                    <span className="text-[11px] text-[#605E5C] dark:text-[#a19f9d] font-semibold">
                      {lang === 'ar' ? `العمر المحسوب: ${formData.age} سنة` : `Age: ${formData.age} years`}
                    </span>
                  ) : null}
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-[#242424] dark:text-[#f3f2f1]">
                    {lang === 'ar' ? 'الجنس' : 'Gender'}
                  </label>
                  <select
                    value={formData.gender || 'M'}
                    onChange={e => {
                      setFormData({ ...formData, gender: e.target.value as any });
                      setIsDirty(true);
                    }}
                    className="w-full bg-white dark:bg-[#252423] border border-[#EDEBE9] dark:border-[#3b3a39] text-[#242424] dark:text-[#f3f2f1] rounded-[4px] p-2 text-[16px] sm:text-xs outline-none focus:border-[#0078D4] dark:focus:border-[#2899f5]"
                  >
                    <option value="M">{lang === 'ar' ? 'ذكر' : 'Male'}</option>
                    <option value="F">{lang === 'ar' ? 'أنثى' : 'Female'}</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-[#242424] dark:text-[#f3f2f1]">
                    {lang === 'ar' ? 'رمز العائلة (Family Tag)' : 'Family Tag'}
                  </label>
                  <input
                    type="text"
                    value={formData.familyTag || ''}
                    onChange={e => {
                      setFormData({ ...formData, familyTag: e.target.value });
                      setIsDirty(true);
                    }}
                    placeholder={lang === 'ar' ? 'مثال: عائلة_الجبوري' : 'e.g. Smith_Family'}
                    className="w-full bg-white dark:bg-[#252423] border border-[#EDEBE9] dark:border-[#3b3a39] text-[#242424] dark:text-[#f3f2f1] rounded-[4px] p-2 text-[16px] sm:text-xs outline-none focus:border-[#0078D4] dark:focus:border-[#2899f5]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-[#242424] dark:text-[#f3f2f1]">
                    {lang === 'ar' ? 'نقاط الولاء (Loyalty Points)' : 'Loyalty Points'}
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={formData.loyaltyPoints || 0}
                    onChange={e => {
                      setFormData({ ...formData, loyaltyPoints: parseInt(e.target.value, 10) || 0 });
                      setIsDirty(true);
                    }}
                    className="w-full bg-white dark:bg-[#252423] border border-[#EDEBE9] dark:border-[#3b3a39] text-[#242424] dark:text-[#f3f2f1] rounded-[4px] p-2 text-[16px] sm:text-xs outline-none focus:border-[#0078D4] dark:focus:border-[#2899f5] font-mono font-bold"
                  />
                </div>
              </div>

              {/* 3-Way Allergy Status Selector */}
              <div className="p-3 bg-[#FAF9F8] dark:bg-[#2d2c2c] border border-[#EDEBE9] dark:border-[#3b3a39] rounded-[4px] space-y-2">
                <label className="font-semibold text-[#242424] dark:text-[#f3f2f1] block">
                  {lang === 'ar' ? 'الحساسيات الدوائية (Allergies Status)' : 'Drug Allergies Status'}
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setFormData(prev => ({ ...prev, allergiesStatus: 'not_recorded' }));
                      setIsDirty(true);
                    }}
                    className={`min-h-[44px] px-3 py-2 text-xs font-semibold rounded-[4px] border transition-colors cursor-pointer ${
                      formData.allergiesStatus === 'not_recorded' || !formData.allergiesStatus
                        ? 'bg-[#0078D4] text-white border-[#0078D4]'
                        : 'bg-white dark:bg-[#201f1e] text-[#605E5C] dark:text-[#a19f9d] border-[#EDEBE9] dark:border-[#3b3a39]'
                    }`}
                  >
                    {lang === 'ar' ? 'الحساسية غير مسجلة' : 'Allergies not recorded'}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setFormData(prev => ({ ...prev, allergiesStatus: 'nkda', allergies: 'NKDA' }));
                      setIsDirty(true);
                    }}
                    className={`min-h-[44px] px-3 py-2 text-xs font-semibold rounded-[4px] border transition-colors cursor-pointer ${
                      formData.allergiesStatus === 'nkda'
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-white dark:bg-[#201f1e] text-[#605E5C] dark:text-[#a19f9d] border-[#EDEBE9] dark:border-[#3b3a39]'
                    }`}
                  >
                    {lang === 'ar' ? 'لا توجد حساسية معروفة (NKDA)' : 'No Known Drug Allergies (NKDA)'}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setFormData(prev => ({ ...prev, allergiesStatus: 'recorded' }));
                      setIsDirty(true);
                    }}
                    className={`min-h-[44px] px-3 py-2 text-xs font-semibold rounded-[4px] border transition-colors cursor-pointer ${
                      formData.allergiesStatus === 'recorded'
                        ? 'bg-[#A80000] text-white border-[#A80000]'
                        : 'bg-white dark:bg-[#201f1e] text-[#605E5C] dark:text-[#a19f9d] border-[#EDEBE9] dark:border-[#3b3a39]'
                    }`}
                  >
                    {lang === 'ar' ? 'توجد حساسية مسجلة' : 'Has Known Allergies'}
                  </button>
                </div>

                {formData.allergiesStatus === 'recorded' && (
                  <div className="pt-2">
                    <label className="block text-xs font-semibold text-[#A80000] dark:text-red-400 mb-1">
                      {lang === 'ar' ? 'المواد الدوائية المسببة للحساسية:' : 'Specific Allergy Trigger Drugs:'}
                    </label>
                    <input
                      type="text"
                      value={formData.allergies || ''}
                      onChange={e => {
                        setFormData({ ...formData, allergies: e.target.value });
                        setIsDirty(true);
                      }}
                      placeholder="Penicillin, Sulfa, Aspirin..."
                      className="w-full min-h-[44px] px-3 text-[16px] sm:text-xs bg-white dark:bg-[#252423] border border-red-300 dark:border-red-800 rounded-[4px] text-[#A80000] dark:text-red-300 outline-none"
                    />
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-[#242424] dark:text-[#f3f2f1]">
                  {lang === 'ar' ? 'التاريخ المرضي والملاحظات السريرية' : 'Clinical History & Medical Notes'}
                </label>
                <textarea
                  rows={3}
                  value={formData.notes || ''}
                  onChange={e => setFormData({ ...formData, notes: e.target.value })}
                  placeholder={lang === 'ar' ? 'تاريخ الإصابة، أمراض مصاحبة (ضغط، سكري، كلى)...' : 'Medical history, chronic conditions, special notes...'}
                  className="w-full bg-white dark:bg-[#252423] border border-[#EDEBE9] dark:border-[#3b3a39] text-[#242424] dark:text-[#f3f2f1] rounded-[4px] p-2 outline-none focus:border-[#0078D4] dark:focus:border-[#2899f5]"
                />
              </div>
            </div>
          )}

          {/* TAB 3: RECHARTS LONGITUDINAL ADHERENCE & VITALS VISUALIZATION */}
          {activeTab === 'analytics' && (
            <PatientAdherenceVitalsChart
              patient={formData}
              followUps={followUps}
              lang={lang}
              onOpenNewFollowUp={() => {
                onClose();
                if (onOpenNewFollowUp) onOpenNewFollowUp();
              }}
              onShowToast={onShowToast}
            />
          )}

          {/* TAB 4: VITALS & LABS RADAR */}
          {activeTab === 'vitals' && (
            <div className="space-y-4">
              <LabTrackerPanel
                patient={formData}
                pharmacyName={pharmacyName}
                lang={lang}
                onUpdatePatientLabResults={(newLabs) => {
                  setFormData(prev => ({
                    ...prev,
                    labResults: newLabs,
                  }));
                }}
                onShowToast={onShowToast}
              />

              {/* Point-of-care Clinical Vital Signs */}
              <div className="bg-[#FAF9F8] dark:bg-[#2d2c2c] p-3.5 rounded-[4px] border border-[#EDEBE9] dark:border-[#3b3a39] space-y-3">
                <div className="font-semibold text-sm text-[#242424] dark:text-[#f3f2f1] flex items-center gap-2">
                  <HeartPulse className="w-4 h-4 text-[#0078D4] dark:text-[#2899f5]" />
                  <span>{lang === 'ar' ? 'تسجيل قراءة ضغط وسكر حية بالصيدلية' : 'Record In-Pharmacy Vitals'}</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] text-[#605E5C] dark:text-[#a19f9d] font-semibold">{lang === 'ar' ? 'الانقباضي (Systolic)' : 'Systolic'}</label>
                    <input
                      type="number"
                      placeholder="120"
                      value={newSys}
                      onChange={e => setNewSys(e.target.value)}
                      className="w-full bg-white dark:bg-[#201f1e] border border-[#EDEBE9] dark:border-[#3b3a39] p-2 rounded-[4px] text-[#242424] dark:text-[#f3f2f1] text-xs text-center font-mono font-bold outline-none focus:border-[#0078D4] dark:focus:border-[#2899f5]"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] text-[#605E5C] dark:text-[#a19f9d] font-semibold">{lang === 'ar' ? 'الانبساطي (Diastolic)' : 'Diastolic'}</label>
                    <input
                      type="number"
                      placeholder="80"
                      value={newDia}
                      onChange={e => setNewDia(e.target.value)}
                      className="w-full bg-white dark:bg-[#201f1e] border border-[#EDEBE9] dark:border-[#3b3a39] p-2 rounded-[4px] text-[#242424] dark:text-[#f3f2f1] text-xs text-center font-mono font-bold outline-none focus:border-[#0078D4] dark:focus:border-[#2899f5]"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] text-[#605E5C] dark:text-[#a19f9d] font-semibold">{lang === 'ar' ? 'السكر (mg/dL)' : 'Glucose'}</label>
                    <input
                      type="number"
                      placeholder="110"
                      value={newSugar}
                      onChange={e => setNewSugar(e.target.value)}
                      className="w-full bg-white dark:bg-[#201f1e] border border-[#EDEBE9] dark:border-[#3b3a39] p-2 rounded-[4px] text-[#242424] dark:text-[#f3f2f1] text-xs text-center font-mono font-bold outline-none focus:border-[#0078D4] dark:focus:border-[#2899f5]"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] text-[#605E5C] dark:text-[#a19f9d] font-semibold">{lang === 'ar' ? 'HbA1c / نبض / وزن' : 'HbA1c / Pulse'}</label>
                    <input
                      type="text"
                      placeholder="HbA1c: 6.8% / 72 bpm"
                      value={newMisc}
                      onChange={e => setNewMisc(e.target.value)}
                      className="w-full bg-white dark:bg-[#201f1e] border border-[#EDEBE9] dark:border-[#3b3a39] p-2 rounded-[4px] text-[#242424] dark:text-[#f3f2f1] text-xs outline-none focus:border-[#0078D4] dark:focus:border-[#2899f5]"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleAddVitals}
                  className="px-3.5 py-1.5 rounded-[4px] bg-[#0078D4] hover:bg-[#106EBE] active:bg-[#005A9E] text-white font-semibold text-xs transition-colors cursor-pointer border-0 shadow-none"
                >
                  {lang === 'ar' ? '🩺 حفظ القراءة السريرية' : 'Log Clinical Entry'}
                </button>
              </div>

              {/* Vitals History Table */}
              <div className="border border-[#EDEBE9] dark:border-[#3b3a39] rounded-[4px] overflow-hidden">
                <table className="w-full text-right dir-rtl text-xs">
                  <thead className="bg-[#FAF9F8] dark:bg-[#2d2c2c] text-[#242424] dark:text-[#f3f2f1] font-semibold border-b border-[#EDEBE9] dark:border-[#3b3a39]">
                    <tr>
                      <th className="py-2.5 px-3 text-[11px] uppercase tracking-wider">{lang === 'ar' ? 'التاريخ' : 'Date'}</th>
                      <th className="py-2.5 px-3 text-[11px] uppercase tracking-wider">{lang === 'ar' ? 'ضغط الدم (BP)' : 'BP'}</th>
                      <th className="py-2.5 px-3 text-[11px] uppercase tracking-wider">{lang === 'ar' ? 'السكر (mg/dL)' : 'Sugar'}</th>
                      <th className="py-2.5 px-3 text-[11px] uppercase tracking-wider">{lang === 'ar' ? 'مؤشرات إضافية' : 'Misc'}</th>
                      <th className="py-2.5 px-3 text-[11px] uppercase tracking-wider">{lang === 'ar' ? 'التقييم' : 'Assessment'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EDEBE9] dark:divide-[#3b3a39] text-[#242424] dark:text-[#f3f2f1]">
                    {(formData.vitals || []).length === 0 ? (
                      <tr>
                        <td colSpan={5} className="text-center py-8 text-[#605E5C] dark:text-[#a19f9d]">
                          {lang === 'ar' ? 'لا توجد قراءات سابقة مسجلة.' : 'No recorded vitals yet.'}
                        </td>
                      </tr>
                    ) : (
                      formData.vitals!.map((v, i) => (
                        <tr key={i} className="hover:bg-[#F3F2F1] dark:hover:bg-[#252423]">
                          <td className="py-2.5 px-3 font-mono text-[#605E5C] dark:text-[#a19f9d]">{v.date}</td>
                          <td className="py-2.5 px-3 font-semibold font-mono text-[#242424] dark:text-[#f3f2f1]">{v.bp}</td>
                          <td className="py-2.5 px-3 font-mono font-semibold text-[#242424] dark:text-[#f3f2f1]">{v.sugar}</td>
                          <td className="py-2.5 px-3 text-[#242424] dark:text-[#f3f2f1]">{v.misc}</td>
                          <td className="py-2.5 px-3">
                            <span className="text-[11px] font-semibold text-[#0078D4] dark:text-[#2899f5] bg-[#EFF6FC] dark:bg-[#112338] px-2 py-0.5 rounded-[4px] border border-[#C7E0F4] dark:border-[#1e3a8a]">
                              {v.assessment || 'مستقر'}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 5: SCANS */}
          {activeTab === 'scans' && (
            <div className="space-y-4">
              <div className="bg-[#FAF9F8] dark:bg-[#2d2c2c] p-3.5 rounded-[4px] border border-[#EDEBE9] dark:border-[#3b3a39] space-y-3">
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-sm text-[#242424] dark:text-[#f3f2f1] flex items-center gap-2">
                    <ImageIcon className="w-4 h-4 text-[#0078D4] dark:text-[#2899f5]" />
                    <span>
                      {lang === 'ar'
                        ? 'إرفاق وحفظ صورة الروشتة أو التحليل بدقة كاملة'
                        : 'Attach & Save Prescription or Lab Scan'}
                    </span>
                  </div>
                  {isUploadingScan && (
                    <span className="text-xs text-[#0078D4] dark:text-[#2899f5] font-semibold flex items-center gap-1.5">
                      <UploadCloud className="w-3.5 h-3.5 animate-spin" />
                      <span>{lang === 'ar' ? 'جارِ معالجة ورفع الصورة...' : 'Uploading full-res scan...'}</span>
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleScanUpload}
                    className="block w-full text-xs text-[#605E5C] dark:text-[#a19f9d] file:mr-4 file:py-2 file:px-3 file:rounded-[4px] file:border-0 file:text-xs file:font-semibold file:bg-[#0078D4] file:text-white hover:file:bg-[#106EBE] cursor-pointer"
                  />
                </div>
                <div className="flex items-center justify-between text-[11px] text-[#605E5C] dark:text-[#a19f9d] flex-wrap gap-2">
                  <span>
                    {lang === 'ar'
                      ? 'يتم تخزين الصورة بنقائها وجودتها الكاملة مع حفظ رابطها المباشر في Google Sheet و Google Drive.'
                      : 'Stored with direct URLs saved in Google Sheet & Google Drive.'}
                  </span>
                  {gasUrl ? (
                    <span className="text-[#0078D4] dark:text-[#2899f5] flex items-center gap-1 font-semibold">
                      <CheckCircle2 className="w-3 h-3 text-[#0078D4] dark:text-[#2899f5]" />
                      <span>{lang === 'ar' ? 'المزامنة مع Google Drive والشيت مفعلة ☁️' : 'Drive & Sheet Sync Active'}</span>
                    </span>
                  ) : (
                    <span className="text-[#605E5C] dark:text-[#a19f9d] flex items-center gap-1">
                      <HardDrive className="w-3 h-3 text-[#605E5C] dark:text-[#a19f9d]" />
                      <span>{lang === 'ar' ? 'حفظ محلي بدقة كاملة' : 'Local storage'}</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Gallery Grid */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold text-[#242424] dark:text-[#f3f2f1]">
                  <span>{lang === 'ar' ? 'معرض الوصفات والتحاليل المخزنة:' : 'Stored Prescriptions & Lab Scans:'}</span>
                  <span className="text-[#605E5C] dark:text-[#a19f9d] font-normal">
                    {(formData.scans || []).length} {lang === 'ar' ? 'صورة' : 'images'}
                  </span>
                </div>

                {(formData.scans || []).length === 0 ? (
                  <div className="border border-dashed border-[#EDEBE9] dark:border-[#3b3a39] rounded-[4px] p-8 text-center text-[#605E5C] dark:text-[#a19f9d] space-y-2 bg-[#FAF9F8] dark:bg-[#2d2c2c]">
                    <ImageIcon className="w-8 h-8 mx-auto text-[#605E5C] dark:text-[#a19f9d]" />
                    <p className="text-xs">
                      {lang === 'ar'
                        ? 'لا توجد صور روشتات أو تحاليل مرفقة لهذا المريض بعد.'
                        : 'No prescription or lab scans attached yet.'}
                    </p>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="text-xs text-[#0078D4] dark:text-[#2899f5] font-semibold hover:underline inline-block cursor-pointer"
                    >
                      {lang === 'ar' ? '+ اضغط هنا لاختيار صورة' : '+ Click to choose an image'}
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {(formData.scans || []).map((s, i) => (
                      <ScanCard
                        key={s.id || i}
                        scan={s}
                        lang={lang}
                        onPreview={setPreviewingScan}
                        onDelete={handleDeleteScan}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 6: PILL SCHEDULE ORGANIZER */}
          {activeTab === 'schedule' && (
            <div className="space-y-4">
              <div className="bg-[#FAF9F8] dark:bg-[#2d2c2c] p-3.5 rounded-[4px] border border-[#EDEBE9] dark:border-[#3b3a39]">
                <div className="font-semibold text-sm text-[#242424] dark:text-[#f3f2f1] flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-[#0078D4] dark:text-[#2899f5]" />
                  <span>{lang === 'ar' ? 'جدول المواعيد وعلاقة الدواء بوجبات الطعام' : 'Daily Medication Schedule'}</span>
                </div>
                <p className="text-xs text-[#605E5C] dark:text-[#a19f9d] mt-0.5">
                  {lang === 'ar'
                    ? 'تنظيم أوقات تناول الأدوية وتفادي تعارض امتصاصها مع الطعام.'
                    : 'Synchronized daily dosing instructions.'}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {/* Morning */}
                <div className="bg-white dark:bg-[#252423] p-3 rounded-[4px] border border-[#EDEBE9] dark:border-[#3b3a39] space-y-2">
                  <div className="font-semibold text-[#242424] dark:text-[#f3f2f1] flex items-center gap-1.5 text-xs">
                    <span>☀️</span>
                    <span>{lang === 'ar' ? 'الصباح / الإفطار' : 'Morning / Breakfast'}</span>
                  </div>
                  <div className="space-y-1 text-xs">
                    {formData.medications
                      .filter(m => m.timing === 'morning' || m.timing === 'bid' || !m.timing)
                      .map((m, i) => (
                        <div key={i} className="p-2 rounded-[4px] bg-[#FAF9F8] dark:bg-[#2d2c2c] border border-[#EDEBE9] dark:border-[#3b3a39]">
                          <strong className="text-[#242424] dark:text-[#f3f2f1] block">{m.name}</strong>
                          <span className="text-[10px] text-[#605E5C] dark:text-[#a19f9d]">
                            {m.mealRelation === 'before_meal' ? (lang === 'ar' ? 'قبل الإفطار بـ 30 دقيقة' : '30 min before breakfast') : (lang === 'ar' ? 'مع أو بعد الإفطار' : 'With or after breakfast')}
                          </span>
                        </div>
                      ))}
                  </div>
                </div>

                {/* Noon */}
                <div className="bg-white dark:bg-[#252423] p-3 rounded-[4px] border border-[#EDEBE9] dark:border-[#3b3a39] space-y-2">
                  <div className="font-semibold text-[#242424] dark:text-[#f3f2f1] flex items-center gap-1.5 text-xs">
                    <span>🌤️</span>
                    <span>{lang === 'ar' ? 'الظهيرة / الغداء' : 'Noon / Lunch'}</span>
                  </div>
                  <div className="space-y-1 text-xs">
                    {formData.medications
                      .filter(m => m.timing === 'noon')
                      .map((m, i) => (
                        <div key={i} className="p-2 rounded-[4px] bg-[#FAF9F8] dark:bg-[#2d2c2c] border border-[#EDEBE9] dark:border-[#3b3a39]">
                          <strong className="text-[#242424] dark:text-[#f3f2f1] block">{m.name}</strong>
                          <span className="text-[10px] text-[#605E5C] dark:text-[#a19f9d]">{lang === 'ar' ? 'بعد الغداء' : 'After lunch'}</span>
                        </div>
                      ))}
                    {formData.medications.filter(m => m.timing === 'noon').length === 0 && (
                      <span className="text-[#605E5C] dark:text-[#a19f9d] text-[11px]">{lang === 'ar' ? 'لا توجد جرعات ظهيرة' : 'No noon doses'}</span>
                    )}
                  </div>
                </div>

                {/* Evening */}
                <div className="bg-white dark:bg-[#252423] p-3 rounded-[4px] border border-[#EDEBE9] dark:border-[#3b3a39] space-y-2">
                  <div className="font-semibold text-[#242424] dark:text-[#f3f2f1] flex items-center gap-1.5 text-xs">
                    <span>🌅</span>
                    <span>{lang === 'ar' ? 'المساء / العشاء' : 'Evening / Dinner'}</span>
                  </div>
                  <div className="space-y-1 text-xs">
                    {formData.medications
                      .filter(m => m.timing === 'bid' || m.timing === 'evening')
                      .map((m, i) => (
                        <div key={i} className="p-2 rounded-[4px] bg-[#FAF9F8] dark:bg-[#2d2c2c] border border-[#EDEBE9] dark:border-[#3b3a39]">
                          <strong className="text-[#242424] dark:text-[#f3f2f1] block">{m.name}</strong>
                          <span className="text-[10px] text-[#605E5C] dark:text-[#a19f9d]">{lang === 'ar' ? 'مع العشاء' : 'With dinner'}</span>
                        </div>
                      ))}
                  </div>
                </div>

                {/* Bedtime */}
                <div className="bg-white dark:bg-[#252423] p-3 rounded-[4px] border border-[#EDEBE9] dark:border-[#3b3a39] space-y-2">
                  <div className="font-semibold text-[#242424] dark:text-[#f3f2f1] flex items-center gap-1.5 text-xs">
                    <span>🌙</span>
                    <span>{lang === 'ar' ? 'قبل النوم' : 'Bedtime'}</span>
                  </div>
                  <div className="space-y-1 text-xs">
                    {formData.medications
                      .filter(m => m.timing === 'bedtime')
                      .map((m, i) => (
                        <div key={i} className="p-2 rounded-[4px] bg-[#FAF9F8] dark:bg-[#2d2c2c] border border-[#EDEBE9] dark:border-[#3b3a39]">
                          <strong className="text-[#242424] dark:text-[#f3f2f1] block">{m.name}</strong>
                          <span className="text-[10px] text-[#605E5C] dark:text-[#a19f9d]">{lang === 'ar' ? 'قبل النوم مباشرة' : 'At bedtime'}</span>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 7: POCKET THERMAL SLIP */}
          {activeTab === 'thermal' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="font-semibold text-sm text-[#242424] dark:text-[#f3f2f1]">
                  {lang === 'ar' ? 'البطاقة الطبية الفورية (Pocket Thermal Slip & QR)' : 'Pocket Thermal Slip & QR'}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(thermalSlipText);
                      onShowToast(lang === 'ar' ? 'تم نسخ نص البطاقة الطبية' : 'Copied slip', 'success');
                    }}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-[4px] bg-white dark:bg-[#252423] text-[#242424] dark:text-[#f3f2f1] border border-[#EDEBE9] dark:border-[#3b3a39] text-xs font-semibold hover:bg-[#F3F2F1] dark:hover:bg-[#3b3a39] cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5 text-[#605E5C] dark:text-[#a19f9d]" />
                    <span>{lang === 'ar' ? 'نسخ النص' : 'Copy'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const clean = formatPhoneForWhatsApp(formData.phone);
                      window.open(`https://wa.me/${clean}?text=${encodeURIComponent(thermalSlipText)}`, '_blank');
                    }}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-[4px] bg-[#FFFFFF] dark:bg-[#252423] text-[#0078D4] dark:text-[#2899f5] border border-[#C7E0F4] dark:border-[#1e3a8a] text-xs font-semibold hover:bg-[#DEECF9] dark:hover:bg-[#1a365d] cursor-pointer"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>WhatsApp</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-[4px] bg-[#0078D4] hover:bg-[#106EBE] active:bg-[#005A9E] text-white text-xs font-semibold cursor-pointer border-0 shadow-none"
                  >
                    <Printer className="w-3.5 h-3.5 text-white" />
                    <span>{lang === 'ar' ? 'طباعة إيصال' : 'Print Slip'}</span>
                  </button>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-4 items-start">
                <pre
                  id="thermal-slip-print"
                  className="flex-1 bg-[#FAF9F8] dark:bg-[#11100f] text-[#242424] dark:text-[#f3f2f1] p-4 font-mono text-xs rounded-[4px] border border-[#EDEBE9] dark:border-[#3b3a39] overflow-x-auto whitespace-pre-wrap leading-relaxed max-h-[380px]"
                >
                  {thermalSlipText}
                </pre>

                {qrDataUrl && (
                  <div className="bg-white dark:bg-[#252423] p-3 rounded-[4px] border border-[#EDEBE9] dark:border-[#3b3a39] flex flex-col items-center gap-2 shrink-0">
                    <img src={qrDataUrl} alt="Patient QR Code" className="w-28 h-28 bg-white p-1 rounded-[2px]" />
                    <span className="text-[10px] text-[#242424] dark:text-[#f3f2f1] font-mono font-semibold">
                      {formData.name.split(' ')[0]} - QR
                    </span>
                  </div>
                )}
              </div>

              {/* Danger Zone: Permanent Patient Deletion */}
              {patient?.id && (
                <div className="p-3.5 rounded-[4px] bg-[#FDF3F3] dark:bg-[#3a1d1d] border border-[#E0A8A8] dark:border-[#7f1d1d] space-y-2 mt-4">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2 text-[#A80000] dark:text-[#f87171] font-semibold text-xs">
                      <ShieldAlert className="w-4 h-4 text-[#A80000] dark:text-[#f87171]" />
                      <span>{lang === 'ar' ? 'منطقة العمليات الحساسة (Danger Zone)' : 'Danger Zone'}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowDeleteConfirm(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-[4px] bg-[#A80000] hover:bg-[#8B0000] text-white font-semibold text-xs transition-colors cursor-pointer border-0 shadow-none"
                    >
                      <Trash2 className="w-4 h-4 text-white" />
                      <span>{lang === 'ar' ? 'حذف ملف المريض نهائياً' : 'Delete Patient Permanently'}</span>
                    </button>
                  </div>
                  <p className="text-[11px] text-[#605E5C] dark:text-[#a19f9d] leading-relaxed">
                    {lang === 'ar'
                      ? 'سيؤدي حذف هذا الملف إلى إزالة كافة بيانات المريض وقائمة أدويته وسجلات الضغط والسكر والمتابعات السريرية المرتبطة به نهائياً.'
                      : 'Deleting this patient will permanently remove their records, active regimens, vitals logs, and linked clinical follow-ups.'}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Bottom Footer */}
        <div className="p-3 bg-[#FAF9F8] dark:bg-[#2d2c2c] border-t border-[#EDEBE9] dark:border-[#3b3a39] flex items-center justify-between gap-3">
          {patient?.id && activeTab === 'thermal' ? (
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-[4px] bg-white dark:bg-[#252423] text-[#A80000] dark:text-[#f87171] border border-[#E0A8A8] dark:border-[#7f1d1d] text-xs font-semibold hover:bg-[#FDF3F3] dark:hover:bg-[#3a1d1d] transition-colors cursor-pointer"
            >
              <Trash2 className="w-4 h-4 text-[#A80000] dark:text-[#f87171]" />
              <span>{lang === 'ar' ? 'حذف المريض' : 'Delete Patient'}</span>
            </button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSafeClose}
              className="min-h-[44px] px-4 py-2 rounded-[4px] bg-white dark:bg-[#252423] border border-[#EDEBE9] dark:border-[#3b3a39] hover:bg-[#F3F2F1] dark:hover:bg-[#3b3a39] text-[#242424] dark:text-[#f3f2f1] text-xs font-semibold transition-colors cursor-pointer"
            >
              {lang === 'ar' ? 'إلغاء' : 'Cancel'}
            </button>
            <button
              type="button"
              disabled={isSaving}
              onClick={handleSave}
              className="min-h-[44px] px-5 py-2 rounded-[4px] bg-[#0078D4] hover:bg-[#106EBE] active:bg-[#005A9E] text-white text-xs font-semibold transition-all cursor-pointer border-0 shadow-none flex items-center justify-center gap-1.5 disabled:opacity-60"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>{lang === 'ar' ? 'جارِ الحفظ...' : 'Saving...'}</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 text-white" />
                  <span>{lang === 'ar' ? 'حفظ الملف السريري' : 'Save Dossier'}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Permanent Delete Confirmation Dialog */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#201f1e] border border-[#E0A8A8] dark:border-[#7f1d1d] rounded-[4px] max-w-md w-full p-4 space-y-3 shadow-lg text-[#242424] dark:text-[#f3f2f1]">
            <div className="flex items-center gap-2.5 text-[#A80000] dark:text-[#f87171]">
              <div className="p-2 rounded-[4px] bg-[#FDF3F3] dark:bg-[#3a1d1d] border border-[#E0A8A8] dark:border-[#7f1d1d]">
                <ShieldAlert className="w-5 h-5 text-[#A80000] dark:text-[#f87171]" />
              </div>
              <div>
                <h3 className="font-semibold text-sm text-[#242424] dark:text-[#f3f2f1]">
                  {lang === 'ar' ? 'تأكيد حذف ملف المريض نهائياً' : 'Confirm Permanent Deletion'}
                </h3>
                <span className="text-[11px] text-[#605E5C] dark:text-[#a19f9d]">
                  {formData.name} ({formData.phone})
                </span>
              </div>
            </div>

            <p className="text-xs text-[#605E5C] dark:text-[#a19f9d] leading-relaxed bg-[#FAF9F8] dark:bg-[#252423] p-3 rounded-[4px] border border-[#EDEBE9] dark:border-[#3b3a39]">
              {lang === 'ar'
                ? 'هل أنت متأكد من رغبتك في حذف هذا الملف بشكل نهائي؟ سيتم حذف جميع بيانات المريض، والأدوية المزمنة، وسجلات الضغط والسكر، والمتابعات السريرية المرتبطة به ولا يمكن استرجاعها.'
                : 'Are you sure you want to permanently delete this patient dossier? All personal data, chronic medications, vitals history, and clinical follow-ups will be permanently deleted.'}
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="px-3.5 py-1.5 rounded-[4px] bg-white dark:bg-[#252423] border border-[#EDEBE9] dark:border-[#3b3a39] hover:bg-[#F3F2F1] dark:hover:bg-[#3b3a39] text-[#242424] dark:text-[#f3f2f1] text-xs font-semibold transition-colors cursor-pointer"
              >
                {lang === 'ar' ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowDeleteConfirm(false);
                  if (onDeletePatient && patient?.id) {
                    onDeletePatient(patient.id);
                  }
                  onClose();
                }}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-[4px] bg-[#A80000] hover:bg-[#8B0000] text-white text-xs font-semibold transition-colors cursor-pointer border-0 shadow-none"
              >
                <Trash2 className="w-4 h-4 text-white" />
                <span>{lang === 'ar' ? 'نعم، حذف نهائي' : 'Yes, Delete Permanently'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Unsaved Changes Protection Modal */}
      {showUnsavedConfirm && (
        <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#201f1e] border border-[#EDEBE9] dark:border-[#3b3a39] rounded-[4px] max-w-md w-full p-4 space-y-3 shadow-lg text-[#242424] dark:text-[#f3f2f1]">
            <div className="flex items-center gap-2.5 text-[#0078D4]">
              <div className="p-2 rounded-[4px] bg-[#EFF6FC] dark:bg-[#112338] border border-[#C7E0F4] dark:border-[#1e3a8a]">
                <AlertTriangle className="w-5 h-5 text-[#0078D4]" />
              </div>
              <div>
                <h3 className="font-semibold text-sm text-[#242424] dark:text-[#f3f2f1]">
                  {lang === 'ar' ? 'تغييرات غير محفوظة' : 'Unsaved Changes'}
                </h3>
                <span className="text-[11px] text-[#605E5C] dark:text-[#a19f9d]">
                  {lang === 'ar' ? 'تنبيه حماية بيانات المريض' : 'Patient data protection'}
                </span>
              </div>
            </div>

            <p className="text-xs text-[#605E5C] dark:text-[#a19f9d] leading-relaxed bg-[#FAF9F8] dark:bg-[#252423] p-3 rounded-[4px] border border-[#EDEBE9] dark:border-[#3b3a39]">
              {lang === 'ar'
                ? 'توجد تعديلات غير محفوظة في ملف المريض. هل أنت متأكد من إلغاء الخروج أم ترغب في تجاهل التغييرات؟'
                : 'You have unsaved changes in this patient dossier. Do you want to discard them or continue editing?'}
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowUnsavedConfirm(false)}
                className="px-3.5 py-2 rounded-[4px] bg-[#0078D4] hover:bg-[#106EBE] text-white text-xs font-semibold cursor-pointer"
              >
                {lang === 'ar' ? 'متابعة التعديل' : 'Continue Editing'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowUnsavedConfirm(false);
                  setIsDirty(false);
                  onClose();
                }}
                className="px-3.5 py-2 rounded-[4px] bg-white dark:bg-[#252423] border border-[#A80000] text-[#A80000] dark:text-red-400 text-xs font-semibold hover:bg-red-50 dark:hover:bg-red-950/40 cursor-pointer"
              >
                {lang === 'ar' ? 'إلغاء التغييرات والخروج' : 'Discard & Close'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* In-App Full-Resolution Image Lightbox / Preview Modal */}
      {previewingScan && (
        <ImagePreviewModal
          scan={previewingScan}
          patientName={formData.name}
          patientId={formData.id}
          gasUrl={gasUrl}
          lang={lang}
          onClose={() => setPreviewingScan(null)}
          onDelete={handleDeleteScan}
          onUpdateScan={(updatedScan) => {
            setFormData(prev => ({
              ...prev,
              scans: (prev.scans || []).map(s => s.id === updatedScan.id ? updatedScan : s),
            }));
            setPreviewingScan(updatedScan);
          }}
        />
      )}

      {/* AI Rx Extraction Modal */}
      <AiRxExtractionModal
        isOpen={isAiModalOpen}
        onClose={() => setIsAiModalOpen(false)}
        lang={lang}
        pharmacyName={pharmacyName}
        onApplyToPatient={handleApplyAiRx}
        onShowToast={onShowToast}
      />
    </div>
  );
};
