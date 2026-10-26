import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Header } from './components/Header';
import { Navigation, ViewType } from './components/Navigation';
import { DashboardView } from './components/views/DashboardView';
import { PatientsView } from './components/views/PatientsView';
import { FollowUpView } from './components/views/FollowUpView';
import { TimelineView } from './components/views/TimelineView';
import { InventoryForecastView } from './components/views/InventoryForecastView';
import { ReportsView } from './components/views/ReportsView';
import { ArchiveView } from './components/views/ArchiveView';
import { SettingsView } from './components/views/SettingsView';
import { MobileBottomNav } from './components/MobileBottomNav';

import { PatientDossierModal } from './components/modals/PatientDossierModal';
import { RefillModal } from './components/modals/RefillModal';
import { HouseholdSyncModal } from './components/modals/HouseholdSyncModal';
import { FollowUpModal } from './components/modals/FollowUpModal';
import { ResetDatabaseModal } from './components/modals/ResetDatabaseModal';
import { AiRxExtractionModal } from './components/modals/AiRxExtractionModal';
import { QuickPatientRegistrationModal } from './components/modals/QuickPatientRegistrationModal';
import { BulkPatientImportModal } from './components/modals/BulkPatientImportModal';
import { DeliveryManifestModal } from './components/modals/DeliveryManifestModal';
import * as XLSX from 'xlsx';

import {
  Patient,
  Medication,
  FollowUpEntry,
  Settings,
  HouseholdMemberAlignment,
  RefillRecord,
  LabScan,
} from './types/pharmacy';
import { INITIAL_PATIENTS, INITIAL_FOLLOW_UPS } from './data/mockPatients';
import { calculateDaysRemaining, formatYMD, filterPatientsByQuery, calculatePDC } from './utils/pharmacyCalculations';
import { useDebounce } from './utils/useDebounce';
import {
  syncPushToGoogleSheet,
  fetchFromGoogleSheet,
  testSheetConnectionDetailed,
  deletePatientFromGoogleSheet,
  savePatientToGoogleSheet,
  saveFollowUpToGoogleSheet,
  clearGoogleSheetDatabase,
  requestPersistentStorage,
  uploadScanImageToDrive,
} from './services/apiService';
import { enrichPatientScans, saveScanImage } from './utils/scanStorage';

const DEFAULT_SETTINGS: Settings = {
  pharmacyName: 'صيدلية النبض السريرية',
  gasUrl: '',
  waTemplate:
    'مرحباً {name}، تحيات {pharmacy}. نود تذكيرك بأن موعد تكرار علاجك ({drug}) مستحق بتاريخ {date}. يرجى مراجعتنا لاستلام أدويتك لضمان استقرار حالتك الصحية.',
  waAbxTemplate:
    'مرحباً {name}، معك دكتور الصيدلة من {pharmacy}. نود الاطمئنان على تحسن أعراضك مع مضاد ({drug}). نؤكد على ضرورة إكمال كامل كورس العلاج حتى لو شعرت بالتحسن لمنع عودة العدوى أو تطور بكتيريا مقاومة.',
  waChronicFollowTemplate:
    'مرحباً {name}، معك دكتور الصيدلة السريرية من {pharmacy}. نود الاطمئنان عليك ومتابعة استجابتك لعلاج ({drug}). هل واجهت أي أعراض كالسعال الجاف أو الدوخة أو ألم في العضلات؟',
  smsTemplate:
    '{pharmacy}: نذكركم بأن موعد تكرار علاجكم ({drug}) مستحق بتاريخ {date}. صحتكم أولويتنا.',
  waDropoutTemplate:
    'أهلاً بك {name}، معك دكتور الصيدلة السريرية من {pharmacy}. لاحظنا انقطاعك عن علاجك المزمن لأكثر من أسبوعين. نود الاطمئنان عليك والمساعدة في ضبط جرعاتك.',
};

