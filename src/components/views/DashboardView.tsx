import React, { useState, useMemo } from 'react';
import {
  Users,
  AlertCircle,
  Clock,
  UserX,
  Search,
  MessageSquare,
  Send,
  Zap,
  FileText,
  TrendingUp,
  CheckCircle2,
  Stethoscope,
  Plus,
  Microscope,
  Pill,
  ArrowLeftRight,
  Star,
  Truck,
  Printer,
} from 'lucide-react';
import { Patient, FollowUpEntry } from '../../types/pharmacy';
import { ViewType } from '../Navigation';
import {
  calculatePDC,
  calculateDaysRemaining,
  formatYMD,
  formatPhoneForWhatsApp,
  executeUniversalSMS,
} from '../../utils/pharmacyCalculations';
import {
  getPatientLabRadar,
  generateLabTestWhatsAppReminder,
  LabRadarItem,
} from '../../utils/clinicalIntelligence';

interface DashboardViewProps {
  patients: Patient[];
  followUps: FollowUpEntry[];
  pharmacyName: string;
  waTemplate: string;
  smsTemplate: string;
  lang: 'ar' | 'en';
  onOpenPatientModal: (patientId?: string, tab?: string) => void;
  onOpenRefillModal: (patientId: string, medIndex?: number) => void;
  onOpenHouseholdModal: (familyTag: string) => void;
  onOpenFollowUpModal: () => void;
  onOpenDeliveryManifest?: () => void;
  onUpdatePatient: (patient: Patient) => void;
  onShowToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  onSelectView?: (view: ViewType) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  patients,
  followUps,
  pharmacyName,
  waTemplate,
  smsTemplate,
  lang,
  onOpenPatientModal,
  onOpenRefillModal,
  onOpenHouseholdModal,
  onOpenFollowUpModal,
  onOpenDeliveryManifest,
  onUpdatePatient,
  onShowToast,
  onSelectView,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [dispatchFilter, setDispatchFilter] = useState<'MEDS' | 'LABS' | 'DUAL' | 'ALL' | 'DROPOUTS'>('MEDS');

  const activePatients = useMemo(() => patients.filter(p => !p.isArchived), [patients]);

  // Calculations for Dispatch Queue
  const { dueRefillsCount, dropoutsCount, dispatchRows, totalDemandMatches } = useMemo(() => {
    let dueCount = 0;
    let dropoutCount = 0;
    const rows: {
      patient: Patient;
      earliestDueDate: Date;
      dueMeds: { name: string; daysRemaining: number; nextDue: Date }[];
      dueLabs: LabRadarItem[];
      medRefillStatus: {
        type: 'overdue' | 'due_now' | 'due_soon' | 'stocked' | 'no_meds';
        minDaysRemaining: number;
        closestMedName: string;
        labelAr: string;
        labelEn: string;
      };
      labRetestStatus: {
        type: 'overdue' | 'due_soon' | 'up_to_date' | 'no_labs';
        testsCount: number;
        primaryTestName: string;
        labelAr: string;
        labelEn: string;
      };
      hasDueMed: boolean;
      hasDueLab: boolean;
      pdc: number;
      isDropout: boolean;
    }[] = [];

    const now = new Date();
    const query = searchQuery.trim().toLowerCase();
    let demandMatches = 0;

    activePatients.forEach(p => {
      let patientIsDropout = false;
      let patientIsDueSoon = false;
      let earliestDate: Date | null = null;
      const dueMeds: { name: string; daysRemaining: number; nextDue: Date }[] = [];

      const allMeds = p.medications || [];
      let minDaysRemaining = Infinity;
      let closestMedName = '';

      for (const m of allMeds) {
        if (query && m.name.toLowerCase().includes(query)) {
          demandMatches++;
        }

        const daysRemaining = calculateDaysRemaining(m.lastDispenseDate, m.daysSupply);
        const lastDate = new Date(m.lastDispenseDate);
        const nextDue = new Date(lastDate.getFullYear(), lastDate.getMonth(), lastDate.getDate() + (m.daysSupply || 30));

        if (daysRemaining < minDaysRemaining) {
          minDaysRemaining = daysRemaining;
          closestMedName = m.name;
        }

        if (daysRemaining <= 3) {
          dueMeds.push({
            name: m.name,
            daysRemaining,
            nextDue,
          });

          if (!earliestDate || nextDue < earliestDate) {
            earliestDate = nextDue;
          }

          if (daysRemaining >= -14) {
            patientIsDueSoon = true;
          } else {
            patientIsDropout = true;
          }
        }
      }

      // Calculate Periodic Lab Tests that need retesting
      const radar = getPatientLabRadar(p);
      const dueLabs = radar.filter(r => r.status === 'overdue' || r.status === 'due_soon');
      const overdueLabs = dueLabs.filter(l => l.status === 'overdue');

      if (!earliestDate && dueLabs.length > 0) {
        const maxOverdue = Math.max(...dueLabs.map(l => l.daysOverdue));
        if (maxOverdue > 0) {
          earliestDate = new Date(now.getTime() - maxOverdue * 24 * 60 * 60 * 1000);
        } else {
          earliestDate = now;
        }
      }

      // Med Refill Status for Cross-Indicator
      let medRefillStatus: {
        type: 'overdue' | 'due_now' | 'due_soon' | 'stocked' | 'no_meds';
        minDaysRemaining: number;
        closestMedName: string;
        labelAr: string;
        labelEn: string;
      };

      if (allMeds.length === 0) {
        medRefillStatus = {
          type: 'no_meds',
          minDaysRemaining: 0,
          closestMedName: '',
          labelAr: 'لا توجد أدوية مسجلة',
          labelEn: 'No medications registered',
        };
      } else if (minDaysRemaining < 0) {
        medRefillStatus = {
          type: 'overdue',
          minDaysRemaining,
          closestMedName,
          labelAr: `متأخر عن الصرف (${Math.abs(minDaysRemaining)} يوم) • ${closestMedName}`,
          labelEn: `Refill overdue (${Math.abs(minDaysRemaining)}d) • ${closestMedName}`,
        };
      } else if (minDaysRemaining <= 1) {
        medRefillStatus = {
          type: 'due_now',
          minDaysRemaining,
          closestMedName,
          labelAr: `مستحق الصرف اليوم • ${closestMedName}`,
          labelEn: `Refill due today • ${closestMedName}`,
        };
      } else if (minDaysRemaining <= 3) {
        medRefillStatus = {
          type: 'due_soon',
          minDaysRemaining,
          closestMedName,
          labelAr: `مستحق بعد ${minDaysRemaining} أيام • ${closestMedName}`,
          labelEn: `Due in ${minDaysRemaining}d • ${closestMedName}`,
        };
      } else {
        medRefillStatus = {
          type: 'stocked',
          minDaysRemaining,
          closestMedName,
          labelAr: `العلاج متوفر (متبقي ${minDaysRemaining} يوم لـ ${closestMedName})`,
          labelEn: `Medication stocked (${minDaysRemaining}d left for ${closestMedName})`,
        };
      }

      // Lab Retest Status for Cross-Indicator
      let labRetestStatus: {
        type: 'overdue' | 'due_soon' | 'up_to_date' | 'no_labs';
        testsCount: number;
        primaryTestName: string;
        labelAr: string;
        labelEn: string;
      };

      if (radar.length === 0) {
        labRetestStatus = {
          type: 'no_labs',
          testsCount: 0,
          primaryTestName: '',
          labelAr: 'لا توجد تحاليل مجدولة',
          labelEn: 'No scheduled labs',
        };
      } else if (overdueLabs.length > 0) {
        const testNames = overdueLabs.map(l => l.testNameAr).join(' و ');
        const maxOverdue = Math.max(...overdueLabs.map(l => l.daysOverdue));
        labRetestStatus = {
          type: 'overdue',
          testsCount: overdueLabs.length,
          primaryTestName: overdueLabs[0].testNameAr,
          labelAr: `يحتاج إعادة فحص (+${maxOverdue} يوم): ${testNames}`,
          labelEn: `Retest overdue (+${maxOverdue}d): ${testNames}`,
        };
      } else if (dueLabs.length > 0) {
        const testNames = dueLabs.map(l => l.testNameAr).join(' و ');
        labRetestStatus = {
          type: 'due_soon',
          testsCount: dueLabs.length,
          primaryTestName: dueLabs[0].testNameAr,
          labelAr: `مستحق قريباً: ${testNames}`,
          labelEn: `Due soon: ${testNames}`,
        };
      } else {
        labRetestStatus = {
          type: 'up_to_date',
          testsCount: 0,
          primaryTestName: '',
          labelAr: 'التحاليل الدورية محدثة وضمن الموعد',
          labelEn: 'Periodic labs up to date',
        };
      }

      if (patientIsDueSoon) dueCount++;
      if (patientIsDropout) dropoutCount++;

      const hasDueMed = dueMeds.length > 0;
      const hasDueLab = dueLabs.length > 0;

      // Include patient if they have medication due OR a lab test that requires retesting
      if (hasDueMed || hasDueLab) {
        rows.push({
          patient: p,
          earliestDueDate: earliestDate || new Date(),
          dueMeds,
          dueLabs,
          medRefillStatus,
          labRetestStatus,
          hasDueMed,
          hasDueLab,
          pdc: calculatePDC(p),
          isDropout: patientIsDropout,
        });
      }
    });

    // Filter by search query if present
    const filteredRows = query
      ? rows.filter(r => {
          const matchPatient = r.patient.name.toLowerCase().includes(query) ||
            r.patient.phone.includes(query) ||
            (r.patient.familyTag && r.patient.familyTag.toLowerCase().includes(query));
          const matchMed = r.dueMeds.some(m => m.name.toLowerCase().includes(query));
          const matchLab = r.dueLabs.some(l =>
            l.testNameAr.toLowerCase().includes(query) ||
            l.testNameEn.toLowerCase().includes(query)
          );
          return matchPatient || matchMed || matchLab;
        })
      : rows;

    filteredRows.sort((a, b) => a.earliestDueDate.getTime() - b.earliestDueDate.getTime());

    return {
      dueRefillsCount: dueCount,
      dropoutsCount: dropoutCount,
      dispatchRows: filteredRows,
      totalDemandMatches: demandMatches,
    };
  }, [activePatients, searchQuery]);

