import React, { useState, useMemo, useRef } from 'react';
import * as XLSX from 'xlsx';
import {
  X,
  Truck,
  Printer,
  FileSpreadsheet,
  MessageSquare,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Clock,
  Send,
  UserCheck,
  Search,
  Filter,
  DollarSign,
  MapPin,
  AlertCircle,
  Play,
  RotateCcw,
} from 'lucide-react';
import { Patient, Medication } from '../../types/pharmacy';
import {
  formatYMD,
  formatPhoneForWhatsApp,
  calculateDaysRemaining,
} from '../../utils/pharmacyCalculations';

interface DeliveryManifestModalProps {
  isOpen: boolean;
  onClose: () => void;
  patients: Patient[];
  pharmacyName: string;
  waTemplate: string;
  onUpdatePatient: (patient: Patient) => void;
  onShowToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  lang: 'ar' | 'en';
}

interface ManifestItem {
  patient: Patient;
  dueMeds: { name: string; daysRemaining: number }[];
  address: string;
  cashToCollect: string;
  deliveryStatus: 'ready' | 'out_for_delivery' | 'delivered' | 'cancelled';
  isSelected: boolean;
}

export const DeliveryManifestModal: React.FC<DeliveryManifestModalProps> = ({
  isOpen,
  onClose,
  patients,
  pharmacyName,
  waTemplate,
  onUpdatePatient,
  onShowToast,
  lang,
}) => {
  const [activeTab, setActiveTab] = useState<'manifest' | 'sequential'>('manifest');
  const [courierName, setCourierName] = useState('');
  const [zoneFilter, setZoneFilter] = useState('ALL');
  const [searchFilter, setSearchFilter] = useState('');
  const [items, setItems] = useState<ManifestItem[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);

  // Sequential Dispatch State
  const [currentIndex, setCurrentIndex] = useState(0);
  const printRef = useRef<HTMLDivElement>(null);

  // Initialize due refill items
  useMemo(() => {
    if (!isOpen) {
      setIsInitialized(false);
      return;
    }

    const active = patients.filter(p => !p.isArchived);
    const dueList: ManifestItem[] = [];

    active.forEach(p => {
      const dueMeds: { name: string; daysRemaining: number }[] = [];
      const allMeds = p.medications || [];

      for (const m of allMeds) {
        const remaining = calculateDaysRemaining(m.lastDispenseDate, m.daysSupply);
        // Patients due now or overdue within last 14 days
        if (remaining <= 3 && remaining >= -14) {
          dueMeds.push({ name: m.name, daysRemaining: remaining });
        }
      }

      if (dueMeds.length > 0) {
        // Extract address if mentioned in notes or default
        const note = p.notes || '';
        let address = '';
        if (note.includes('بغداد') || note.includes('حي') || note.includes('شارع') || note.includes('محلة')) {
          address = note.split('-')[0].trim();
        } else if (p.familyTag) {
          address = `عائلة: ${p.familyTag}`;
        } else {
          address = lang === 'ar' ? 'العنوان مسجل بالملف' : 'On file';
        }

        dueList.push({
          patient: p,
          dueMeds,
          address,
          cashToCollect: '0',
          deliveryStatus: 'ready',
          isSelected: true,
        });
      }
    });

    setItems(dueList);
    setIsInitialized(true);
    setCurrentIndex(0);
  }, [isOpen, patients]);

  if (!isOpen) return null;

  // Filtered Items
  const filteredItems = items.filter(item => {
    if (searchFilter) {
      const q = searchFilter.toLowerCase();
      const matchName = item.patient.name.toLowerCase().includes(q);
      const matchPhone = item.patient.phone.includes(q);
      const matchAddress = item.address.toLowerCase().includes(q);
      const matchMeds = item.dueMeds.some(m => m.name.toLowerCase().includes(q));
      if (!matchName && !matchPhone && !matchAddress && !matchMeds) return false;
    }
    return true;
  });

  const selectedItems = items.filter(i => i.isSelected);

  const toggleSelectAll = (checked: boolean) => {
    setItems(prev => prev.map(item => ({ ...item, isSelected: checked })));
  };

  const toggleItemSelect = (patientId: string) => {
    setItems(prev =>
      prev.map(item =>
        item.patient.id === patientId ? { ...item, isSelected: !item.isSelected } : item
      )
    );
  };

  const updateItemAddress = (patientId: string, address: string) => {
    setItems(prev =>
      prev.map(item => (item.patient.id === patientId ? { ...item, address } : item))
    );
  };

  const updateItemCash = (patientId: string, cashToCollect: string) => {
    setItems(prev =>
      prev.map(item => (item.patient.id === patientId ? { ...item, cashToCollect } : item))
    );
  };

  const updateItemStatus = (patientId: string, status: ManifestItem['deliveryStatus']) => {
    setItems(prev =>
      prev.map(item =>
        item.patient.id === patientId ? { ...item, deliveryStatus: status } : item
      )
    );
  };

  // WhatsApp Messaging
  const getWhatsAppMessage = (item: ManifestItem) => {
    const p = item.patient;
    const medNames = item.dueMeds.map(m => m.name).join(' و ');
    const template =
      waTemplate ||
      'مرحباً {name}، تحيات {pharmacy}. نود تذكيركم بأن موعد تكرار علاجكم ({drug}) مستحق. يتوفر لدينا خدمة التوصيل المنزلي لراحتكم.';

    return template
      .replace('{name}', p.name)
      .replace('{pharmacy}', pharmacyName)
      .replace('{drug}', medNames || (lang === 'ar' ? 'أدويتكم المزمنة' : 'your medications'))
      .replace('{date}', formatYMD(new Date()));
  };

  const sendSingleWhatsApp = (item: ManifestItem) => {
    const p = item.patient;
    if (p.phoneUnavailable || !p.phone) {
      onShowToast(lang === 'ar' ? 'رقم الهاتف غير متوفر لهذا المريض' : 'No phone number', 'error');
      return;
    }

    const message = getWhatsAppMessage(item);
    const updated = {
      ...p,
      lastReminderSent: new Date().toISOString(),
    };
    onUpdatePatient(updated);

    const cleanPhone = formatPhoneForWhatsApp(p.phone);
    window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`, '_blank');
    onShowToast(
      lang === 'ar' ? `تم فتح WhatsApp للمريض: ${p.name}` : `Opened WhatsApp for ${p.name}`,
      'success'
    );
  };

  // Sequential Dispatch Controller
  const currentSequentialItem = selectedItems[currentIndex];

  const handleSendAndAdvance = () => {
    if (!currentSequentialItem) return;
    sendSingleWhatsApp(currentSequentialItem);
    if (currentIndex < selectedItems.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      onShowToast(
        lang === 'ar' ? 'اكتمل إرسال كافة التذكيرات المحددة بنجاح!' : 'Completed all dispatches!',
        'success'
      );
    }
  };

  // Native Print Dialog
  const handlePrint = () => {
    window.print();
  };

  // Export to Excel Manifest
  const handleExportExcel = () => {
    if (selectedItems.length === 0) {
      onShowToast(lang === 'ar' ? 'يرجى تحديد طلب واحد على الأقل للتصدير' : 'Select at least one item', 'error');
      return;
    }

    const rows = selectedItems.map((item, idx) => ({
      'ت (Seq)': idx + 1,
      'اسم المريض (Patient Name)': item.patient.name,
      'رقم الهاتف (Phone)': item.patient.phone,
      'العنوان وملاحظات التوصيل (Address/Zone)': item.address,
      'الأدوية المطلوبة للصرف (Due Medications)': item.dueMeds.map(m => m.name).join(', '),
      'المبلغ للتحصيل (Cash to Collect)': item.cashToCollect || '0',
      'حالة التوصيل (Status)':
        item.deliveryStatus === 'ready'
          ? 'جاهز'
          : item.deliveryStatus === 'out_for_delivery'
          ? 'مع المندوب'
          : 'تم التسليم',
      'اسم المندوب (Courier)': courierName || 'المندوب العام',
      'تاريخ الإرسال (Dispatch Date)': formatYMD(new Date()),
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [
      { wch: 8 },
      { wch: 26 },
      { wch: 18 },
      { wch: 35 },
      { wch: 45 },
      { wch: 18 },
      { wch: 16 },
      { wch: 20 },
      { wch: 16 },
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'كشف_مناديب_التوصيل');
    XLSX.writeFile(wb, `كشف_توصيل_${pharmacyName}_${formatYMD(new Date())}.xlsx`);

    onShowToast(
      lang === 'ar' ? 'تم تصدير كشف التوصيل إلى ملف Excel بنجاح' : 'Exported delivery manifest',
      'success'
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-[2px] flex items-center justify-center p-2 sm:p-4">
      <div
        className="bg-white dark:bg-[#201f1e] border border-[#EDEBE9] dark:border-[#3b3a39] rounded-[4px] shadow-2xl w-full max-w-6xl max-h-[94vh] flex flex-col overflow-hidden text-[#242424] dark:text-[#f3f2f1]"
        dir={lang === 'ar' ? 'rtl' : 'ltr'}
      >
        {/* Modal Top Bar (Hidden in Print) */}
        <div className="px-4 py-3 border-b border-[#EDEBE9] dark:border-[#3b3a39] flex items-center justify-between bg-[#FAF9F8] dark:bg-[#252423] print:hidden">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-[4px] bg-[#EFF6FC] dark:bg-[#112338] border border-[#0078D4] flex items-center justify-center text-[#0078D4]">
              <Truck className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold leading-tight">
                  {lang === 'ar' ? 'طابور التذكير وبوليصة التوصيل اليومية' : 'Daily Refill & Delivery Dispatch'}
                </h2>
                <span className="text-[10px] font-mono px-1.5 py-0.2 bg-[#0078D4] text-white rounded-[4px]">
                  {selectedItems.length} {lang === 'ar' ? 'طلب مستحق' : 'orders'}
                </span>
              </div>
              <p className="text-[11px] text-[#605E5C] dark:text-[#a19f9d]">
                {lang === 'ar'
                  ? 'إدارة التذكير التسلسلي وكشوفات مناديب التوصيل المطبوعة مع المبالغ المحصلة'
                  : 'Manage sequential messaging & printable delivery manifests with cash co-pay'}
              </p>
            </div>
          </div>

          {/* Mode Switch Tabs & Close */}
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-[#EDEBE9] dark:bg-[#3b3a39] p-0.5 rounded-[4px]">
              <button
                type="button"
                onClick={() => setActiveTab('manifest')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-[3px] transition-colors cursor-pointer ${
                  activeTab === 'manifest'
                    ? 'bg-white dark:bg-[#201f1e] text-[#0078D4] shadow-sm'
                    : 'text-[#605E5C] dark:text-[#a19f9d] hover:text-[#242424]'
                }`}
              >
                {lang === 'ar' ? '📋 كشف المندوب للطباعة' : '📋 Courier Manifest'}
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('sequential')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-[3px] transition-colors cursor-pointer ${
                  activeTab === 'sequential'
                    ? 'bg-white dark:bg-[#201f1e] text-[#0078D4] shadow-sm'
                    : 'text-[#605E5C] dark:text-[#a19f9d] hover:text-[#242424]'
                }`}
              >
                {lang === 'ar' ? '⚡ التذكير التسلسلي السريع' : '⚡ 1-Click WhatsApp'}
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-1 rounded-[4px] text-[#605E5C] hover:text-[#242424] hover:bg-[#F3F2F1] dark:hover:bg-[#323130] transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ============================================================== */}
        {/* TAB 1: COURIER MANIFEST VIEW */}
        {/* ============================================================== */}
        {activeTab === 'manifest' && (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Manifest Toolbar (Hidden in Print) */}
            <div className="p-3 border-b border-[#EDEBE9] dark:border-[#3b3a39] bg-white dark:bg-[#201f1e] flex items-center justify-between flex-wrap gap-2 print:hidden">
              <div className="flex items-center gap-2 flex-wrap flex-1">
                {/* Search */}
                <div className="relative flex items-center border border-[#EDEBE9] dark:border-[#3b3a39] rounded-[4px] px-2 py-1 min-w-[200px]">
                  <Search className="w-3.5 h-3.5 text-[#605E5C] shrink-0" />
                  <input
                    type="text"
                    value={searchFilter}
                    onChange={e => setSearchFilter(e.target.value)}
                    placeholder={lang === 'ar' ? 'بحث باسم المريض أو الحي...' : 'Search name, zone...'}
                    className="w-full bg-transparent border-none text-xs px-1.5 outline-none"
                  />
                </div>

                {/* Courier Name Input */}
                <div className="flex items-center gap-1 border border-[#EDEBE9] dark:border-[#3b3a39] rounded-[4px] px-2 py-1 bg-[#FAF9F8] dark:bg-[#252423]">
                  <span className="text-[11px] text-[#605E5C] dark:text-[#a19f9d] whitespace-nowrap">
                    {lang === 'ar' ? 'اسم المندوب:' : 'Courier:'}
                  </span>
                  <input
                    type="text"
                    value={courierName}
                    onChange={e => setCourierName(e.target.value)}
                    placeholder={lang === 'ar' ? 'مثال: كابتن أحمد' : 'e.g. Captain Ahmed'}
                    className="bg-transparent text-xs font-semibold outline-none w-28 sm:w-36 text-[#242424] dark:text-[#f3f2f1]"
                  />
                </div>

                {/* Select All Checkbox */}
                <label className="flex items-center gap-1.5 text-xs cursor-pointer select-none px-2 py-1 rounded hover:bg-[#F3F2F1] dark:hover:bg-[#2d2c2c]">
                  <input
                    type="checkbox"
                    checked={items.length > 0 && items.every(i => i.isSelected)}
                    onChange={e => toggleSelectAll(e.target.checked)}
                    className="rounded accent-[#0078D4]"
                  />
                  <span>{lang === 'ar' ? 'تحديد الكل' : 'Select All'}</span>
                </label>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleExportExcel}
                  className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold border border-[#EDEBE9] dark:border-[#3b3a39] bg-white dark:bg-[#2d2c2c] hover:bg-[#F3F2F1] rounded-[4px] cursor-pointer text-[#107C41] transition-colors"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>{lang === 'ar' ? 'تصدير Excel' : 'Export Excel'}</span>
                </button>

                <button
                  type="button"
                  onClick={handlePrint}
                  className="flex items-center gap-1 px-3 py-1 text-xs font-semibold bg-[#0078D4] hover:bg-[#106EBE] text-white rounded-[4px] cursor-pointer transition-colors shadow-none"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>{lang === 'ar' ? 'طباعة الكشف (A4)' : 'Print Manifest'}</span>
                </button>
              </div>
            </div>

            {/* Printable Manifest Sheet Body */}
            <div
              ref={printRef}
              className="flex-1 p-4 sm:p-6 overflow-y-auto bg-[#FAF9F8] dark:bg-[#1b1a19] print:bg-white print:p-0 print:overflow-visible"
            >
              <div className="max-w-5xl mx-auto bg-white dark:bg-[#201f1e] print:bg-white print:dark:bg-white text-[#242424] print:text-black border border-[#EDEBE9] dark:border-[#3b3a39] print:border-none rounded-[4px] p-6 shadow-sm print:shadow-none space-y-4">
                {/* Print Header */}
                <div className="border-b-2 border-[#242424] pb-3 flex items-center justify-between">
                  <div>
                    <h1 className="text-lg font-bold tracking-tight">
                      {pharmacyName || (lang === 'ar' ? 'صيدلية الرعاية المجتمعية' : 'Community Pharmacy')}
                    </h1>
                    <p className="text-xs text-[#605E5C] print:text-gray-700 font-semibold">
                      {lang === 'ar'
                        ? 'كشف تسليم الأدوية المزمنة ومناديب التوصيل اليومي'
                        : 'Daily Chronic Medication Delivery & Courier Dispatch Manifest'}
                    </p>
                  </div>

                  <div className="text-left font-mono text-xs space-y-0.5">
                    <div>
                      <strong>{lang === 'ar' ? 'التاريخ:' : 'Date:'}</strong> {formatYMD(new Date())}
                    </div>
                    <div>
                      <strong>{lang === 'ar' ? 'المندوب:' : 'Courier:'}</strong>{' '}
                      {courierName || (lang === 'ar' ? 'مندوب الفترة الصباحية' : 'General Courier')}
                    </div>
                    <div>
                      <strong>{lang === 'ar' ? 'عدد الطرود:' : 'Orders:'}</strong> {selectedItems.length}
                    </div>
                  </div>
                </div>

                {/* Delivery Table */}
                <table className="w-full text-right dir-rtl text-xs border-collapse border border-[#242424]">
                  <thead>
                    <tr className="bg-[#FAF9F8] print:bg-gray-100 border-b border-[#242424] text-[11px] font-bold">
                      <th className="py-2 px-2 text-center w-8 border-l border-[#242424]">#</th>
                      <th className="py-2 px-3 border-l border-[#242424] w-40">{lang === 'ar' ? 'المريض' : 'Patient'}</th>
                      <th className="py-2 px-3 border-l border-[#242424] w-32">{lang === 'ar' ? 'الهاتف' : 'Phone'}</th>
                      <th className="py-2 px-3 border-l border-[#242424] w-48">{lang === 'ar' ? 'العنوان / الحي' : 'Address / Zone'}</th>
                      <th className="py-2 px-3 border-l border-[#242424]">{lang === 'ar' ? 'الأدوية المصروفة' : 'Prescribed Medications'}</th>
                      <th className="py-2 px-3 border-l border-[#242424] w-28 text-center">{lang === 'ar' ? 'المبلغ للتحصيل' : 'Cash to Collect'}</th>
                      <th className="py-2 px-3 border-l border-[#242424] w-24 text-center">{lang === 'ar' ? 'الحالة' : 'Status'}</th>
                      <th className="py-2 px-3 w-32 text-center print:table-cell">{lang === 'ar' ? 'توقيع المستلم' : 'Signature'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#242424]/40">
                    {filteredItems.filter(i => i.isSelected).length === 0 ? (
                      <tr>
                        <td colSpan={8} className="text-center py-12 text-[#605E5C]">
                          {lang === 'ar'
                            ? 'لا توجد طلبات توصيل محددة في الكشف حالياً'
                            : 'No delivery orders selected'}
                        </td>
                      </tr>
                    ) : (
                      filteredItems
                        .filter(i => i.isSelected)
                        .map((item, idx) => (
                          <tr key={item.patient.id} className="border-b border-[#242424]/20 hover:bg-gray-50/50">
                            {/* # */}
                            <td className="py-2 px-2 text-center font-mono font-bold border-l border-[#242424]/40">
                              {idx + 1}
                            </td>

                            {/* Patient Name */}
                            <td className="py-2 px-3 font-bold border-l border-[#242424]/40">
                              <div>{item.patient.name}</div>
                              {Boolean(item.patient.age) && (
                                <span className="text-[10px] text-[#605E5C] print:text-gray-600 font-normal">
                                  {item.patient.age} {lang === 'ar' ? 'سنة' : 'yrs'}
                                </span>
                              )}
                            </td>

                            {/* Phone */}
                            <td className="py-2 px-3 font-mono text-[11px] border-l border-[#242424]/40">
                              <div className="flex items-center gap-1 justify-between">
                                <span>{item.patient.phone}</span>
                                <button
                                  type="button"
                                  onClick={() => sendSingleWhatsApp(item)}
                                  className="print:hidden text-[#0078D4] hover:text-[#106EBE] p-0.5"
                                  title="WhatsApp"
                                >
                                  <MessageSquare className="w-3 h-3" />
                                </button>
                              </div>
                            </td>

                            {/* Address (Editable inline) */}
                            <td className="py-2 px-3 border-l border-[#242424]/40">
                              <input
                                type="text"
                                value={item.address}
                                onChange={e => updateItemAddress(item.patient.id, e.target.value)}
                                className="w-full bg-transparent border-0 print:border-none text-xs focus:ring-1 focus:ring-[#0078D4] rounded px-1"
                              />
                            </td>

                            {/* Meds */}
                            <td className="py-2 px-3 border-l border-[#242424]/40 text-xs">
                              <div className="space-y-0.5">
                                {item.dueMeds.map((m, mIdx) => (
                                  <div key={mIdx} className="font-semibold">
                                    • {m.name}
                                  </div>
                                ))}
                              </div>
                            </td>

                            {/* Cash / Co-pay to collect */}
                            <td className="py-2 px-3 border-l border-[#242424]/40 text-center font-mono">
                              <input
                                type="text"
                                value={item.cashToCollect}
                                onChange={e => updateItemCash(item.patient.id, e.target.value)}
                                className="w-20 text-center bg-transparent border border-[#EDEBE9] dark:border-[#3b3a39] print:border-none text-xs font-bold rounded py-0.5"
                                placeholder="0"
                              />
                            </td>

                            {/* Status */}
                            <td className="py-2 px-3 border-l border-[#242424]/40 text-center">
                              <select
                                value={item.deliveryStatus}
                                onChange={e => updateItemStatus(item.patient.id, e.target.value as any)}
                                className="text-[10px] font-semibold bg-transparent border border-[#EDEBE9] dark:border-[#3b3a39] print:border-none rounded px-1 py-0.5 cursor-pointer"
                              >
                                <option value="ready">{lang === 'ar' ? 'جاهز' : 'Ready'}</option>
                                <option value="out_for_delivery">{lang === 'ar' ? 'مع المندوب' : 'Out'}</option>
                                <option value="delivered">{lang === 'ar' ? 'تم التسليم' : 'Done'}</option>
                              </select>
                            </td>

                            {/* Signature Line */}
                            <td className="py-2 px-3 text-center border-b border-[#242424]/20">
                              <div className="h-6 border-b border-dashed border-gray-400 mt-2"></div>
                            </td>
                          </tr>
                        ))
                    )}
                  </tbody>
                </table>

                {/* Print Sign-off Footer */}
                <div className="pt-6 grid grid-cols-3 gap-4 text-xs font-semibold text-center border-t border-[#242424]/30 mt-6">
                  <div>
                    <span>{lang === 'ar' ? 'توقيع الصيدلي المسؤول' : 'Pharmacist Signature'}</span>
                    <div className="h-10 border-b border-gray-400 mt-2"></div>
                  </div>
                  <div>
                    <span>{lang === 'ar' ? 'توقيع مندوب التوصيل' : 'Courier Signature'}</span>
                    <div className="h-10 border-b border-gray-400 mt-2"></div>
                  </div>
                  <div>
                    <span>{lang === 'ar' ? 'إجمالي المبالغ المحصلة' : 'Total Collected Cash'}</span>
                    <div className="h-10 border-b border-gray-400 mt-2 flex items-center justify-center font-mono text-sm font-bold">
                      {selectedItems.reduce((acc, curr) => acc + (parseFloat(curr.cashToCollect) || 0), 0)}{' '}
                      {lang === 'ar' ? 'د.ع' : 'IQD'}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 2: SEQUENTIAL 1-CLICK WHATSAPP DISPATCH */}
        {/* ============================================================== */}
        {activeTab === 'sequential' && (
          <div className="flex-1 p-4 sm:p-8 overflow-y-auto flex flex-col items-center justify-center bg-[#FAF9F8] dark:bg-[#1b1a19]">
            {selectedItems.length === 0 ? (
              <div className="text-center py-12 space-y-2">
                <AlertCircle className="w-8 h-8 text-[#605E5C] mx-auto" />
                <p className="font-semibold text-sm">
                  {lang === 'ar' ? 'لا توجد طلبات محددة للإرسال السريع' : 'No items selected for dispatch'}
                </p>
                <button
                  type="button"
                  onClick={() => setActiveTab('manifest')}
                  className="text-xs text-[#0078D4] hover:underline cursor-pointer"
                >
                  {lang === 'ar' ? 'العودة للكشف وتحديد المرضى' : 'Return to manifest'}
                </button>
              </div>
            ) : currentSequentialItem ? (
              <div className="w-full max-w-xl bg-white dark:bg-[#201f1e] border border-[#EDEBE9] dark:border-[#3b3a39] rounded-[4px] p-6 shadow-sm space-y-5">
                {/* Progress bar */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span className="text-[#0078D4]">
                      {lang === 'ar' ? 'الإرسال التسلسلي النشط' : 'Sequential Dispatch'}
                    </span>
                    <span className="font-mono text-[#605E5C] dark:text-[#a19f9d]">
                      {currentIndex + 1} / {selectedItems.length}
                    </span>
                  </div>
                  <div className="w-full bg-[#EDEBE9] dark:bg-[#3b3a39] h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-[#0078D4] h-full transition-all duration-300"
                      style={{
                        width: `${((currentIndex + 1) / selectedItems.length) * 100}%`,
                      }}
                    ></div>
                  </div>
                </div>

                {/* Patient Card */}
                <div className="p-4 bg-[#FAF9F8] dark:bg-[#252423] border border-[#EDEBE9] dark:border-[#3b3a39] rounded-[4px] space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-base text-[#242424] dark:text-[#f3f2f1]">
                        {currentSequentialItem.patient.name}
                      </h3>
                      <div className="text-xs text-[#605E5C] dark:text-[#a19f9d] font-mono mt-0.5">
                        {currentSequentialItem.patient.phone}
                      </div>
                    </div>
                    {Boolean(currentSequentialItem.patient.familyTag) && (
                      <span className="text-xs font-semibold px-2 py-0.5 bg-white dark:bg-[#2d2c2c] border border-[#EDEBE9] dark:border-[#3b3a39] rounded-[4px] text-[#0078D4]">
                        👨‍👩‍👧 {currentSequentialItem.patient.familyTag}
                      </span>
                    )}
                  </div>

                  <div className="pt-2 border-t border-[#EDEBE9] dark:border-[#3b3a39] space-y-1">
                    <div className="text-[11px] font-semibold text-[#605E5C] dark:text-[#a19f9d]">
                      {lang === 'ar' ? 'الأدوية المستحقة اليوم:' : 'Due medications:'}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {currentSequentialItem.dueMeds.map((m, idx) => (
                        <span
                          key={idx}
                          className="text-xs font-bold px-2 py-0.5 bg-white dark:bg-[#201f1e] border border-[#0078D4]/40 text-[#0078D4] rounded-[4px]"
                        >
                          💊 {m.name}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* WhatsApp Message Preview */}
                <div className="space-y-1">
                  <div className="text-[11px] font-semibold text-[#605E5C] dark:text-[#a19f9d]">
                    {lang === 'ar' ? 'نص رسالة الواتساب الجاهزة للإرسال:' : 'Prepared WhatsApp message:'}
                  </div>
                  <div className="p-3 bg-[#FAF9F8] dark:bg-[#252423] border border-[#EDEBE9] dark:border-[#3b3a39] rounded-[4px] text-xs font-mono text-[#242424] dark:text-[#f3f2f1] whitespace-pre-wrap leading-relaxed">
                    {getWhatsAppMessage(currentSequentialItem)}
                  </div>
                </div>

                {/* Controls */}
                <div className="pt-2 flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
                    disabled={currentIndex === 0}
                    className="flex items-center gap-1 px-3 py-2 text-xs font-semibold border border-[#EDEBE9] dark:border-[#3b3a39] bg-white dark:bg-[#2d2c2c] hover:bg-[#F3F2F1] disabled:opacity-40 disabled:cursor-not-allowed rounded-[4px] cursor-pointer"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                    <span>{lang === 'ar' ? 'السابق' : 'Previous'}</span>
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (currentIndex < selectedItems.length - 1) {
                          setCurrentIndex(prev => prev + 1);
                        }
                      }}
                      className="px-3 py-2 text-xs font-semibold border border-[#EDEBE9] dark:border-[#3b3a39] bg-white dark:bg-[#2d2c2c] hover:bg-[#F3F2F1] rounded-[4px] cursor-pointer text-[#605E5C]"
                    >
                      {lang === 'ar' ? 'تخطي المريض' : 'Skip'}
                    </button>

                    <button
                      type="button"
                      onClick={handleSendAndAdvance}
                      className="flex items-center gap-1.5 px-5 py-2 text-xs font-bold bg-[#0078D4] hover:bg-[#106EBE] active:bg-[#005A9E] text-white rounded-[4px] cursor-pointer shadow-none transition-colors"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>
                        {currentIndex === selectedItems.length - 1
                          ? (lang === 'ar' ? 'إرسال وإنهاء 🏁' : 'Send & Finish')
                          : (lang === 'ar' ? 'إرسال والانتقال للتالي ➡️' : 'Send & Next ➡️')}
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
};