export default function App() {
  const [activeView, setActiveView] = useState<ViewType>('dashboard');
  const [lang, setLang] = useState<'ar' | 'en'>('ar');
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    try {
      const saved = localStorage.getItem('crm_theme');
      if (saved === 'light' || saved === 'dark') return saved;
    } catch (e) {}
    return 'light';
  });

  // Core state (Default empty, demo examples removed)
  const [patients, setPatients] = useState<Patient[]>(() => {
    try {
      const saved = localStorage.getItem('crm_cache_data');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          // Cleanse any legacy demo/example patients
          const realPatients = parsed.filter(p => !p.id?.startsWith('PT-1048') && !p.id?.startsWith('PT-1065'));
          return realPatients;
        }
      }
    } catch (e) {
      console.warn('Failed to load cached patients:', e);
    }
    return INITIAL_PATIENTS;
  });

  const [followUps, setFollowUps] = useState<FollowUpEntry[]>(() => {
    try {
      const saved = localStorage.getItem('crm_follow_ups');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          // Cleanse any legacy demo/example follow-ups
          const realFollowUps = parsed.filter(f => !f.id?.startsWith('FU-10') && !f.id?.startsWith('FU-20'));
          return realFollowUps;
        }
      }
    } catch (e) {
      console.warn('Failed to load cached follow-ups:', e);
    }
    return INITIAL_FOLLOW_UPS;
  });

  const [settings, setSettings] = useState<Settings>(() => {
    try {
      const saved = localStorage.getItem('crm_settings');
      if (saved) {
        return Object.assign({}, DEFAULT_SETTINGS, JSON.parse(saved));
      }
    } catch (e) {}
    return DEFAULT_SETTINGS;
  });

  // State refs for stable callback access
  const patientsRef = useRef(patients);
  patientsRef.current = patients;

  const followUpsRef = useRef(followUps);
  followUpsRef.current = followUps;

  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  // Cloud Sync state
  const [syncStatus, setSyncStatus] = useState<'synced' | 'syncing' | 'error' | 'idle'>('synced');
  const [syncMessage, setSyncMessage] = useState<string>('جاهز ومتصل');

  // Modals state
  const [isDossierOpen, setIsDossierOpen] = useState(false);
  const [selectedPatientForDossier, setSelectedPatientForDossier] = useState<Patient | null>(null);
  const [dossierInitialTab, setDossierInitialTab] = useState<string>('regimen');

  const [isRefillModalOpen, setIsRefillModalOpen] = useState(false);
  const [refillPatient, setRefillPatient] = useState<Patient | null>(null);
  const [refillInitialMedIndex, setRefillInitialMedIndex] = useState<number | undefined>(undefined);

  const [isHouseholdModalOpen, setIsHouseholdModalOpen] = useState(false);
  const [selectedFamilyTag, setSelectedFamilyTag] = useState<string>('');

  const [isQuickRegistrationOpen, setIsQuickRegistrationOpen] = useState(false);
  const [isFollowUpModalOpen, setIsFollowUpModalOpen] = useState(false);
  const [isAiRxModalOpen, setIsAiRxModalOpen] = useState(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);
  const [isDeliveryManifestOpen, setIsDeliveryManifestOpen] = useState(false);

  const handleApplyAiRxToNewPatient = async (data: {
    name: string;
    phone: string;
    age?: number;
    medications: Medication[];
    rxImageBase64?: string;
  }) => {
    let dob = '';
    if (data.age) {
      dob = `${new Date().getFullYear() - data.age}-01-01`;
    }

    const patientId = `PT-${Math.floor(1000 + Math.random() * 9000)}`;
    const scans: LabScan[] = [];

    if (data.rxImageBase64) {
      const scanId = 'scan-' + Date.now();
      await saveScanImage(scanId, data.rxImageBase64, {
        title: 'Prescription_AI_Scan.jpg',
        patientId,
      });

      scans.push({
        id: scanId,
        date: new Date().toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US'),
        title: lang === 'ar' ? 'صورة الروشتة (AI Scan)' : 'Prescription (AI Scan)',
        dataUrl: data.rxImageBase64,
        uploadStatus: settings.gasUrl ? 'uploading' : 'local_only',
      });
    }

    const newPatient: Patient = {
      id: patientId,
      name: data.name && data.name !== 'مريض غير مسجل' ? data.name : '',
      phone: data.phone || '',
      dob,
      age: data.age || 0,
      gender: 'M',
      familyTag: '',
      loyaltyPoints: 0,
      allergies: '',
      notes: 'تم استخراج البيانات عبر المساعد الذكي للروشتات (AI Rx Extraction)',
      medications: data.medications || [],
      vitals: [],
      scans,
      createdAt: new Date().toISOString(),
      isArchived: false,
    };

    setSelectedPatientForDossier(newPatient);
    setDossierInitialTab('regimen');
    setIsDossierOpen(true);
    setIsAiRxModalOpen(false);
    showToast(lang === 'ar' ? 'تم تجهيز ملف المريض وحفظ صورة الروشتة بنجاح' : 'Prescription dossier & scan prepared', 'success');

    // If Google Apps Script is connected, upload scan image to Google Drive immediately in background
    if (settings.gasUrl && data.rxImageBase64 && scans.length > 0) {
      const targetScanId = scans[0].id!;
      uploadScanImageToDrive(
        settings.gasUrl,
        newPatient.id || 'Patient',
        'Prescription_AI_Scan.jpg',
        data.rxImageBase64
      )
        .then(driveRes => {
          if (driveRes && driveRes.success && driveRes.fileUrl) {
            const updatedScans: LabScan[] = scans.map(s =>
              s.id === targetScanId
                ? {
                    ...s,
                    driveUrl: driveRes.fileUrl,
                    previewUrl: driveRes.previewUrl || driveRes.fileUrl,
                    thumbnailUrl: driveRes.thumbnailUrl,
                    fileId: driveRes.fileId,
                    uploadStatus: 'saved_to_drive',
                  }
                : s
            );
            const patientWithDriveUrl = { ...newPatient, scans: updatedScans };
            setSelectedPatientForDossier(prev => (prev?.id === newPatient.id ? patientWithDriveUrl : prev));
            savePatientToGoogleSheet(settings.gasUrl, patientWithDriveUrl).catch(console.warn);
          }
        })
        .catch(console.warn);
    }
  };

  // Global search state with debounce
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebounce(searchQuery, 250);
  const isDebouncing = searchQuery !== debouncedSearchQuery;

  // Real-time matching patients across active patients
  const matchingPatients = useMemo(() => {
    return filterPatientsByQuery(patients, debouncedSearchQuery);
  }, [patients, debouncedSearchQuery]);

  const handleSelectPatientFromSearch = (patientId: string) => {
    handleOpenPatientModal(patientId);
  };

  const handleViewAllSearchResults = () => {
    setActiveView('patients');
  };

  const handleClearSearch = () => {
    setSearchQuery('');
  };

  // Toast state
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info'; id: number } | null>(null);

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ message, type, id: Date.now() });
    setTimeout(() => {
      setToast(curr => (curr?.message === message ? null : curr));
    }, 3500);
  }, []);

  // Hydrate all patient scans from IndexedDB on initial mount
  useEffect(() => {
    let active = true;
    const hydrateAllScans = async () => {
      try {
        const enrichedList = await Promise.all(
          patientsRef.current.map((p: Patient) => (p.scans && p.scans.length > 0 ? enrichPatientScans(p) : p))
        );
        if (active) {
          setPatients(enrichedList);
        }
      } catch (err) {
        console.warn('Scan hydration error:', err);
      }
    };
    hydrateAllScans();
    return () => {
      active = false;
    };
  }, []);

  // Sync state to LocalStorage (sanitizes out heavy base64 to avoid browser 5MB quota error)
  useEffect(() => {
    try {
      const sanitized = patients.map(p => ({
        ...p,
        scans: (p.scans || []).map(s => {
          const { dataUrl, ...rest } = s;
          return rest;
        }),
      }));
      localStorage.setItem('crm_cache_data', JSON.stringify(sanitized));
    } catch (e) {
      console.warn('localStorage save warning:', e);
    }
  }, [patients]);

  useEffect(() => {
    try {
      localStorage.setItem('crm_follow_ups', JSON.stringify(followUps));
    } catch (e) {}
  }, [followUps]);

  useEffect(() => {
    try {
      localStorage.setItem('crm_settings', JSON.stringify(settings));
    } catch (e) {}
  }, [settings]);

  // Sync HTML lang attribute while preserving right-to-left layout mode
  useEffect(() => {
    document.documentElement.setAttribute('lang', lang);
    document.documentElement.setAttribute('dir', 'rtl');
  }, [lang]);

  // Sync theme
  useEffect(() => {
    try {
      localStorage.setItem('crm_theme', theme);
    } catch (e) {}
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
    }
  }, [theme]);

  // Background Google Sheet Sync
  const handleSheetSync = useCallback(async (isManual = false) => {
    const currentSettings = settingsRef.current;
    const currentPatients = patientsRef.current;
    const currentFollowUps = followUpsRef.current;

    if (!currentSettings.gasUrl || !currentSettings.gasUrl.trim()) {
      setSyncStatus('idle');
      setSyncMessage(lang === 'ar' ? 'الرابط غير محدد' : 'No Gas URL');
      if (isManual) {
        showToast(
          lang === 'ar' ? 'يرجى إدخال رابط Google Apps Script في الإعدادات للمزامنة السحابية' : 'Configure Google Apps Script URL in Settings',
          'error'
        );
      }
      return;
    }

    setSyncStatus('syncing');
    setSyncMessage(lang === 'ar' ? 'جارِ المزامنة...' : 'Syncing...');

    try {
      // Fetch upstream using high-speed server proxy with JSONP fallback
      const data = await fetchFromGoogleSheet(currentSettings.gasUrl);
      if (data && Array.isArray(data.patients)) {
        // Sanitize out any legacy mock demo records that might still exist in the user's sheet
        const sanitizedPatients = data.patients.filter(
          p => !p.id?.startsWith('PT-1048') && !p.id?.startsWith('PT-1065')
        );
        const hasLegacyDemo = data.patients.length > sanitizedPatients.length;
        if (hasLegacyDemo && currentSettings.gasUrl) {
          console.log('Cleansing legacy demo patients from Google Sheet...');
          clearGoogleSheetDatabase(currentSettings.gasUrl, ['PT-104821', 'PT-104822', 'PT-104823', 'PT-104824', 'PT-106550']);
        }

        const sanitizedFollowUps = (data.followUps || []).filter(
          f => !f.id?.startsWith('FU-10') && !f.id?.startsWith('FU-20')
        );

        // If sheet is completely empty but local app has real patients:
        // Automatically seed the fresh sheet so data is never erased!
        if (sanitizedPatients.length === 0 && currentPatients.length > 0) {
          console.log('Google Sheet is newly created: seeding data upstream...');
          await syncPushToGoogleSheet(currentSettings.gasUrl, currentPatients, currentFollowUps, currentSettings);
          setSyncStatus('synced');
          setSyncMessage(lang === 'ar' ? 'تم تزويد الشيت' : 'Sheet Seeded');
          if (isManual) {
            showToast(
              lang === 'ar'
                ? `تم تزويد Google Sheet الفارغ بـ (${currentPatients.length} مريض) بنجاح!`
                : `Seeded empty Google Sheet with (${currentPatients.length} patients)!`,
              'success'
            );
          }
          return;
        }

        // Enrich fetched patients with local IndexedDB high-resolution scans
        const enrichedPatients = await Promise.all(
          sanitizedPatients.map((p: Patient) => (p.scans && p.scans.length > 0 ? enrichPatientScans(p) : p))
        );

        // The Google Sheet is the central cloud source of truth.
        setPatients(prev => {
          const deletedCount = prev.filter(localP => !enrichedPatients.some(dp => dp.id === localP.id)).length;
          if (deletedCount > 0 && !isManual) {
            console.log(`Auto-synced: Removed ${deletedCount} patient(s) deleted from Google Sheet.`);
          }
          return enrichedPatients;
        });

        if (Array.isArray(data.followUps)) {
          const activeIds = new Set(sanitizedPatients.map(p => p.id));
          setFollowUps(sanitizedFollowUps.filter(f => !f.patientId || activeIds.has(f.patientId)));
        }

        setSyncStatus('synced');
        setSyncMessage(lang === 'ar' ? 'متصل ومحدث' : 'Synced');
        if (isManual) {
          showToast(
            lang === 'ar'
              ? `تمت المزامنة بنجاح! السجلات متطابقة الآن مع Google Sheet (${sanitizedPatients.length} مريض)`
              : `Synced successfully! Matches Google Sheet (${sanitizedPatients.length} patients)`,
            'success'
          );
        }
      }
    } catch (err: any) {
      console.warn('Sheet sync fetch error:', err);
      setSyncStatus('error');
      setSyncMessage(lang === 'ar' ? 'خطأ في الاتصال' : 'Connection Error');
      if (isManual) {
        showToast(
          lang === 'ar' ? 'فشل الاتصال برابط Google Sheet. تأكد من نشر السكريبت كـ Web App مع إذن Anyone' : 'Connection to Google Sheet failed. Check Web App permissions.',
          'error'
        );
      }
    }
  }, [lang, showToast]);

  // 1. Automatically sync with Google Sheet on app startup & request storage persistence
  useEffect(() => {
    requestPersistentStorage();
    if (settings.gasUrl) {
      handleSheetSync(false);
    }
  }, [settings.gasUrl, handleSheetSync]);

  // 2. Automatically sync whenever the user switches back to the tab or on 60s periodic poll
  useEffect(() => {
    if (!settings.gasUrl) return;

    const onWindowFocusOrVisible = () => {
      if (document.visibilityState === 'visible') {
        handleSheetSync(false);
      }
    };

    window.addEventListener('focus', onWindowFocusOrVisible);
    document.addEventListener('visibilitychange', onWindowFocusOrVisible);

    const pollTimer = setInterval(() => {
      if (document.visibilityState === 'visible') {
        handleSheetSync(false);
      }
    }, 60000);

    return () => {
      window.removeEventListener('focus', onWindowFocusOrVisible);
      document.removeEventListener('visibilitychange', onWindowFocusOrVisible);
      clearInterval(pollTimer);
    };
  }, [settings.gasUrl, handleSheetSync]);

  // Compute navigation badges
  const { dueRefillsCount, activeFollowUpsCount } = useMemo(() => {
    let due = 0;
    const activePts = patients.filter(p => !p.isArchived);

    activePts.forEach(p => {
      const hasDue = (p.medications || []).some(m => {
        const remaining = calculateDaysRemaining(m.lastDispenseDate, m.daysSupply);
        return remaining <= 3;
      });
      if (hasDue) due++;
    });

    const activeFUs = followUps.filter(f => !f.resolved).length;

    return {
      dueRefillsCount: due,
      activeFollowUpsCount: activeFUs,
    };
  }, [patients, followUps]);

  // Handlers for Modals
  const handleOpenPatientModal = (patientId?: string, tab = 'regimen') => {
    if (patientId) {
      const found = patients.find(p => p.id === patientId);
      setSelectedPatientForDossier(found || null);
      setDossierInitialTab(tab);
      setIsDossierOpen(true);
    } else {
      setIsQuickRegistrationOpen(true);
    }
  };

  const handleOpenRefillModal = (patientId: string, medIndex?: number) => {
    const found = patients.find(p => p.id === patientId);
    if (!found) return;
    setRefillPatient(found);
    setRefillInitialMedIndex(medIndex);
    setIsRefillModalOpen(true);
  };

  const handleOpenHouseholdModal = (familyTag: string) => {
    setSelectedFamilyTag(familyTag);
    setIsHouseholdModalOpen(true);
  };

  const handleSavePatient = (updatedPatient: Patient) => {
    setPatients(prev => {
      const idx = prev.findIndex(p => p.id === updatedPatient.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = updatedPatient;
        return copy;
      } else {
        return [updatedPatient, ...prev];
      }
    });
    showToast(lang === 'ar' ? `تم حفظ ملف ${updatedPatient.name} بنجاح` : `Saved ${updatedPatient.name}`, 'success');

    // Persist immediately to Google Sheet in background
    if (settings.gasUrl) {
      setSyncStatus('syncing');
      setSyncMessage(lang === 'ar' ? 'جارِ الحفظ بالسحابة...' : 'Saving to Sheet...');
      savePatientToGoogleSheet(settings.gasUrl, updatedPatient)
        .then(res => {
          if (res.success) {
            setSyncStatus('synced');
            setSyncMessage(lang === 'ar' ? 'تم الحفظ في الشيت' : 'Saved to Sheet');
          }
        })
        .catch(err => {
          console.warn('Failed to save patient to Google Sheet:', err);
        });
    }
  };

  const handleExecuteRefill = (patientId: string, medIndices: number[], daysSupply: number) => {
    const today = formatYMD(new Date());
    const refilledDrugNames: string[] = [];
    let updatedPatientInstance: Patient | null = null;

    setPatients(prev => {
      return prev.map(p => {
        if (p.id !== patientId) return p;

        const updatedMeds = p.medications.map((m, idx) => {
          if (medIndices.includes(idx)) {
            refilledDrugNames.push(m.name);
            const history = Array.isArray(m.refillHistory) ? [...m.refillHistory] : [];
            // Preserve previous dispense date before updating lastDispenseDate to today
            if (m.lastDispenseDate && !history.some(r => (typeof r === 'string' ? r : r.date) === m.lastDispenseDate)) {
              history.push({
                id: `rf-${Date.now()}-${idx}`,
                date: m.lastDispenseDate,
                daysSupply: m.daysSupply || 30,
              });
            }
            return {
              ...m,
              lastDispenseDate: today,
              daysSupply: daysSupply,
              refillHistory: history,
            };
          }
          return m;
        });

        const points = daysSupply >= 90 ? 30 : daysSupply >= 30 ? 10 : 0;

        const updated: Patient = {
          ...p,
          medications: updatedMeds,
          loyaltyPoints: (Number(p.loyaltyPoints) || 0) + points,
        };
        updatedPatientInstance = updated;
        return updated;
      });
    });

    showToast(
      lang === 'ar'
        ? `تم صرف (${refilledDrugNames.join(', ')}) وحفظ نمط (${daysSupply} يوم/حبة)!`
        : `Refilled (${refilledDrugNames.join(', ')}) for ${daysSupply} days`,
      'success'
    );

    if (settings.gasUrl && updatedPatientInstance) {
      savePatientToGoogleSheet(settings.gasUrl, updatedPatientInstance).catch(console.warn);
    }
  };

  const handleApplyHouseholdAlignment = (rows: HouseholdMemberAlignment[]) => {
    const today = formatYMD(new Date());
    const modifiedMembers: Patient[] = [];

    setPatients(prev => {
      return prev.map(member => {
        const memberRows = rows.filter(r => r.patientId === member.id);
        if (memberRows.length === 0) return member;

        const updatedMeds = member.medications.map(med => {
          const matchRow = memberRows.find(r => r.medName === med.name);
          if (matchRow) {
            const daysToTarget = Math.max(
              1,
              Math.ceil(
                (new Date(matchRow.targetDateStr).getTime() - new Date(today).getTime()) / (1000 * 60 * 60 * 24)
              )
            );
            return {
              ...med,
              lastDispenseDate: today,
              daysSupply: daysToTarget,
            };
          }
          return med;
        });

        const updated: Patient = {
          ...member,
          medications: updatedMeds,
        };
        modifiedMembers.push(updated);
        return updated;
      });
    });

    if (settings.gasUrl && modifiedMembers.length > 0) {
      modifiedMembers.forEach(m => savePatientToGoogleSheet(settings.gasUrl, m).catch(console.warn));
    }
  };

  const handleAddFollowUp = (entry: Omit<FollowUpEntry, 'id' | 'createdAt'>) => {
    const newEntry: FollowUpEntry = {
      ...entry,
      id: 'FU-' + Date.now().toString().slice(-6),
      createdAt: new Date().toISOString(),
    };
    setFollowUps(prev => [newEntry, ...prev]);

    if (settings.gasUrl) {
      saveFollowUpToGoogleSheet(settings.gasUrl, newEntry).catch(console.warn);
    }
  };

  const handleResolveFollowUp = (id: string) => {
    let resolvedItem: FollowUpEntry | undefined;
    setFollowUps(prev =>
      prev.map(f => {
        if (f.id === id) {
          resolvedItem = { ...f, resolved: true, resolvedAt: new Date().toISOString() };
          return resolvedItem;
        }
        return f;
      })
    );
    showToast(lang === 'ar' ? 'تم توثيق اكتمال المتابعة بنجاح' : 'Follow-up marked as resolved', 'success');

    if (settings.gasUrl && resolvedItem) {
      saveFollowUpToGoogleSheet(settings.gasUrl, resolvedItem).catch(console.warn);
    }
  };

  const handleDeleteFollowUp = (id: string) => {
    setFollowUps(prev => prev.filter(f => f.id !== id));
    showToast(lang === 'ar' ? 'تم حذف سجل المتابعة' : 'Follow-up deleted', 'info');
  };

  const handleArchivePatient = (patientId: string) => {
    let targetPatient: Patient | undefined;
    setPatients(prev =>
      prev.map(p => {
        if (p.id === patientId) {
          targetPatient = {
            ...p,
            isArchived: true,
            archivedDate: formatYMD(new Date()),
            archiveReason: lang === 'ar' ? 'نقل إلى الأرشيف' : 'Archived',
          };
          return targetPatient;
        }
        return p;
      })
    );
    showToast(lang === 'ar' ? 'تمت أرشفة الملف بنجاح' : 'Patient archived', 'info');

    if (settings.gasUrl && targetPatient) {
      savePatientToGoogleSheet(settings.gasUrl, targetPatient).catch(console.warn);
    }
  };

  const handleDeletePatient = (patientId: string) => {
    setPatients(prev => prev.filter(p => p.id !== patientId));
    setFollowUps(prev => prev.filter(f => f.patientId !== patientId));
    setIsDossierOpen(false);
    setSelectedPatientForDossier(null);
    showToast(lang === 'ar' ? 'تم حذف ملف المريض نهائياً' : 'Patient deleted permanently', 'info');

    // Also delete from Google Sheet if connected
    if (settings.gasUrl) {
      deletePatientFromGoogleSheet(settings.gasUrl, patientId).catch(err => {
        console.warn('Error deleting patient from Google Sheet:', err);
      });
    }
  };

  const handleRestorePatient = (patientId: string) => {
    let targetPatient: Patient | undefined;
    setPatients(prev =>
      prev.map(p => {
        if (p.id === patientId) {
          targetPatient = { ...p, isArchived: false, archivedDate: undefined };
          return targetPatient;
        }
        return p;
      })
    );
    showToast(lang === 'ar' ? 'تمت استعادة الملف بنجاح' : 'Patient restored', 'success');

    if (settings.gasUrl && targetPatient) {
      savePatientToGoogleSheet(settings.gasUrl, targetPatient).catch(console.warn);
    }
  };

  const handleExportBackup = () => {
    const dump = {
      patients,
      followUps,
      settings,
      exportedAt: new Date().toISOString(),
      version: '2.5.0-enterprise',
    };
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(dump, null, 2));
    const dl = document.createElement('a');
    dl.setAttribute('href', dataStr);
    dl.setAttribute('download', `PharmPulse_Enterprise_Backup_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(dl);
    dl.click();
    dl.remove();
    showToast(lang === 'ar' ? 'تم تصدير النسخة الاحتياطية بنجاح' : 'Backup exported', 'success');
  };

  const handleExportCSV = () => {
    const headers = ['ID,Name,Phone,FamilyTag,Age,LoyaltyPoints,PDC,MedicationsCount'];
    const rows = patients.filter(p => !p.isArchived).map(p =>
      `"${p.id}","${p.name}","${p.phone}","${p.familyTag || ''}","${p.age || ''}","${p.loyaltyPoints || 0}","${calculatePDC(p)}%","${(p.medications || []).length}"`
    );
    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers, ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `PharmPulse_Patients_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    showToast(lang === 'ar' ? 'تم تصدير سجل المرضى إلى ملف CSV' : 'Exported patients CSV', 'success');
  };

  const handleExportPatientsExcel = () => {
    const active = patients.filter(p => !p.isArchived);
    const rows = active.map((p, idx) => ({
      'ت (Seq)': idx + 1,
      'اسم المريض': p.name,
      'رقم الهاتف': p.phone,
      'العمر': p.age || '',
      'الجنس': p.gender === 'M' ? 'ذكر' : p.gender === 'F' ? 'أنثى' : '',
      'العائلة': p.familyTag || '',
      'الحساسية': p.allergies || 'لا يوجد (NKDA)',
      'نقاط الولاء': p.loyaltyPoints || 0,
      'نسبة الالتزام (PDC)': `${calculatePDC(p)}%`,
      'الأدوية المزمنة': (p.medications || []).map(m => m.name).join(' | '),
      'عدد الأدوية': (p.medications || []).length,
      'العنوان والملاحظات': p.notes || '',
      'تاريخ التسجيل': p.createdAt ? formatYMD(p.createdAt) : '',
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [
      { wch: 8 },
      { wch: 28 },
      { wch: 18 },
      { wch: 10 },
      { wch: 12 },
      { wch: 16 },
      { wch: 22 },
      { wch: 14 },
      { wch: 18 },
      { wch: 45 },
      { wch: 12 },
      { wch: 35 },
      { wch: 16 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'المرضى_المزمنين');
    XLSX.writeFile(wb, `سجل_المرضى_المزمنين_${settings.pharmacyName || 'PharmPulse'}_${formatYMD(new Date())}.xlsx`);
    showToast(lang === 'ar' ? 'تم تصدير سجل المرضى إلى ملف Excel بنجاح' : 'Exported patients Excel', 'success');
  };

  const handleCommitBulkImport = async (newPatients: Patient[]) => {
    if (newPatients.length === 0) return;
    const updatedList = [...newPatients, ...patients];
    setPatients(updatedList);
    showToast(
      lang === 'ar'
        ? `تم استيراد ${newPatients.length} مريض بنجاح إلى قاعدة البيانات`
        : `Imported ${newPatients.length} patients successfully`,
      'success'
    );

    // Sync upstream to Google Sheets if connected
    if (settings.gasUrl && settings.gasUrl.trim()) {
      setSyncStatus('syncing');
      setSyncMessage(lang === 'ar' ? `مزامنة ${newPatients.length} مريض بالسحابة...` : `Syncing ${newPatients.length}...`);
      try {
        const res = await syncPushToGoogleSheet(settings.gasUrl, updatedList, followUps, settings);
        if (res && res.success) {
          setSyncStatus('synced');
          setSyncMessage(lang === 'ar' ? 'تم حفظ المرضى بالسحابة' : 'Synced to Sheet');
          showToast(lang === 'ar' ? 'تمت مزامنة المرضى الجدد مع Google Sheet' : 'Synced to Google Sheet', 'success');
        }
      } catch (err) {
        console.warn('Failed to push bulk imported patients to Google Sheet:', err);
      }
    }
  };

  const handleImportBackup = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = evt => {
      try {
        const parsed = JSON.parse(evt.target?.result as string);
        if (Array.isArray(parsed.patients)) {
          setPatients(parsed.patients);
          if (Array.isArray(parsed.followUps)) setFollowUps(parsed.followUps);
          if (parsed.settings) setSettings(Object.assign({}, DEFAULT_SETTINGS, parsed.settings));
          showToast(lang === 'ar' ? 'تم استيراد النسخة الاحتياطية وتحديث السجلات بنجاح' : 'Backup restored', 'success');
        } else {
          showToast(lang === 'ar' ? 'ملف النسخة الاحتياطية غير صالح' : 'Invalid backup file', 'error');
        }
      } catch (err) {
        showToast(lang === 'ar' ? 'تعذر قراءة ملف النسخة الاحتياطية' : 'Error reading file', 'error');
      }
    };
    reader.readAsText(file);
  };

  const handleResetDatabase = () => {
    setIsResetModalOpen(true);
  };

  const handleConfirmReset = async (includeCloud: boolean) => {
    setIsResetting(true);
    try {
      const currentPatientIds = patients.map(p => p.id);

      // 1. If user chose full reset and Google Sheet is configured, wipe the cloud database
      if (includeCloud && settings.gasUrl && settings.gasUrl.trim()) {
        try {
          await clearGoogleSheetDatabase(settings.gasUrl, currentPatientIds);
        } catch (cloudErr) {
          console.warn('Error clearing Google Sheet during reset:', cloudErr);
        }
      }

      // 2. Clear all local application state
      setPatients([]);
      setFollowUps([]);
      setIsDossierOpen(false);
      setSelectedPatientForDossier(null);

      // 3. Clear browser localStorage caches
      try {
        localStorage.removeItem('crm_cache_data');
        localStorage.removeItem('crm_follow_ups');
      } catch (e) {}

      // 4. Update sync UI status and show notification
      if (includeCloud && settings.gasUrl) {
        setSyncStatus('synced');
        setSyncMessage(lang === 'ar' ? 'تم التفريغ' : 'Emptied');
        showToast(
          lang === 'ar'
            ? 'تم تفريغ الموقع ومسح بيانات Google Sheet بنجاح! عند المزامنة ستبقى قاعدة البيانات فارغة تماماً.'
            : 'Emptied website and Google Sheet successfully! Future syncs will stay clean.',
          'success'
        );
      } else {
        setSyncStatus('idle');
        setSyncMessage(lang === 'ar' ? 'تم التفريغ محلياً' : 'Local Emptied');
        showToast(
          includeCloud
            ? (lang === 'ar' ? 'تم تفريغ كافة بيانات الموقع بنجاح' : 'Website emptied successfully')
            : (lang === 'ar' ? 'تم تفريغ الموقع محلياً (تنبيه: ستتم استعادة البيانات عند المزامنة القادمة)' : 'Local data cleared (data will restore on next sync)'),
          'info'
        );
      }

      setIsResetModalOpen(false);
    } catch (err: any) {
      console.error('Reset database error:', err);
      showToast(lang === 'ar' ? 'حدث خطأ أثناء تفريغ البيانات' : 'Error resetting database', 'error');
    } finally {
      setIsResetting(false);
    }
  };

  const handlePushLocalToSheet = async () => {
    if (!settings.gasUrl || !settings.gasUrl.trim()) {
      showToast(lang === 'ar' ? 'يرجى إدخال رابط Google Apps Script في الإعدادات أولاً' : 'Configure Gas URL first', 'error');
      return;
    }
    setSyncStatus('syncing');
    setSyncMessage(lang === 'ar' ? 'جارِ رفع البيانات...' : 'Uploading...');
    try {
      const res = await syncPushToGoogleSheet(settings.gasUrl, patients, followUps, settings);
      if (res.success) {
        setSyncStatus('synced');
        setSyncMessage(lang === 'ar' ? 'تم تزويد الشيت' : 'Uploaded');
        showToast(
          lang === 'ar'
            ? `تم تزويد Google Sheet بـ ${patients.length} مريض و ${followUps.length} متابعة بنجاح!`
            : `Uploaded ${patients.length} patients to Google Sheet!`,
          'success'
        );
      } else {
        throw new Error('Push failed');
      }
    } catch (e) {
      setSyncStatus('error');
      setSyncMessage(lang === 'ar' ? 'فشل الرفع' : 'Upload Failed');
      showToast(lang === 'ar' ? 'فشل رفع البيانات إلى Google Sheet' : 'Upload failed', 'error');
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF9F8] dark:bg-[#11100f] text-[#242424] dark:text-[#f3f2f1] font-sans flex flex-col antialiased transition-colors duration-200">
      {/* Toast Notification (Fluent UI MessageBar style) */}
      {toast && (
        <div
          className={`fixed bottom-6 left-6 z-[100] flex items-center gap-2.5 px-4 py-2.5 rounded-[4px] text-xs font-semibold border shadow-md transition-all ${
            toast.type === 'success'
              ? 'bg-[#FFFFFF] dark:bg-[#201f1e] text-[#242424] dark:text-[#f3f2f1] border-l-4 border-l-[#107C41] border-[#EDEBE9] dark:border-[#3b3a39]'
              : toast.type === 'error'
              ? 'bg-[#FDF3F3] dark:bg-[#3a1d1d] text-[#A80000] dark:text-[#f1707b] border-l-4 border-l-[#A80000] border-[#E0A8A8] dark:border-[#6e3535]'
              : 'bg-[#FFFFFF] dark:bg-[#201f1e] text-[#242424] dark:text-[#f3f2f1] border-l-4 border-l-[#0078D4] border-[#EDEBE9] dark:border-[#3b3a39]'
          }`}
        >
          <span className="font-bold">{toast.type === 'success' ? '✓' : toast.type === 'error' ? '!' : 'ℹ'}</span>
          <span>{toast.message}</span>
        </div>
      )}

      {/* Top Command Bar / Header */}
      <Header
        pharmacyName={settings.pharmacyName}
        syncStatus={syncStatus}
        syncMessage={syncMessage}
        onSync={() => handleSheetSync(true)}
        lang={lang}
        onToggleLang={() => setLang(l => (l === 'ar' ? 'en' : 'ar'))}
        theme={theme}
        onToggleTheme={() => setTheme(t => (t === 'dark' ? 'light' : 'dark'))}
        onOpenNewPatient={() => handleOpenPatientModal()}
        onOpenNewFollowUp={() => setIsFollowUpModalOpen(true)}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onClearSearch={handleClearSearch}
        matchingPatients={matchingPatients}
        isDebouncing={isDebouncing}
        onSelectPatient={handleSelectPatientFromSearch}
        onViewAllResults={handleViewAllSearchResults}
      />

      {/* Navigation Pivot Bar */}
      <Navigation
        activeView={activeView}
        onSelectView={setActiveView}
        dueRefillsCount={dueRefillsCount}
        activeFollowUpsCount={activeFollowUpsCount}
        lang={lang}
      />

      {/* Main Viewport Container */}
      <main className="flex-1 p-0 sm:p-3 md:p-6 max-w-[1600px] w-full mx-auto pb-24 md:pb-6">
        {activeView === 'dashboard' && (
          <DashboardView
            patients={patients}
            followUps={followUps}
            pharmacyName={settings.pharmacyName}
            waTemplate={settings.waTemplate}
            smsTemplate={settings.smsTemplate}
            lang={lang}
            onOpenPatientModal={handleOpenPatientModal}
            onOpenRefillModal={handleOpenRefillModal}
            onOpenHouseholdModal={handleOpenHouseholdModal}
            onOpenFollowUpModal={() => setIsFollowUpModalOpen(true)}
            onOpenDeliveryManifest={() => setIsDeliveryManifestOpen(true)}
            onUpdatePatient={handleSavePatient}
            onShowToast={showToast}
            onSelectView={setActiveView}
          />
        )}

        {activeView === 'patients' && (
          <PatientsView
            patients={patients}
            lang={lang}
            onOpenPatientModal={handleOpenPatientModal}
            onOpenHouseholdModal={handleOpenHouseholdModal}
            onOpenAiRxModal={() => setIsAiRxModalOpen(true)}
            onOpenBulkImport={() => setIsBulkImportOpen(true)}
            onExportExcel={handleExportPatientsExcel}
            onArchivePatient={handleArchivePatient}
            onShowToast={showToast}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onClearSearch={handleClearSearch}
            debouncedSearchQuery={debouncedSearchQuery}
          />
        )}

        {activeView === 'followup' && (
          <FollowUpView
            followUps={followUps}
            patients={patients}
            pharmacyName={settings.pharmacyName}
            waAbxTemplate={settings.waAbxTemplate}
            waChronicFollowTemplate={settings.waChronicFollowTemplate}
            lang={lang}
            onOpenFollowUpModal={() => setIsFollowUpModalOpen(true)}
            onOpenPatientModal={handleOpenPatientModal}
            onResolveFollowUp={handleResolveFollowUp}
            onDeleteFollowUp={handleDeleteFollowUp}
            onShowToast={showToast}
          />
        )}

        {activeView === 'timeline' && (
          <TimelineView
            patients={patients}
            lang={lang}
            onOpenRefillModal={handleOpenRefillModal}
            onOpenPatientModal={handleOpenPatientModal}
          />
        )}

        {activeView === 'inventory' && (
          <InventoryForecastView
            patients={patients}
            lang={lang}
            onShowToast={showToast}
          />
        )}

        {activeView === 'reports' && (
          <ReportsView
            patients={patients}
            lang={lang}
          />
        )}

        {activeView === 'archive' && (
          <ArchiveView
            patients={patients}
            lang={lang}
            onRestorePatient={handleRestorePatient}
          />
        )}

        {activeView === 'settings' && (
          <SettingsView
            settings={settings}
            lang={lang}
            onSaveSettings={s => {
              setSettings(s);
              showToast(lang === 'ar' ? 'تم حفظ الإعدادات' : 'Settings saved', 'success');
            }}
            onExportBackup={handleExportBackup}
            onExportCSV={handleExportCSV}
            onImportBackup={handleImportBackup}
            onResetDatabase={handleResetDatabase}
            onTestSheetConnection={() => handleSheetSync(true)}
            onPushLocalToSheet={handlePushLocalToSheet}
            onOpenBulkImport={() => setIsBulkImportOpen(true)}
          />
        )}
      </main>

      {/* Mobile Touch-First Bottom Navigation Bar */}
      <MobileBottomNav
        activeView={activeView}
        onSelectView={setActiveView}
        dueRefillsCount={dueRefillsCount}
        activeFollowUpsCount={activeFollowUpsCount}
        lang={lang}
        setLang={setLang}
        theme={theme}
        setTheme={setTheme}
      />

      {/* MODALS */}
      {/* 1. Patient Dossier Modal */}
      <PatientDossierModal
        isOpen={isDossierOpen}
        onClose={() => setIsDossierOpen(false)}
        patient={selectedPatientForDossier}
        patients={patients}
        initialTab={dossierInitialTab}
        followUps={followUps}
        pharmacyName={settings.pharmacyName}
        gasUrl={settings.gasUrl}
        lang={lang}
        onSavePatient={handleSavePatient}
        onDeletePatient={handleDeletePatient}
        onOpenHouseholdModal={handleOpenHouseholdModal}
        onOpenNewFollowUp={() => setIsFollowUpModalOpen(true)}
        onShowToast={showToast}
      />

      {/* 2. Granular Refill Modal */}
      <RefillModal
        isOpen={isRefillModalOpen}
        onClose={() => setIsRefillModalOpen(false)}
        patient={refillPatient}
        initialMedIndex={refillInitialMedIndex}
        lang={lang}
        pharmacyName={settings.pharmacyName}
        onExecuteRefill={handleExecuteRefill}
        onShowToast={showToast}
      />

      {/* 3. Household Sync Modal */}
      <HouseholdSyncModal
        isOpen={isHouseholdModalOpen}
        onClose={() => setIsHouseholdModalOpen(false)}
        familyTag={selectedFamilyTag}
        patients={patients}
        pharmacyName={settings.pharmacyName}
        lang={lang}
        onApplyAlignment={handleApplyHouseholdAlignment}
        onShowToast={showToast}
      />

      {/* 4. Follow Up Modal */}
      <FollowUpModal
        isOpen={isFollowUpModalOpen}
        onClose={() => setIsFollowUpModalOpen(false)}
        patients={patients}
        lang={lang}
        onAddFollowUp={handleAddFollowUp}
        onShowToast={showToast}
      />

      {/* 5. Reset Database Confirmation Modal */}
      <ResetDatabaseModal
        isOpen={isResetModalOpen}
        onClose={() => setIsResetModalOpen(false)}
        isGoogleSheetConnected={Boolean(settings.gasUrl && settings.gasUrl.trim())}
        gasUrl={settings.gasUrl}
        patientCount={patients.length}
        followUpCount={followUps.length}
        lang={lang}
        isResetting={isResetting}
        onConfirmReset={handleConfirmReset}
      />

      {/* 6. AI Rx Extraction Modal */}
      <AiRxExtractionModal
        isOpen={isAiRxModalOpen}
        onClose={() => setIsAiRxModalOpen(false)}
        lang={lang}
        pharmacyName={settings.pharmacyName}
        onApplyToPatient={handleApplyAiRxToNewPatient}
        onShowToast={showToast}
      />

      {/* 7. Quick 3-Step Patient Registration Modal */}
      <QuickPatientRegistrationModal
        isOpen={isQuickRegistrationOpen}
        onClose={() => setIsQuickRegistrationOpen(false)}
        patients={patients}
        lang={lang}
        isCloudConnected={Boolean(settings.gasUrl && settings.gasUrl.trim())}
        onSavePatient={handleSavePatient}
        onOpenPatientDossier={(patientId) => {
          handleOpenPatientModal(patientId);
        }}
        onShowToast={showToast}
      />

      {/* 8. Bulk Patient Excel/CSV Import Modal */}
      <BulkPatientImportModal
        isOpen={isBulkImportOpen}
        onClose={() => setIsBulkImportOpen(false)}
        existingPatients={patients}
        onCommitImport={handleCommitBulkImport}
        onShowToast={showToast}
        lang={lang}
      />

      {/* 9. Daily Refill & Delivery Dispatch Manifest Modal */}
      <DeliveryManifestModal
        isOpen={isDeliveryManifestOpen}
        onClose={() => setIsDeliveryManifestOpen(false)}
        patients={patients}
        pharmacyName={settings.pharmacyName}
        waTemplate={settings.waTemplate}
        onUpdatePatient={handleSavePatient}
        onShowToast={showToast}
        lang={lang}
      />
    </div>
  );
}