  const visibleRows = useMemo(() => {
    return dispatchRows.filter(r => {
      if (dispatchFilter === 'MEDS') return r.hasDueMed;
      if (dispatchFilter === 'LABS') return r.hasDueLab;
      if (dispatchFilter === 'DUAL') return r.hasDueMed && r.hasDueLab;
      if (dispatchFilter === 'DROPOUTS') return r.isDropout;
      return true;
    });
  }, [dispatchRows, dispatchFilter]);

  const pendingFollowUps = useMemo(() => followUps.filter(f => !f.resolved), [followUps]);

  const overdueLabsCount = useMemo(() => {
    let count = 0;
    activePatients.forEach(p => {
      const radar = getPatientLabRadar(p);
      const overdue = radar.filter(r => r.status === 'overdue' || r.status === 'due_soon');
      count += overdue.length;
    });
    return count;
  }, [activePatients]);

  // WhatsApp Reminder Sender
  const handleSendWhatsApp = (row: typeof dispatchRows[0]) => {
    const p = row.patient;
    if (p.phoneUnavailable || !p.phone || p.phone === 'غير متوفر') {
      onShowToast(lang === 'ar' ? 'رقم الهاتف غير متوفر لهذا المريض' : 'Phone number unavailable for this patient', 'error');
      return;
    }
    const dueMedNames = row.dueMeds.map(m => m.name).join(' و ');
    const template =
      waTemplate ||
      'مرحباً {name}، تحيات {pharmacy}. نود تذكيرك بأن موعد تكرار علاجك ({drug}) مستحق بتاريخ {date}. يرجى مراجعتنا لاستلام أدويتك لضمان استقرار حالتك الصحية.';

    let message = template
      .replace('{name}', p.name)
      .replace('{pharmacy}', pharmacyName)
      .replace('{drug}', dueMedNames || (lang === 'ar' ? 'أدويتكم المزمنة' : 'your medications'))
      .replace('{date}', formatYMD(row.earliestDueDate));

    if (row.dueLabs && row.dueLabs.length > 0) {
      const labNames = row.dueLabs.map(l => l.testNameAr).join(' و ');
      message += `\n\n🔬 *تذكير سريري بإعادة الفحص:* يرجى العلم بأن موعد إجراء (${labNames}) أصبح مستحقاً للمتابعة الدورية والتأكد من ملاءمة الجرعات.`;
      if (row.dueLabs[0].fastingNoteAr) {
        message += `\n📋 *ملاحظة الفحص:* ${row.dueLabs[0].fastingNoteAr}`;
      }
    }

    const updated = {
      ...p,
      lastReminderSent: new Date().toISOString(),
    };
    onUpdatePatient(updated);

    const cleanPhone = formatPhoneForWhatsApp(p.phone);
    window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`, '_blank');
    onShowToast(
      lang === 'ar'
        ? `تم فتح WhatsApp لإرسال تذكير إلى ${p.name}`
        : `Opened WhatsApp for ${p.name}`,
      'success'
    );
  };

  // Dedicated WhatsApp Lab Retest Sender
  const handleSendLabWhatsApp = (row: typeof dispatchRows[0]) => {
    const p = row.patient;
    if (p.phoneUnavailable || !p.phone || p.phone === 'غير متوفر') {
      onShowToast(lang === 'ar' ? 'رقم الهاتف غير متوفر لهذا المريض' : 'Phone number unavailable for this patient', 'error');
      return;
    }
    const lab = row.dueLabs[0];
    if (!lab) return;

    const { encodedUrl } = generateLabTestWhatsAppReminder({
      patient: p,
      testNameAr: row.dueLabs.map(l => l.testNameAr).join(' + '),
      frequencyLabel: lab.frequencyLabelAr,
      pharmacyName,
      fastingNote: lab.fastingNoteAr,
    });
    window.open(encodedUrl, '_blank');
    onShowToast(
      lang === 'ar'
        ? `تم فتح WhatsApp لإرسال تذكير إعادة التحليل إلى ${p.name}`
        : `Opened WhatsApp lab reminder for ${p.name}`,
      'success'
    );
  };

  // SMS Reminder Sender
  const handleSendSMS = (row: typeof dispatchRows[0]) => {
    const p = row.patient;
    if (p.phoneUnavailable || !p.phone || p.phone === 'غير متوفر') {
      onShowToast(lang === 'ar' ? 'رقم الهاتف غير متوفر لهذا المريض' : 'Phone number unavailable for this patient', 'error');
      return;
    }
    const dueMedNames = row.dueMeds.map(m => m.name).join(' و ');
    const template =
      smsTemplate ||
      '{pharmacy}: نذكركم بأن موعد تكرار علاجكم ({drug}) مستحق بتاريخ {date}. صحتكم أولويتنا.';

    const message = template
      .replace('{name}', p.name)
      .replace('{pharmacy}', pharmacyName)
      .replace('{drug}', dueMedNames)
      .replace('{date}', formatYMD(row.earliestDueDate));

    const updated = {
      ...p,
      lastReminderSent: new Date().toISOString(),
    };
    onUpdatePatient(updated);

    executeUniversalSMS(p.phone, message);
    onShowToast(
      lang === 'ar'
        ? `تم تجهيز رسالة SMS إلى ${p.name}`
        : `Prepared SMS for ${p.name}`,
      'success'
    );
  };

  return (
    <div className="space-y-3 sm:space-y-4 bg-transparent text-[#242424] dark:text-[#f3f2f1] px-2 sm:px-0 pt-2 sm:pt-0">
      {/* Compressed Ultra-Compact Metrics Row (5 Clickable Function Buttons) */}
      <div className="grid grid-cols-5 gap-1 sm:gap-1.5 -mt-px sm:mt-0">
        {/* Metric 1: Active Patients -> Opens Patients view */}
        <button
          type="button"
          onClick={() => onSelectView?.('patients')}
          title={lang === 'ar' ? 'عرض دليل المرضى' : 'View Patients Directory'}
          className="bg-white dark:bg-[#201f1e] border border-[#EDEBE9] dark:border-[#3b3a39] hover:border-[#0078D4] dark:hover:border-[#2899f5] hover:bg-[#F3F2F1] dark:hover:bg-[#252423] p-1 sm:p-2 rounded-[4px] flex flex-col justify-between transition-all cursor-pointer text-right dir-rtl group shadow-none min-h-[46px]"
        >
          <div className="flex items-center justify-between w-full">
            <span className="text-[10px] sm:text-xs font-bold text-[#242424] dark:text-[#f3f2f1] font-mono leading-none">
              {activePatients.length}
            </span>
            <Users className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-[#0078D4] shrink-0" />
          </div>
          <span className="text-[9px] sm:text-[10px] text-[#605E5C] dark:text-[#a19f9d] truncate font-medium mt-0.5 leading-tight block w-full text-right">
            {lang === 'ar' ? 'المرضى' : 'Patients'}
          </span>
        </button>

        {/* Metric 2: Clinical Follow-Ups -> Opens Follow-Up view */}
        <button
          type="button"
          onClick={() => onSelectView?.('followup')}
          title={lang === 'ar' ? 'عرض المتابعات السريرية' : 'View Clinical Follow-Ups'}
          className="bg-white dark:bg-[#201f1e] border border-[#EDEBE9] dark:border-[#3b3a39] hover:border-[#0078D4] dark:hover:border-[#2899f5] hover:bg-[#F3F2F1] dark:hover:bg-[#252423] p-1 sm:p-2 rounded-[4px] flex flex-col justify-between transition-all cursor-pointer text-right dir-rtl group shadow-none min-h-[46px]"
        >
          <div className="flex items-center justify-between w-full">
            <span className="text-[10px] sm:text-xs font-bold text-[#242424] dark:text-[#f3f2f1] font-mono leading-none">
              {pendingFollowUps.length}
            </span>
            <Stethoscope className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-[#0078D4] shrink-0" />
          </div>
          <span className="text-[9px] sm:text-[10px] text-[#605E5C] dark:text-[#a19f9d] truncate font-medium mt-0.5 leading-tight block w-full text-right">
            {lang === 'ar' ? 'المتابعات' : 'Follow-Ups'}
          </span>
        </button>

        {/* Metric 3: Refills Due -> Filters dispatch hub to MEDS */}
        <button
          type="button"
          onClick={() => {
            setDispatchFilter('MEDS');
            document.getElementById('dispatch-hub-table')?.scrollIntoView({ behavior: 'smooth' });
          }}
          title={lang === 'ar' ? 'تصفية مستحقي الصرف' : 'Filter Refills Due'}
          className={`border p-1 sm:p-2 rounded-[4px] flex flex-col justify-between transition-all cursor-pointer text-right dir-rtl group shadow-none min-h-[46px] ${
            dispatchFilter === 'MEDS'
              ? 'bg-[#EFF6FC] dark:bg-[#112338] border-[#0078D4] dark:border-[#2899f5]'
              : 'bg-white dark:bg-[#201f1e] border-[#EDEBE9] dark:border-[#3b3a39] hover:border-[#0078D4] hover:bg-[#F3F2F1] dark:hover:bg-[#252423]'
          }`}
        >
          <div className="flex items-center justify-between w-full">
            <span className="text-[10px] sm:text-xs font-bold text-[#0078D4] dark:text-[#2899f5] font-mono leading-none">
              {dueRefillsCount}
            </span>
            <Clock className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-[#0078D4] shrink-0" />
          </div>
          <span className="text-[9px] sm:text-[10px] text-[#605E5C] dark:text-[#a19f9d] truncate font-medium mt-0.5 leading-tight block w-full text-right">
            {lang === 'ar' ? 'المستحقون' : 'Refills Due'}
          </span>
        </button>

        {/* Metric 4: Therapy Dropouts -> Filters dispatch hub to DROPOUTS */}
        <button
          type="button"
          onClick={() => {
            setDispatchFilter('DROPOUTS');
            document.getElementById('dispatch-hub-table')?.scrollIntoView({ behavior: 'smooth' });
          }}
          title={lang === 'ar' ? 'تصفية المنقطعين عن العلاج' : 'Filter Therapy Dropouts'}
          className={`border p-1 sm:p-2 rounded-[4px] flex flex-col justify-between transition-all cursor-pointer text-right dir-rtl group shadow-none min-h-[46px] ${
            dispatchFilter === 'DROPOUTS'
              ? 'bg-[#FDF3F3] dark:bg-[#3a1d1d] border-[#A80000] dark:border-[#f1707b]'
              : 'bg-white dark:bg-[#201f1e] border-[#EDEBE9] dark:border-[#3b3a39] hover:border-[#A80000] hover:bg-[#FDF3F3] dark:hover:bg-[#3a1d1d]'
          }`}
        >
          <div className="flex items-center justify-between w-full">
            <span className="text-[10px] sm:text-xs font-bold text-[#A80000] dark:text-[#f1707b] font-mono leading-none">
              {dropoutsCount}
            </span>
            <UserX className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-[#A80000] dark:text-[#f1707b] shrink-0" />
          </div>
          <span className="text-[9px] sm:text-[10px] text-[#A80000] dark:text-[#f1707b] truncate font-medium mt-0.5 leading-tight block w-full text-right">
            {lang === 'ar' ? 'المنقطعون' : 'Dropouts'}
          </span>
        </button>

        {/* Metric 5: Periodic Labs Due -> Filters dispatch hub to LABS */}
        <button
          type="button"
          onClick={() => {
            setDispatchFilter('LABS');
            document.getElementById('dispatch-hub-table')?.scrollIntoView({ behavior: 'smooth' });
          }}
          title={lang === 'ar' ? 'تصفية الفحوصات الدورية المستحقة' : 'Filter Periodic Labs Due'}
          className={`border p-1 sm:p-2 rounded-[4px] flex flex-col justify-between transition-all cursor-pointer text-right dir-rtl group shadow-none min-h-[46px] ${
            dispatchFilter === 'LABS'
              ? 'bg-[#EFF6FC] dark:bg-[#112338] border-[#0078D4] dark:border-[#2899f5]'
              : 'bg-white dark:bg-[#201f1e] border-[#EDEBE9] dark:border-[#3b3a39] hover:border-[#0078D4] hover:bg-[#F3F2F1] dark:hover:bg-[#252423]'
          }`}
        >
          <div className="flex items-center justify-between w-full">
            <span className="text-[10px] sm:text-xs font-bold text-[#242424] dark:text-[#f3f2f1] font-mono leading-none">
              {overdueLabsCount}
            </span>
            <Microscope className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-[#0078D4] shrink-0" />
          </div>
          <span className="text-[9px] sm:text-[10px] text-[#605E5C] dark:text-[#a19f9d] truncate font-medium mt-0.5 leading-tight block w-full text-right">
            {lang === 'ar' ? 'التحاليل' : 'Labs Due'}
          </span>
        </button>
      </div>

      {/* Universal Search & Demand Forecast */}
      <div className="bg-white dark:bg-[#201f1e] border border-[#EDEBE9] dark:border-[#3b3a39] p-2.5 rounded-[4px] space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="font-bold text-xs text-[#242424] dark:text-[#f3f2f1] flex items-center gap-1.5">
            <Search className="w-3.5 h-3.5 text-[#0078D4]" />
            <span>{lang === 'ar' ? 'البحث السريع' : 'Universal Search'}</span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={onOpenFollowUpModal}
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold bg-white dark:bg-[#252423] text-[#242424] dark:text-[#f3f2f1] border border-[#EDEBE9] dark:border-[#3b3a39] hover:bg-[#F3F2F1] rounded-[4px] cursor-pointer"
            >
              <Stethoscope className="w-3.5 h-3.5 text-[#0078D4]" />
              <span>{lang === 'ar' ? 'متابعة' : 'Follow-Up'}</span>
            </button>
            <button
              onClick={() => onOpenPatientModal()}
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold bg-[#0078D4] hover:bg-[#106EBE] active:bg-[#005A9E] text-white rounded-[4px] cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 text-white" />
              <span>{lang === 'ar' ? 'مريض جديد' : 'New Patient'}</span>
            </button>
          </div>
        </div>

        {/* Fluent UI Underlined Input style */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-[#605E5C] dark:text-[#a19f9d] absolute right-2 top-2" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder={
              lang === 'ar'
                ? 'اسم المريض، الهاتف، الدواء، العائلة...'
                : 'Search patient, phone, drug, family...'
            }
            className="w-full bg-transparent border-0 border-b border-[#EDEBE9] dark:border-[#3b3a39] text-[#242424] dark:text-[#f3f2f1] placeholder-[#605E5C] text-xs px-7 py-1.5 outline-none focus:border-[#0078D4]"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute left-2 top-1.5 text-xs text-[#605E5C] hover:text-[#242424]"
            >
              ✕
            </button>
          )}
        </div>

        {/* Demand Forecast Banner (Compact) */}
        {searchQuery && totalDemandMatches > 0 && (
          <div className="bg-[#FFF4CE] dark:bg-[#3a3118] border border-[#FFE699] dark:border-[#5a4c21] p-2 text-xs text-[#7A5B00] dark:text-[#f3d36b] flex items-center justify-between gap-2 rounded-[4px]">
            <div className="flex items-center gap-1.5 text-[11px]">
              <TrendingUp className="w-3.5 h-3.5 text-[#7A5B00] dark:text-[#f3d36b] shrink-0" />
              <span>
                <strong>{lang === 'ar' ? 'الطلب المتوقع:' : 'Forecast:'}</strong> {totalDemandMatches} {lang === 'ar' ? 'مريض مطابق' : 'matching patients'}
              </span>
            </div>
            <span className="font-semibold text-[#7A5B00] dark:text-[#f3d36b] bg-white dark:bg-[#201f1e] border border-[#FFE699] dark:border-[#5a4c21] px-1.5 py-0.2 text-[10px] rounded font-mono">
              {totalDemandMatches} SKUs
            </span>
          </div>
        )}
      </div>

      {/* Priority Dispatch Room */}
      <div id="dispatch-hub-table" className="bg-white dark:bg-[#201f1e] border border-[#EDEBE9] dark:border-[#3b3a39] rounded-[4px] overflow-hidden">
        {/* Hub Header & Shortened Tabs */}
        <div className="p-2.5 border-b border-[#EDEBE9] dark:border-[#3b3a39] space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="font-bold text-xs text-[#242424] dark:text-[#f3f2f1] flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-[#0078D4] shrink-0" />
              <span>{lang === 'ar' ? 'غرفة الإرسال' : 'Priority Dispatch'}</span>
              <span className="text-[10px] px-1 py-0.2 border border-[#EDEBE9] dark:border-[#3b3a39] bg-[#FAF9F8] dark:bg-[#2d2c2c] text-[#242424] dark:text-[#f3f2f1] font-mono rounded">
                {dispatchRows.length}
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              {onOpenDeliveryManifest && (
                <button
                  type="button"
                  onClick={onOpenDeliveryManifest}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold bg-[#FFFFFF] dark:bg-[#252423] hover:bg-[#F3F2F1] dark:hover:bg-[#323130] text-[#0078D4] border border-[#0078D4] rounded-[4px] cursor-pointer transition-colors"
                  title={lang === 'ar' ? 'فتح كشف التوصيل اليومي والتذكير التسلسلي السريع' : 'Open Delivery & Dispatch Manifest'}
                >
                  <Truck className="w-3.5 h-3.5 text-[#0078D4]" />
                  <span>{lang === 'ar' ? 'طابور التوصيل والتذكير' : 'Delivery & Dispatch'}</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => onOpenPatientModal()}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold bg-[#0078D4] hover:bg-[#106EBE] text-white rounded-[4px] cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{lang === 'ar' ? 'إضافة' : 'Add'}</span>
              </button>
            </div>
          </div>

          {/* Compact Primary Dispatch Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto pb-0.5 text-xs w-full border-b border-[#EDEBE9] dark:border-[#3b3a39]">
            {/* Tab 1: Medication Refills */}
            <button
              type="button"
              onClick={() => setDispatchFilter('MEDS')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 font-semibold cursor-pointer whitespace-nowrap text-xs border-b-2 transition-colors ${
                dispatchFilter === 'MEDS'
                  ? 'border-[#0078D4] text-[#0078D4] bg-[#EFF6FC] dark:bg-[#112338]'
                  : 'border-transparent text-[#605E5C] dark:text-[#a19f9d] hover:text-[#242424] dark:hover:text-[#f3f2f1]'
              }`}
            >
              <Pill className="w-3.5 h-3.5" />
              <span>{lang === 'ar' ? 'الأدوية' : 'Meds'}</span>
              <span
                className={`px-1.5 py-0.2 font-mono text-[10px] font-semibold rounded ${
                  dispatchFilter === 'MEDS'
                    ? 'bg-[#0078D4] text-white'
                    : 'bg-[#EDEBE9] dark:bg-[#3b3a39] text-[#242424] dark:text-[#f3f2f1]'
                }`}
              >
                {dispatchRows.filter(r => r.hasDueMed).length}
              </span>
            </button>

            {/* Tab 2: Lab Retests Required */}
            <button
              type="button"
              onClick={() => setDispatchFilter('LABS')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 font-semibold cursor-pointer whitespace-nowrap text-xs border-b-2 transition-colors ${
                dispatchFilter === 'LABS'
                  ? 'border-[#0078D4] text-[#0078D4] bg-[#EFF6FC] dark:bg-[#112338]'
                  : 'border-transparent text-[#605E5C] dark:text-[#a19f9d] hover:text-[#242424] dark:hover:text-[#f3f2f1]'
              }`}
            >
              <Microscope className="w-3.5 h-3.5" />
              <span>{lang === 'ar' ? 'التحاليل' : 'Labs'}</span>
              <span
                className={`px-1.5 py-0.2 font-mono text-[10px] font-semibold rounded ${
                  dispatchFilter === 'LABS'
                    ? 'bg-[#0078D4] text-white'
                    : 'bg-[#EDEBE9] dark:bg-[#3b3a39] text-[#242424] dark:text-[#f3f2f1]'
                }`}
              >
                {dispatchRows.filter(r => r.hasDueLab).length}
              </span>
            </button>

            {/* Tab 3: Dual Care */}
            <button
              type="button"
              onClick={() => setDispatchFilter('DUAL')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 font-semibold cursor-pointer whitespace-nowrap text-xs border-b-2 transition-colors ${
                dispatchFilter === 'DUAL'
                  ? 'border-[#0078D4] text-[#0078D4] bg-[#EFF6FC] dark:bg-[#112338]'
                  : 'border-transparent text-[#605E5C] dark:text-[#a19f9d] hover:text-[#242424] dark:hover:text-[#f3f2f1]'
              }`}
            >
              <ArrowLeftRight className="w-3.5 h-3.5" />
              <span>{lang === 'ar' ? 'مشترك' : 'Dual'}</span>
              <span
                className={`px-1.5 py-0.2 font-mono text-[10px] font-semibold rounded ${
                  dispatchFilter === 'DUAL'
                    ? 'bg-[#0078D4] text-white'
                    : 'bg-[#EDEBE9] dark:bg-[#3b3a39] text-[#242424] dark:text-[#f3f2f1]'
                }`}
              >
                {dispatchRows.filter(r => r.hasDueMed && r.hasDueLab).length}
              </span>
            </button>

            {/* Tab 4: All Cases */}
            <button
              type="button"
              onClick={() => setDispatchFilter('ALL')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 font-semibold cursor-pointer whitespace-nowrap text-xs border-b-2 transition-colors ${
                dispatchFilter === 'ALL'
                  ? 'border-[#0078D4] text-[#0078D4] bg-[#EFF6FC] dark:bg-[#112338]'
                  : 'border-transparent text-[#605E5C] dark:text-[#a19f9d] hover:text-[#242424] dark:hover:text-[#f3f2f1]'
              }`}
            >
              <span>{lang === 'ar' ? 'الكل' : 'All'}</span>
              <span
                className={`px-1.5 py-0.2 font-mono text-[10px] font-semibold rounded ${
                  dispatchFilter === 'ALL'
                    ? 'bg-[#0078D4] text-white'
                    : 'bg-[#EDEBE9] dark:bg-[#3b3a39] text-[#242424] dark:text-[#f3f2f1]'
                }`}
              >
                {dispatchRows.length}
              </span>
            </button>

            {/* Tab 5: Dropouts */}
            <button
              type="button"
              onClick={() => setDispatchFilter('DROPOUTS')}
              className={`flex items-center gap-1 px-2.5 py-1.5 font-semibold cursor-pointer whitespace-nowrap text-xs border-b-2 transition-colors ${
                dispatchFilter === 'DROPOUTS'
                  ? 'border-[#A80000] text-[#A80000] bg-[#FDF3F3] dark:bg-[#3a1d1d]'
                  : 'border-transparent text-[#A80000] dark:text-[#f1707b]'
              }`}
            >
              <UserX className="w-3.5 h-3.5" />
              <span>{lang === 'ar' ? 'منقطعون' : 'Dropouts'}</span>
              <span
                className={`px-1.5 py-0.2 font-mono text-[10px] font-semibold rounded ${
                  dispatchFilter === 'DROPOUTS'
                    ? 'bg-[#A80000] text-white'
                    : 'bg-[#FDE7E9] dark:bg-[#4d2020] text-[#A80000]'
                }`}
              >
                {dispatchRows.filter(r => r.isDropout).length}
              </span>
            </button>
          </div>
        </div>

        {/* Compact Status Counter Bar */}
        <div className="px-3 py-1.5 bg-[#FAF9F8] dark:bg-[#2d2c2c] border-b border-[#EDEBE9] dark:border-[#3b3a39] flex items-center justify-between text-[11px] font-mono font-semibold text-[#605E5C] dark:text-[#a19f9d]">
          <span>
            {dispatchFilter === 'MEDS' && (lang === 'ar' ? 'صرف الأدوية + [مؤشر التحاليل 🔬]' : 'Medication Refills + [Lab Radar 🔬]')}
            {dispatchFilter === 'LABS' && (lang === 'ar' ? 'تحاليل الفحص + [مؤشر الأدوية 💊]' : 'Lab Retests + [Drug Status 💊]')}
            {dispatchFilter === 'DUAL' && (lang === 'ar' ? 'حالات مشتركة (دواء + تحليل معاً)' : 'Dual Care (Meds + Labs)')}
            {dispatchFilter === 'ALL' && (lang === 'ar' ? 'جميع حالات غرفة الإرسال' : 'All Dispatch Queue')}
            {dispatchFilter === 'DROPOUTS' && (lang === 'ar' ? 'المنقطعون (> 14 يوم)' : 'Therapy Dropouts (>14d)')}
          </span>
          <span>
            {visibleRows.length} {lang === 'ar' ? 'مريض' : 'records'}
          </span>
        </div>

        {/* High-Density DetailsList Table (Desktop) */}
        <div className="overflow-x-auto hidden md:block">
          <table className="w-full text-right dir-rtl text-xs border-collapse">
            <thead className="bg-[#FAF9F8] dark:bg-[#2d2c2c] text-[#605E5C] dark:text-[#a19f9d] font-semibold text-[11px] border-b border-[#EDEBE9] dark:border-[#3b3a39]">
              <tr>
                <th className="py-2.5 px-3.5">{lang === 'ar' ? 'المريض' : 'Patient'}</th>
                <th className="py-2.5 px-3">{lang === 'ar' ? 'العائلة' : 'Family'}</th>
                <th className="py-2.5 px-3">{lang === 'ar' ? 'الهاتف' : 'Phone'}</th>

                {/* Primary Column based on tab */}
                {dispatchFilter === 'MEDS' && (
                  <>
                    <th className="py-2.5 px-3.5 text-[#242424] dark:text-[#f3f2f1] font-semibold">
                      💊 {lang === 'ar' ? 'الأدوية المستحقة للصرف' : 'Due Medications'}
                    </th>
                    <th className="py-2.5 px-3.5 text-[#242424] dark:text-[#f3f2f1] font-semibold border-x border-[#EDEBE9] dark:border-[#3b3a39]">
                      🔬 {lang === 'ar' ? 'مؤشر التحاليل المخبرية (هل يحتاج إعادة فحص؟)' : 'Lab Retest Indicator'}
                    </th>
                  </>
                )}

                {dispatchFilter === 'LABS' && (
                  <>
                    <th className="py-2.5 px-3.5 text-[#242424] dark:text-[#f3f2f1] font-semibold">
                      🔬 {lang === 'ar' ? 'تحاليل إعادة الفحص المطلوبة' : 'Lab Retests Due'}
                    </th>
                    <th className="py-2.5 px-3.5 text-[#242424] dark:text-[#f3f2f1] font-semibold border-x border-[#EDEBE9] dark:border-[#3b3a39]">
                      💊 {lang === 'ar' ? 'مؤشر استحقاق صرف الدواء (هل علاجه مستحق؟)' : 'Drug Refill Indicator'}
                    </th>
                  </>
                )}

                {(dispatchFilter === 'DUAL' || dispatchFilter === 'ALL' || dispatchFilter === 'DROPOUTS') && (
                  <>
                    <th className="py-2.5 px-3.5 text-[#242424] dark:text-[#f3f2f1] font-semibold">
                      💊 {lang === 'ar' ? 'الأدوية المستحقة للصرف' : 'Due Medications'}
                    </th>
                    <th className="py-2.5 px-3.5 text-[#242424] dark:text-[#f3f2f1] font-semibold">
                      🔬 {lang === 'ar' ? 'تحاليل إعادة الفحص المطلوبة' : 'Lab Retests Due'}
                    </th>
                  </>
                )}

                <th className="py-2.5 px-3">{lang === 'ar' ? 'تاريخ الاستحقاق' : 'Next Due'}</th>
                <th className="py-2.5 px-3">{lang === 'ar' ? 'الالتزام (PDC)' : 'Adherence'}</th>
                <th className="py-2.5 px-3">{lang === 'ar' ? 'حالة التذكير' : 'Reminder Status'}</th>
                <th className="py-2.5 px-3.5 text-center">{lang === 'ar' ? 'الإجراءات السريعة' : 'Quick Actions'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EDEBE9] dark:divide-[#3b3a39] text-[#242424] dark:text-[#f3f2f1]">
              {activePatients.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-12 text-[#605E5C] dark:text-[#a19f9d]">
                    <div className="max-w-md mx-auto space-y-2">
                      <div className="font-semibold text-sm text-[#242424] dark:text-[#f3f2f1]">
                        {lang === 'ar' ? 'غرفة الإرسال فارغة حالياً' : 'Dispatch Hub is Empty'}
                      </div>
                      <p className="text-xs text-[#605E5C] dark:text-[#a19f9d] max-w-sm mx-auto">
                        {lang === 'ar'
                          ? 'لا توجد بيانات مرضى مسجلة حالياً بعد حذف الأمثلة التجريبية. قم بتسجيل المرضى لتفعيل جدول استحقاق الوصفات والمتابعة التلقائية.'
                          : 'No patient records currently registered. Register patients to activate refill schedules.'}
                      </p>
                      <button
                        onClick={() => onOpenPatientModal()}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-[#0078D4] text-white hover:bg-[#106EBE] rounded-[4px] cursor-pointer mt-2 transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>{lang === 'ar' ? 'تسجيل مريض جديد' : 'New Patient'}</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ) : visibleRows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-12 text-[#605E5C] dark:text-[#a19f9d]">
                    <div className="max-w-md mx-auto space-y-2">
                      <div className="text-2xl">
                        {dispatchFilter === 'MEDS' ? '💊' : dispatchFilter === 'LABS' ? '🔬' : dispatchFilter === 'DUAL' ? '🔄' : '📋'}
                      </div>
                      <div className="font-semibold text-sm text-[#242424] dark:text-[#f3f2f1]">
                        {dispatchFilter === 'MEDS' && (lang === 'ar' ? 'لا توجد أدوية مستحقة للصرف حالياً' : 'No medications due for refill')}
                        {dispatchFilter === 'LABS' && (lang === 'ar' ? 'لا توجد تحاليل دورية متأخرة أو مستحقة حالياً' : 'No periodic lab retests due')}
                        {dispatchFilter === 'DUAL' && (lang === 'ar' ? 'لا توجد حالات مشتركة (دواء + تحليل معاً) حالياً' : 'No dual refill & lab retest cases')}
                        {dispatchFilter === 'DROPOUTS' && (lang === 'ar' ? 'ممتاز! لا يوجد مرضى منقطعون عن العلاج' : 'Great! No therapy dropouts')}
                        {dispatchFilter === 'ALL' && (lang === 'ar' ? 'لا توجد حالات مستحقة مطابقة للبحث' : 'No records match this query')}
                      </div>
                      <p className="text-xs text-[#605E5C] dark:text-[#a19f9d]">
                        {lang === 'ar'
                          ? 'يمكنك التبديل بين التبويبات أعلاه لاستعراض الأدوية أو الفحوصات أو تسجيل مريض جديد.'
                          : 'Switch tabs above to inspect refills, labs, or register a new chronic patient.'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                visibleRows.map(row => {
                  const p = row.patient;
                  const todayYMD = formatYMD(new Date());
                  const sentDateYMD = p.lastReminderSent ? formatYMD(p.lastReminderSent) : null;
                  const isSentToday = sentDateYMD === todayYMD;

                  return (
                    <tr
                      key={p.id}
                      className="hover:bg-[#F3F2F1] dark:hover:bg-[#323130] transition-colors"
                    >
                      {/* Name */}
                      <td className="py-2.5 px-3.5 font-semibold text-[#242424] dark:text-[#f3f2f1]">
                        <button
                          onClick={() => onOpenPatientModal(p.id)}
                          className="hover:underline text-right cursor-pointer block font-semibold text-[#0078D4]"
                        >
                          {p.name}
                        </button>
                        {Boolean(p.age && p.age > 0) && (
                          <span className="text-[10px] text-[#605E5C] dark:text-[#a19f9d] font-normal">
                            {p.age} {lang === 'ar' ? 'سنة' : 'yrs'}
                          </span>
                        )}
                      </td>

                      {/* Family Tag */}
                      <td className="py-2.5 px-3">
                        {p.familyTag ? (
                          <button
                            onClick={() => onOpenHouseholdModal(p.familyTag!)}
                            title={lang === 'ar' ? 'انقر لتوحيد صرف أفراد العائلة معاً' : 'Sync family refills'}
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-semibold border border-[#EDEBE9] dark:border-[#3b3a39] text-[#0078D4] bg-[#FAF9F8] dark:bg-[#2d2c2c] rounded-[4px] cursor-pointer hover:bg-[#F3F2F1] dark:hover:bg-[#323130]"
                          >
                            <span>👨‍👩‍👧‍👦</span>
                            <span>{p.familyTag}</span>
                          </button>
                        ) : (
                          <span className="text-[#605E5C] dark:text-[#a19f9d]">—</span>
                        )}
                      </td>

                      {/* Phone */}
                      <td className="py-2.5 px-3 font-mono text-[#242424] dark:text-[#f3f2f1] text-[11px]">
                        {p.phone}
                      </td>

                      {/* ======================================================== */}
                      {/* CASE 1: IN MEDS TAB */}
                      {/* ======================================================== */}
                      {dispatchFilter === 'MEDS' && (
                        <>
                          {/* Col 4: Due Medications */}
                          <td className="py-2.5 px-3.5">
                            {row.dueMeds.length === 0 ? (
                              <span className="text-[#605E5C] text-xs">
                                {lang === 'ar' ? 'لا توجد أدوية مستحقة اليوم' : 'No meds due'}
                              </span>
                            ) : (
                              <div className="space-y-1">
                                {row.dueMeds.map((dm, idx) => {
                                  const isOverdue = dm.daysRemaining < 0;
                                  return (
                                    <div key={idx} className="flex items-center gap-1.5 flex-wrap">
                                      <span className="font-semibold text-[#242424]">
                                        • {dm.name}
                                      </span>
                                      {isOverdue ? (
                                        <span className="text-[10px] font-semibold font-mono px-1.5 py-0.2 border border-[#E0A8A8] text-[#A80000] bg-[#FDF3F3] rounded-[4px]">
                                          {lang === 'ar' ? `متأخر ${Math.abs(dm.daysRemaining)} يوم` : `${Math.abs(dm.daysRemaining)}d overdue`}
                                        </span>
                                      ) : (
                                        <span className="text-[10px] font-semibold font-mono px-1.5 py-0.2 border border-[#EDEBE9] text-[#242424] bg-white rounded-[4px]">
                                          {lang === 'ar' ? `مستحق بعد ${dm.daysRemaining} يوم` : `due in ${dm.daysRemaining}d`}
                                        </span>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </td>

                          {/* Col 5: Lab Retest Indicator */}
                          <td className="py-2.5 px-3.5 border-x border-[#EDEBE9]">
                            {row.hasDueLab ? (
                              <div className="p-2 border border-[#E0A8A8] bg-[#FDF3F3] text-xs space-y-1 rounded-[4px]">
                                <div className="flex items-center justify-between gap-1 flex-wrap">
                                  <span className="font-semibold text-[#A80000] flex items-center gap-1">
                                    <Microscope className="w-3.5 h-3.5 text-[#A80000] shrink-0" />
                                    <span>{row.labRetestStatus.primaryTestName}</span>
                                  </span>
                                  <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 border border-[#E0A8A8] text-[#A80000] bg-white rounded-[4px] whitespace-nowrap">
                                    {row.dueLabs[0]?.daysOverdue > 0
                                      ? (lang === 'ar' ? `متأخر (+${row.dueLabs[0].daysOverdue} يوم)` : `+${row.dueLabs[0].daysOverdue}d overdue`)
                                      : (lang === 'ar' ? 'مستحق قريباً' : 'Due soon')}
                                  </span>
                                </div>
                                <div className="text-[10px] text-[#605E5C] flex items-center justify-between">
                                  <span>{row.dueLabs[0]?.fastingNoteAr || (row.dueLabs[0]?.requiresFasting ? 'صيامي 10-12 ساعة' : 'لا يشترط صيام')}</span>
                                  {row.dueLabs[0]?.lastRecordedValue && (
                                    <span className="font-mono text-[#242424] font-semibold">
                                      السابق: {row.dueLabs[0].lastRecordedValue}
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-1.5 pt-1 border-t border-[#E0A8A8]/60">
                                  <button
                                    type="button"
                                    onClick={() => handleSendLabWhatsApp(row)}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold border border-[#EDEBE9] bg-white text-[#242424] hover:bg-[#F3F2F1] rounded-[4px] cursor-pointer"
                                    title={lang === 'ar' ? 'إرسال تذكير واتساب خاص بموعد إعادة التحليل وشروط الصيام' : 'WhatsApp lab test'}
                                  >
                                    <MessageSquare className="w-2.5 h-2.5 text-[#0078D4]" />
                                    <span>{lang === 'ar' ? 'تنبيه الفحص' : 'Lab Alert'}</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => onOpenPatientModal(p.id, 'vitals')}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold border border-[#EDEBE9] bg-white text-[#242424] hover:bg-[#F3F2F1] rounded-[4px] cursor-pointer"
                                    title={lang === 'ar' ? 'تسجيل نتيجة التحليل في الملف السريري' : 'Record result'}
                                  >
                                    <Plus className="w-2.5 h-2.5" />
                                    <span>{lang === 'ar' ? 'تسجيل النتيجة' : 'Log Lab'}</span>
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="inline-flex items-center gap-1.5 px-2 py-1 border border-[#EDEBE9] bg-[#FAF9F8] text-[#242424] text-xs font-semibold rounded-[4px]">
                                <CheckCircle2 className="w-3.5 h-3.5 text-[#107C41] shrink-0" />
                                <div>
                                  <div>{lang === 'ar' ? 'التحاليل الدورية محدثة' : 'Labs Up-to-date'}</div>
                                </div>
                              </div>
                            )}
                          </td>
                        </>
                      )}

                      {/* ======================================================== */}
                      {/* CASE 2: IN LABS TAB */}
                      {/* ======================================================== */}
                      {dispatchFilter === 'LABS' && (
                        <>
                          {/* Col 4: Required Lab Retests */}
                          <td className="py-2.5 px-3.5">
                            {row.dueLabs && row.dueLabs.length > 0 ? (
                              <div className="space-y-1.5">
                                {row.dueLabs.map((lab, lIdx) => (
                                  <div
                                    key={lIdx}
                                    className={`p-2 border text-xs rounded-[4px] ${
                                      lab.status === 'overdue'
                                        ? 'border-[#E0A8A8] bg-[#FDF3F3] text-[#A80000]'
                                        : 'border-[#EDEBE9] bg-white text-[#242424]'
                                    }`}
                                  >
                                    <div className="flex items-center justify-between gap-1.5 flex-wrap">
                                      <span className="font-semibold flex items-center gap-1">
                                        <Microscope className="w-3.5 h-3.5 shrink-0" />
                                        <span>{lab.testNameAr}</span>
                                      </span>
                                      <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 border rounded-[4px] whitespace-nowrap bg-white">
                                        {lab.status === 'overdue'
                                          ? lang === 'ar'
                                            ? `متأخر (+${lab.daysOverdue} يوم)`
                                            : `Overdue (+${lab.daysOverdue}d)`
                                          : lang === 'ar'
                                          ? 'مستحق قريباً'
                                          : 'Due Soon'}
                                      </span>
                                    </div>

                                    <div className="flex items-center justify-between text-[10px] text-[#605E5C] pt-1 mt-1 border-t border-[#EDEBE9]">
                                      <span>{lab.fastingNoteAr || (lab.requiresFasting ? 'صيامي 10-12 ساعة' : 'لا يشترط صيام')}</span>
                                      {lab.lastRecordedValue && (
                                        <span className="font-mono text-[#242424] font-semibold">
                                          السابق: {lab.lastRecordedValue}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <span className="text-[#605E5C] text-xs">—</span>
                            )}
                          </td>

                          {/* Col 5: Drug Refill Indicator */}
                          <td className="py-2.5 px-3.5 border-x border-[#EDEBE9]">
                            {row.medRefillStatus.type === 'overdue' && (
                              <div className="p-2 border border-[#E0A8A8] bg-[#FDF3F3] text-xs space-y-1 rounded-[4px]">
                                <div className="flex items-center justify-between gap-1 flex-wrap">
                                  <span className="font-semibold text-[#A80000] flex items-center gap-1">
                                    <AlertCircle className="w-3.5 h-3.5 text-[#A80000] shrink-0" />
                                    <span>{lang === 'ar' ? 'متأخر عن صرف الدواء' : 'Refill Overdue'}</span>
                                  </span>
                                  <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 border border-[#E0A8A8] text-[#A80000] bg-white rounded-[4px]">
                                    {Math.abs(row.medRefillStatus.minDaysRemaining)} {lang === 'ar' ? 'يوم تأخير' : 'd late'}
                                  </span>
                                </div>
                                <div className="text-xs text-[#242424] font-semibold">
                                  • {row.medRefillStatus.closestMedName}
                                </div>
                                <div className="pt-1 border-t border-[#E0A8A8]/60">
                                  <button
                                    type="button"
                                    onClick={() => onOpenRefillModal(p.id)}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold bg-[#0078D4] hover:bg-[#106EBE] text-white rounded-[4px] cursor-pointer"
                                    title={lang === 'ar' ? 'صرف الدواء المتأخر فوراً' : 'Refill now'}
                                  >
                                    <Zap className="w-2.5 h-2.5" />
                                    <span>{lang === 'ar' ? 'صرف الدواء الآن' : 'Refill Med Now'}</span>
                                  </button>
                                </div>
                              </div>
                            )}

                            {row.medRefillStatus.type === 'due_now' && (
                              <div className="p-2 border border-[#EDEBE9] bg-[#FAF9F8] text-xs space-y-1 rounded-[4px]">
                                <div className="flex items-center justify-between gap-1 flex-wrap">
                                  <span className="font-semibold text-[#242424] flex items-center gap-1">
                                    <Clock className="w-3.5 h-3.5 text-[#0078D4] shrink-0" />
                                    <span>{lang === 'ar' ? 'مستحق الصرف اليوم' : 'Due Today'}</span>
                                  </span>
                                  <span className="text-[9px] font-semibold px-1.5 py-0.5 border border-[#EDEBE9] bg-white rounded-[4px]">
                                    {lang === 'ar' ? 'اليوم' : 'Today'}
                                  </span>
                                </div>
                                <div className="text-xs text-[#242424] font-semibold">
                                  • {row.medRefillStatus.closestMedName}
                                </div>
                                <div className="pt-1 border-t border-[#EDEBE9]">
                                  <button
                                    type="button"
                                    onClick={() => onOpenRefillModal(p.id)}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold bg-[#0078D4] hover:bg-[#106EBE] text-white rounded-[4px] cursor-pointer"
                                    title={lang === 'ar' ? 'تكرار صرف الوصفة المستحقة' : 'Refill due meds'}
                                  >
                                    <Zap className="w-2.5 h-2.5" />
                                    <span>{lang === 'ar' ? 'تكرار الصرف' : 'Refill'}</span>
                                  </button>
                                </div>
                              </div>
                            )}

                            {row.medRefillStatus.type === 'due_soon' && (
                              <div className="p-2 border border-[#EDEBE9] bg-white text-xs space-y-1 rounded-[4px]">
                                <div className="flex items-center justify-between gap-1 flex-wrap">
                                  <span className="font-semibold text-[#242424] flex items-center gap-1">
                                    <Clock className="w-3.5 h-3.5 text-[#605E5C] shrink-0" />
                                    <span>{lang === 'ar' ? 'مستحق الصرف قريباً' : 'Due Soon'}</span>
                                  </span>
                                  <span className="text-[9px] font-mono font-semibold px-1.5 py-0.5 border border-[#EDEBE9] bg-[#FAF9F8] rounded-[4px]">
                                    {row.medRefillStatus.minDaysRemaining} {lang === 'ar' ? 'أيام متبقية' : 'd left'}
                                  </span>
                                </div>
                                <div className="text-xs text-[#242424]">
                                  • {row.medRefillStatus.closestMedName}
                                </div>
                              </div>
                            )}

                            {row.medRefillStatus.type === 'stocked' && (
                              <div className="p-2 border border-[#EDEBE9] bg-white text-xs space-y-1 rounded-[4px]">
                                <div className="flex items-center gap-1.5 font-semibold text-[#242424]">
                                  <CheckCircle2 className="w-3.5 h-3.5 text-[#107C41] shrink-0" />
                                  <span>{lang === 'ar' ? 'الدواء متوفر ومستقر' : 'Medication Stocked'}</span>
                                </div>
                                <div className="text-[10px] text-[#605E5C]">
                                  {lang === 'ar'
                                    ? `متبقي ${row.medRefillStatus.minDaysRemaining} يوماً لـ ${row.medRefillStatus.closestMedName}`
                                    : `${row.medRefillStatus.minDaysRemaining}d remaining for ${row.medRefillStatus.closestMedName}`}
                                </div>
                              </div>
                            )}

                            {row.medRefillStatus.type === 'no_meds' && (
                              <span className="text-[#605E5C] text-xs">— {lang === 'ar' ? 'لا توجد أدوية مسجلة' : 'No meds'}</span>
                            )}
                          </td>
                        </>
                      )}

                      {/* ======================================================== */}
                      {/* CASE 3: IN DUAL, ALL, OR DROPOUTS TAB */}
                      {/* ======================================================== */}
                      {(dispatchFilter === 'DUAL' || dispatchFilter === 'ALL' || dispatchFilter === 'DROPOUTS') && (
                        <>
                          {/* Col 4: Due Medications */}
                          <td className="py-2.5 px-3.5">
                            {row.dueMeds.length === 0 ? (
                              <div className="text-xs text-[#605E5C]">
                                {row.medRefillStatus.type === 'stocked' ? (
                                  <span className="text-[#242424] font-semibold">
                                    {lang === 'ar'
                                      ? `متوفر (متبقي ${row.medRefillStatus.minDaysRemaining} يوم لـ ${row.medRefillStatus.closestMedName})`
                                      : `Stocked (${row.medRefillStatus.minDaysRemaining}d left)`}
                                  </span>
                                ) : (
                                  <span>{lang === 'ar' ? 'لا توجد أدوية مستحقة اليوم' : 'No meds due'}</span>
                                )}
                              </div>
                            ) : (
                              <div className="space-y-1">
                                {row.dueMeds.map((dm, idx) => {
                                  const isOverdue = dm.daysRemaining < 0;
                                  return (
                                    <div key={idx} className="flex items-center gap-1.5 flex-wrap">
                                      <span className="font-semibold text-[#242424]">
                                        • {dm.name}
                                      </span>
                                      {isOverdue ? (
                                        <span className="text-[10px] font-mono font-semibold px-1.5 py-0.2 border border-[#E0A8A8] text-[#A80000] bg-[#FDF3F3] rounded-[4px]">
                                          {lang === 'ar' ? `متأخر ${Math.abs(dm.daysRemaining)} يوم` : `${Math.abs(dm.daysRemaining)}d overdue`}
                                        </span>
                                      ) : (
                                        <span className="text-[10px] font-mono font-semibold px-1.5 py-0.2 border border-[#EDEBE9] text-[#242424] bg-white rounded-[4px]">
                                          {lang === 'ar' ? `مستحق بعد ${dm.daysRemaining} يوم` : `due in ${dm.daysRemaining}d`}
                                        </span>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </td>

                          {/* Col 5: Lab Retests */}
                          <td className="py-2.5 px-3.5">
                            {row.dueLabs && row.dueLabs.length > 0 ? (
                              <div className="space-y-1.5">
                                {row.dueLabs.map((lab, lIdx) => (
                                  <div
                                    key={lIdx}
                                    className={`p-1.5 border text-xs rounded-[4px] ${
                                      lab.status === 'overdue'
                                        ? 'border-[#E0A8A8] bg-[#FDF3F3] text-[#A80000]'
                                        : 'border-[#EDEBE9] bg-white text-[#242424]'
                                    }`}
                                  >
                                    <div className="flex items-center justify-between gap-1 flex-wrap">
                                      <span className="font-semibold flex items-center gap-1">
                                        <Microscope className="w-3.5 h-3.5 shrink-0" />
                                        <span>{lab.testNameAr}</span>
                                      </span>
                                      <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 border rounded-[4px] whitespace-nowrap bg-white">
                                        {lab.status === 'overdue'
                                          ? lang === 'ar'
                                            ? `+${lab.daysOverdue} يوم`
                                            : `+${lab.daysOverdue}d`
                                          : lang === 'ar'
                                          ? 'قريباً'
                                          : 'Soon'}
                                      </span>
                                    </div>
                                    <div className="text-[10px] text-[#605E5C] pt-0.5">
                                      {lab.fastingNoteAr || (lab.requiresFasting ? 'صيامي 10-12 ساعة' : 'لا يشترط صيام')}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <span className="text-[#242424] text-xs font-semibold flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3 text-[#107C41]" />
                                <span>{lang === 'ar' ? 'التحاليل محدثة' : 'Labs OK'}</span>
                              </span>
                            )}
                          </td>
                        </>
                      )}

                      {/* Next Due Date */}
                      <td className="py-2.5 px-3 font-mono text-xs font-semibold text-[#242424]">
                        {formatYMD(row.earliestDueDate)}
                      </td>

                      {/* PDC Adherence */}
                      <td className="py-2.5 px-3">
                        <span
                          className={`inline-block font-mono font-bold px-1.5 py-0.2 border rounded-[4px] text-xs ${
                            row.pdc < 80
                              ? 'border-[#E0A8A8] text-[#A80000] bg-[#FDF3F3]'
                              : 'border-[#EDEBE9] text-[#242424] bg-white'
                          }`}
                        >
                          {row.pdc}%
                        </span>
                      </td>

                      {/* Reminder status badge */}
                      <td className="py-2.5 px-3">
                        {isSentToday ? (
                          <div className="flex flex-col gap-0.5">
                            <span className="inline-flex items-center gap-1 text-xs font-semibold px-1.5 py-0.2 border border-[#EDEBE9] bg-[#FAF9F8] text-[#242424] rounded-[4px]">
                              <CheckCircle2 className="w-3 h-3 text-[#107C41]" />
                              <span>{lang === 'ar' ? 'تم التذكير اليوم' : 'Sent Today'}</span>
                            </span>
                            <span className="text-[10px] font-mono text-[#605E5C]">
                              {new Date(p.lastReminderSent!).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>
                        ) : row.isDropout ? (
                          <span className="inline-block text-xs font-semibold px-2 py-0.5 border border-[#E0A8A8] bg-[#FDF3F3] text-[#A80000] rounded-[4px]">
                            {lang === 'ar' ? 'منقطع (>14 يوم)' : 'Dropout'}
                          </span>
                        ) : (
                          <span className="inline-block text-xs font-semibold px-2 py-0.5 border border-[#EDEBE9] bg-[#FAF9F8] text-[#242424] rounded-[4px]">
                            {lang === 'ar' ? 'مستحق التكرار' : 'Due Now'}
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-2.5 px-3.5">
                        <div className="flex items-center justify-center gap-1.5 flex-wrap">
                          {/* WhatsApp Refill + Lab Combined */}
                          <button
                            onClick={() => handleSendWhatsApp(row)}
                            title={
                              row.dueLabs.length > 0 && row.dueMeds.length > 0
                                ? (lang === 'ar' ? 'إرسال تذكير واتساب مدمج للأدوية المستحقة وإعادة الفحص المخبري معاً' : 'Send Refill & Lab WhatsApp')
                                : row.dueLabs.length > 0
                                ? (lang === 'ar' ? 'إرسال تذكير واتساب لإعادة الفحص المخبري' : 'Send Lab Reminder')
                                : (lang === 'ar' ? 'إرسال تذكير مخصص عبر WhatsApp للأدوية المستحقة' : 'Send WhatsApp Reminder')
                            }
                            className="p-1.5 border border-[#EDEBE9] text-[#242424] bg-white hover:bg-[#F3F2F1] transition-colors cursor-pointer rounded-[4px]"
                          >
                            <MessageSquare className="w-3.5 h-3.5 text-[#0078D4]" />
                          </button>

                          {/* Dedicated WhatsApp Lab Reminder */}
                          {row.dueLabs.length > 0 && (
                            <button
                              type="button"
                              onClick={() => handleSendLabWhatsApp(row)}
                              title={lang === 'ar' ? 'إرسال تذكير واتساب خاص بموعد إعادة التحليل وشروط الصيام' : 'Send Dedicated Lab Retest WhatsApp'}
                              className="p-1.5 border border-[#EDEBE9] text-[#242424] bg-white hover:bg-[#F3F2F1] transition-colors cursor-pointer rounded-[4px]"
                            >
                              <Microscope className="w-3.5 h-3.5 text-[#0078D4]" />
                            </button>
                          )}

                          {/* Refill Button (Fluent UI Primary Button Style) */}
                          {(row.dueMeds.length > 0 || row.medRefillStatus.type === 'overdue' || row.medRefillStatus.type === 'due_now') && (
                            <button
                              onClick={() => onOpenRefillModal(p.id)}
                              className="flex items-center gap-1 px-2.5 py-1.5 bg-[#0078D4] hover:bg-[#106EBE] active:bg-[#005A9E] text-white font-semibold text-xs transition-colors cursor-pointer rounded-[4px]"
                              title={lang === 'ar' ? 'تكرار صرف الأدوية المحددة وحفظ النمط' : 'Refill Medications'}
                            >
                              <Zap className="w-3 h-3" />
                              <span>{lang === 'ar' ? 'صرف' : 'Refill'}</span>
                            </button>
                          )}

                          {/* Record Lab Result */}
                          {row.dueLabs.length > 0 && (
                            <button
                              type="button"
                              onClick={() => onOpenPatientModal(p.id, 'vitals')}
                              title={lang === 'ar' ? 'تسجيل نتيجة التحليل المخبري في ملف المريض' : 'Record Lab Result in Dossier'}
                              className="p-1.5 border border-[#EDEBE9] text-[#242424] bg-white hover:bg-[#F3F2F1] transition-colors cursor-pointer rounded-[4px]"
                            >
                              <Plus className="w-3.5 h-3.5 text-[#0078D4]" />
                            </button>
                          )}

                          {/* SMS */}
                          <button
                            onClick={() => handleSendSMS(row)}
                            title={lang === 'ar' ? 'إرسال رسالة SMS نصية' : 'Send SMS'}
                            className="p-1.5 border border-[#EDEBE9] hover:bg-[#F3F2F1] text-[#242424] bg-white transition-colors cursor-pointer rounded-[4px]"
                          >
                            <Send className="w-3.5 h-3.5 text-[#605E5C]" />
                          </button>

                          {/* Dossier */}
                          <button
                            onClick={() => onOpenPatientModal(p.id)}
                            className="p-1.5 border border-[#EDEBE9] hover:bg-[#F3F2F1] text-[#242424] bg-white transition-colors cursor-pointer rounded-[4px]"
                            title={lang === 'ar' ? 'فتح الملف السريري الكامل' : 'Open Dossier'}
                          >
                            <FileText className="w-3.5 h-3.5 text-[#605E5C]" />
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

        {/* Mobile View: Fixed Ultra-Compact Stacked Dispatch Cards (Zero Horizontal Swiping) */}
        <div className="block md:hidden divide-y divide-[#EDEBE9] dark:divide-[#3b3a39]">
          {visibleRows.length === 0 ? (
            <div className="p-6 text-center text-xs text-[#605E5C] dark:text-[#a19f9d]">
              {lang === 'ar' ? 'لا توجد مهام مستحقة حالياً' : 'No due tasks'}
            </div>
          ) : (
            visibleRows.map(row => {
              const p = row.patient;
              const hasAllergies = Boolean(p.allergiesStatus === 'recorded' || (p.allergies && p.allergies.trim().length > 0));
              const isNKDA = p.allergiesStatus === 'nkda' || (p.allergies && (p.allergies.toLowerCase().includes('nkda') || p.allergies.includes('لا يوجد')));

              return (
                <div key={p.id} className="p-2.5 bg-white dark:bg-[#201f1e] space-y-1.5 border-b border-[#EDEBE9] dark:border-[#3b3a39]">
                  {/* Card Top Row: Name, ID, Phone, Age/Gender & Urgency Badge */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <button
                          onClick={() => onOpenPatientModal(p.id)}
                          className="text-xs font-bold text-[#0078D4] dark:text-[#2899F5] hover:underline text-right block truncate"
                        >
                          {p.name}
                        </button>
                        <span className="font-mono text-[10px] text-[#605E5C] dark:text-[#a19f9d]">{p.id}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[10px] text-[#605E5C] dark:text-[#a19f9d] mt-0.5">
                        {p.phoneUnavailable ? (
                          <span className="text-[10px] text-[#A80000] font-semibold">{lang === 'ar' ? 'بدون هاتف' : 'No phone'}</span>
                        ) : (
                          <span dir="ltr" className="font-mono text-[10px]">{p.phone}</span>
                        )}
                        <span>•</span>
                        <span>{p.age ? `${p.age}y` : '—'} / {p.gender || '—'}</span>
                      </div>
                    </div>

                    {/* Urgency Badge */}
                    <span
                      className={`text-[10px] font-semibold px-1.5 py-0.2 rounded border whitespace-nowrap shrink-0 ${
                        row.isDropout
                          ? 'bg-red-50 text-[#A80000] border-red-200'
                          : row.dueMeds.some(m => m.daysRemaining <= 0)
                          ? 'bg-amber-50 text-amber-800 border-amber-200'
                          : 'bg-blue-50 text-[#0078D4] border-blue-200'
                      }`}
                    >
                      {row.isDropout ? (lang === 'ar' ? 'منقطع' : 'Dropout') : row.dueMeds.some(m => m.daysRemaining <= 0) ? (lang === 'ar' ? 'متأخر' : 'Overdue') : (lang === 'ar' ? 'مستحق' : 'Due')}
                    </span>
                  </div>

                  {/* Badges Row: Allergy Notice, PDC Adherence, Family Tag, Med Count, Loyalty Points */}
                  <div className="flex flex-wrap items-center gap-1 text-[10px]">
                    {hasAllergies ? (
                      <span className="inline-flex items-center text-[9px] font-bold px-1.5 py-0.2 rounded bg-red-50 dark:bg-red-950/60 text-[#A80000] dark:text-red-300 border border-red-200 dark:border-red-800">
                        <AlertCircle className="w-2.5 h-2.5 mr-0.5 shrink-0" />
                        <span>{lang === 'ar' ? 'حساسية:' : 'Allergy:'} {p.allergies}</span>
                      </span>
                    ) : isNKDA ? (
                      <span className="inline-flex items-center text-[9px] font-semibold px-1.5 py-0.2 rounded bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                        <CheckCircle2 className="w-2.5 h-2.5 mr-0.5 shrink-0" />
                        <span>NKDA</span>
                      </span>
                    ) : null}

                    <span className={`font-mono text-[9px] font-semibold px-1.5 py-0.2 rounded border ${
                      row.pdc >= 80 ? 'bg-[#EFF6FC] dark:bg-[#112338] text-[#0078D4] border-[#C7E0F4]' : 'bg-[#FDF3F3] dark:bg-[#3a1d1d] text-[#A80000] border-[#E0A8A8]'
                    }`}>
                      PDC: {row.pdc}%
                    </span>

                    {p.familyTag && (
                      <button
                        onClick={() => onOpenHouseholdModal(p.familyTag!)}
                        className="px-1.5 py-0.2 text-[9px] font-semibold bg-[#EFF6FC] dark:bg-[#112338] text-[#0078D4] border border-[#C7E0F4] dark:border-[#1e4a6f] rounded cursor-pointer"
                      >
                        👨‍👩‍👧‍👦 {p.familyTag}
                      </button>
                    )}

                    <span className="text-[#605E5C] dark:text-[#a19f9d] text-[9px] font-semibold">
                      {(p.medications || []).length} {lang === 'ar' ? 'أدوية' : 'meds'}
                    </span>

                    <span className="inline-flex items-center gap-0.5 font-mono text-[#242424] dark:text-[#f3f2f1] bg-[#FAF9F8] dark:bg-[#2d2c2c] border border-[#EDEBE9] dark:border-[#3b3a39] px-1 py-0.2 rounded text-[9px]">
                      <Star className="w-2.5 h-2.5 text-[#0078D4]" />
                      <span>{p.loyaltyPoints || 0}</span>
                    </span>
                  </div>

                  {/* Due Medications List */}
                  {row.dueMeds.length > 0 && (
                    <div className="text-[11px] text-[#242424] dark:text-[#f3f2f1] bg-[#FAF9F8] dark:bg-[#11100F] p-1.5 rounded border border-[#EDEBE9] dark:border-[#3b3a39]">
                      <div className="space-y-0.5" dir="ltr">
                        {row.dueMeds.map((m, idx) => (
                          <div key={idx} className="font-mono text-[11px] truncate flex items-center justify-between">
                            <span>• {m.name}</span>
                            <span className={`text-[9px] font-semibold px-1 py-0.2 rounded ${m.daysRemaining <= 0 ? 'text-[#A80000] bg-red-50' : 'text-[#605E5C]'}`}>
                              {m.daysRemaining <= 0 ? `Late +${Math.abs(m.daysRemaining)}d` : `${m.daysRemaining}d left`}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Due Lab Retest Indicator */}
                  {row.hasDueLab && row.dueLabs[0] && (
                    <div className="p-1.5 bg-[#FDF3F3] dark:bg-[#3a1d1d] border border-[#E0A8A8] dark:border-[#6e3535] text-[10px] text-[#A80000] dark:text-red-300 rounded flex items-center justify-between">
                      <span className="font-semibold flex items-center gap-1">
                        <Microscope className="w-3 h-3 shrink-0 text-[#A80000]" />
                        <span>{row.dueLabs[0].testNameAr}</span>
                      </span>
                      <span className="font-mono text-[9px] font-bold">
                        {row.dueLabs[0].daysOverdue > 0 ? `+${row.dueLabs[0].daysOverdue}d overdue` : 'Due soon'}
                      </span>
                    </div>
                  )}

                  {/* Touch-First Primary & Secondary Actions Toolbar */}
                  <div className="pt-1 flex items-center justify-between gap-1.5">
                    {(row.dueMeds.length > 0 || row.medRefillStatus.type === 'overdue' || row.medRefillStatus.type === 'due_now') && (
                      <button
                        onClick={() => onOpenRefillModal(p.id)}
                        className="min-h-[44px] flex-1 px-3 py-1.5 bg-[#0078D4] hover:bg-[#106EBE] active:bg-[#005A9E] text-white text-xs font-bold rounded flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <Zap className="w-3.5 h-3.5 text-white" />
                        <span>{lang === 'ar' ? 'صرف الدواء' : 'Refill Med'}</span>
                      </button>
                    )}

                    <button
                      onClick={() => handleSendWhatsApp(row)}
                      className="min-h-[44px] min-w-[44px] px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded flex items-center justify-center cursor-pointer"
                      title={lang === 'ar' ? 'محادثة واتساب' : 'WhatsApp'}
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                    </button>

                    {row.hasDueLab && (
                      <button
                        type="button"
                        onClick={() => handleSendLabWhatsApp(row)}
                        className="min-h-[44px] min-w-[44px] px-2.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded flex items-center justify-center cursor-pointer"
                        title={lang === 'ar' ? 'واتساب الفحص' : 'Lab WhatsApp'}
                      >
                        <Microscope className="w-3.5 h-3.5" />
                      </button>
                    )}

                    <button
                      onClick={() => handleSendSMS(row)}
                      className="min-h-[44px] min-w-[44px] px-2.5 py-1.5 border border-[#EDEBE9] dark:border-[#3b3a39] bg-white dark:bg-[#252423] text-[#605E5C] dark:text-[#a19f9d] rounded flex items-center justify-center cursor-pointer"
                      title={lang === 'ar' ? 'إرسال SMS' : 'SMS'}
                    >
                      <Send className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => onOpenPatientModal(p.id)}
                      className="min-h-[44px] min-w-[44px] px-2.5 py-1.5 border border-[#EDEBE9] dark:border-[#3b3a39] bg-white dark:bg-[#252423] text-[#0078D4] dark:text-[#2899F5] rounded flex items-center justify-center cursor-pointer"
                      title={lang === 'ar' ? 'فتح الملف السريري' : 'Dossier'}
                    >
                      <FileText className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
