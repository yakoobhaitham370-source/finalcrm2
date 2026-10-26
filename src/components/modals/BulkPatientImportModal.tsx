import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import {
  X,
  Upload,
  FileSpreadsheet,
  Download,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  HelpCircle,
  Sparkles,
  ArrowRight,
  Database,
  Filter,
} from 'lucide-react';
import { Patient, Medication } from '../../types/pharmacy';
import { normalizePhoneNumber, formatYMD } from '../../utils/pharmacyCalculations';

interface BulkPatientImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingPatients: Patient[];
  onCommitImport: (newPatients: Patient[]) => void;
  onShowToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  lang: 'ar' | 'en';
}

interface ParsedRow {
  rowNum: number;
  name: string;
  phone: string;
  age?: number;
  gender?: 'M' | 'F' | 'Other';
  familyTag?: string;
  address?: string;
  allergies?: string;
  medsRaw: string;
  daysSupply: number;
  lastDispenseDate: string;
  notes?: string;
  isValid: boolean;
  isDuplicate: boolean;
  validationErrors: string[];
}

export const BulkPatientImportModal: React.FC<BulkPatientImportModalProps> = ({
  isOpen,
  onClose,
  existingPatients,
  onCommitImport,
  onShowToast,
  lang,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [filterMode, setFilterMode] = useState<'ALL' | 'VALID' | 'ERRORS' | 'DUPLICATES'>('ALL');
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Existing phone registry for fast duplicate detection
  const existingPhones = new Set(
    existingPatients
      .map(p => normalizePhoneNumber(p.phone))
      .filter(p => p.length >= 7)
  );

  // Column matching aliases
  const normalizeCol = (header: string) => header.trim().toLowerCase().replace(/[\s_\-]/g, '');

  const parseUploadedFile = async (uploadedFile: File) => {
    setIsProcessing(true);
    setFile(uploadedFile);
    setFileName(uploadedFile.name);

    try {
      const data = await uploadedFile.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const jsonRows: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

      if (jsonRows.length === 0) {
        onShowToast(lang === 'ar' ? 'الملف فارغ أو لا يحتوي على صفوف بيانات' : 'File is empty', 'error');
        setIsProcessing(false);
        return;
      }

      // Detect column keys
      const sample = jsonRows[0];
      const keys = Object.keys(sample);

      const findKey = (candidates: string[]) => {
        return keys.find(k => {
          const norm = normalizeCol(k);
          return candidates.some(c => norm.includes(c));
        });
      };

      const nameKey = findKey(['name', 'اسم', 'مريض', 'patient', 'fullname']) || keys[0];
      const phoneKey = findKey(['phone', 'هاتف', 'موبايل', 'mobile', 'tel', 'جوال']) || keys[1];
      const ageKey = findKey(['age', 'عمر', 'سن', 'سنوات']);
      const genderKey = findKey(['gender', 'جنس', 'نوع', 'sex']);
      const familyKey = findKey(['family', 'عائلة', 'اسرة', 'عشيرة', 'tag']);
      const addressKey = findKey(['address', 'عنوان', 'منطقة', 'حي', 'zone', 'city']);
      const allergyKey = findKey(['allergy', 'allergies', 'حساسية', 'تحسس']);
      const medsKey = findKey(['med', 'drug', 'دواء', 'علاج', 'أدوية', 'علاجات', 'ادوية', 'وصفة']);
      const daysKey = findKey(['day', 'مدة', 'ايام', 'أيام', 'supply']);
      const dateKey = findKey(['date', 'تاريخ', 'صرف', 'dispense']);
      const notesKey = findKey(['note', 'ملاحظ', 'تشخيص', 'ملاحظات', 'diagnosis']);

      const today = formatYMD(new Date());

      const processed: ParsedRow[] = jsonRows.map((row, idx) => {
        const rawName = String(row[nameKey] || '').trim();
        const rawPhone = String(row[phoneKey] || '').trim();
        const cleanPhone = normalizePhoneNumber(rawPhone);
        const rawAge = ageKey && row[ageKey] ? parseInt(String(row[ageKey]), 10) : undefined;
        const rawGenderVal = genderKey && row[genderKey] ? String(row[genderKey]).trim().toUpperCase() : '';
        const gender: 'M' | 'F' | 'Other' | undefined =
          rawGenderVal.startsWith('M') || rawGenderVal.includes('ذكر')
            ? 'M'
            : rawGenderVal.startsWith('F') || rawGenderVal.includes('أنثى')
            ? 'F'
            : undefined;

        const familyTag = familyKey && row[familyKey] ? String(row[familyKey]).trim() : undefined;
        const address = addressKey && row[addressKey] ? String(row[addressKey]).trim() : undefined;
        const allergies = allergyKey && row[allergyKey] ? String(row[allergyKey]).trim() : undefined;
        const medsRaw = medsKey && row[medsKey] ? String(row[medsKey]).trim() : '';
        const daysSupply = daysKey && row[daysKey] ? parseInt(String(row[daysKey]), 10) || 30 : 30;
        const lastDispenseDate = dateKey && row[dateKey] ? formatYMD(String(row[dateKey])) : today;
        const rawNotes = notesKey && row[notesKey] ? String(row[notesKey]).trim() : '';

        // Combined notes if address is present
        const combinedNotes = address ? `${address}${rawNotes ? ` - ${rawNotes}` : ''}` : rawNotes;

        const validationErrors: string[] = [];
        if (!rawName) {
          validationErrors.push(lang === 'ar' ? 'اسم المريض مفقود' : 'Patient name missing');
        }
        if (!cleanPhone && cleanPhone.length < 5) {
          validationErrors.push(lang === 'ar' ? 'رقم هاتف غير صالح' : 'Invalid phone number');
        }

        const isDuplicate = cleanPhone.length >= 7 && existingPhones.has(cleanPhone);
        if (isDuplicate) {
          validationErrors.push(lang === 'ar' ? 'رقم الهاتف مسجل مسبقاً' : 'Phone already exists');
        }

        const isValid = validationErrors.filter(e => !e.includes('مسجل مسبقاً') && !e.includes('already exists')).length === 0;

        return {
          rowNum: idx + 2, // Excel 1-based header offset
          name: rawName,
          phone: cleanPhone || rawPhone,
          age: isNaN(rawAge as number) ? undefined : rawAge,
          gender,
          familyTag,
          address,
          allergies,
          medsRaw,
          daysSupply,
          lastDispenseDate,
          notes: combinedNotes,
          isValid,
          isDuplicate,
          validationErrors,
        };
      });

      setParsedRows(processed);
      setIsProcessing(false);
      onShowToast(
        lang === 'ar'
          ? `تمت قراءة ${processed.length} صف من الملف بنجاح`
          : `Loaded ${processed.length} rows successfully`,
        'success'
      );
    } catch (err: any) {
      console.error('Error parsing excel:', err);
      setIsProcessing(false);
      onShowToast(
        lang === 'ar' ? 'حدث خطأ أثناء قراءة ملف Excel/CSV' : 'Error reading spreadsheet file',
        'error'
      );
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      parseUploadedFile(selected);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) {
      parseUploadedFile(dropped);
    }
  };

  const downloadSampleTemplate = (fileType: 'xlsx' | 'csv' = 'xlsx') => {
    const sampleHeaders = [
      {
        'اسم المريض (Patient Name)': 'حيدر عبد الأمير كريم',
        'رقم الهاتف (Phone)': '07701234567',
        'العمر (Age)': 58,
        'الجنس (Gender)': 'ذكر',
        'رمز العائلة (Family Tag)': 'الكرخي',
        'العنوان والحي (Address/Zone)': 'بغداد - المنصور - محلة 602',
        'الأدوية المزمنة (Medications)': 'Glucophage 500mg, Lipitor 20mg, Concor 5mg',
        'مدة الصرف بالأيام (Days Supply)': 30,
        'تاريخ آخر صرف (Last Dispense Date)': formatYMD(new Date()),
        'الحساسية (Allergies)': 'لا يوجد (NKDA)',
        'ملاحظات وتشخيص (Notes)': 'مريض سكري نوع 2 وضغط دم شرياني مستقر',
      },
      {
        'اسم المريض (Patient Name)': 'زينب أحمد صادق',
        'رقم الهاتف (Phone)': '07809876543',
        'العمر (Age)': 64,
        'الجنس (Gender)': 'أنثى',
        'رمز العائلة (Family Tag)': 'الكرخي',
        'العنوان والحي (Address/Zone)': 'بغداد - الكرخ - حي الجامعة',
        'الأدوية المزمنة (Medications)': 'Januvia 100mg, Euthyrox 50mcg',
        'مدة الصرف بالأيام (Days Supply)': 30,
        'تاريخ آخر صرف (Last Dispense Date)': formatYMD(new Date()),
        'الحساسية (Allergies)': 'حساسية بنسلين (Penicillin Allergy)',
        'ملاحظات وتشخيص (Notes)': 'قصور غدة درقية ومتابعة سكر',
      },
    ];

    const ws = XLSX.utils.json_to_sheet(sampleHeaders);
    // Auto-fit column widths
    ws['!cols'] = [
      { wch: 26 },
      { wch: 18 },
      { wch: 10 },
      { wch: 12 },
      { wch: 18 },
      { wch: 30 },
      { wch: 45 },
      { wch: 16 },
      { wch: 18 },
      { wch: 22 },
      { wch: 35 },
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'قالب_المرضى_المزمنين');

    if (fileType === 'xlsx') {
      XLSX.writeFile(wb, `قالب_استيراد_المرضى_المزمنين_PharmPulse.xlsx`);
    } else {
      XLSX.writeFile(wb, `قالب_استيراد_المرضى_المزمنين_PharmPulse.csv`, { bookType: 'csv' });
    }

    onShowToast(
      lang === 'ar' ? 'تم تنزيل قالب الاستيراد النموذجي جاهزاً للتعبئة' : 'Downloaded sample template',
      'success'
    );
  };

  // Convert parsed rows into final Patient objects
  const handleCommit = () => {
    const validRows = parsedRows.filter(r => {
      if (!r.isValid) return false;
      if (skipDuplicates && r.isDuplicate) return false;
      return true;
    });

    if (validRows.length === 0) {
      onShowToast(
        lang === 'ar' ? 'لا توجد صفوف صالحة للاستيراد بناءً على الخيارات المحددة' : 'No valid rows to import',
        'error'
      );
      return;
    }

    const newPatients: Patient[] = validRows.map((r, i) => {
      const patientId = `PT-${Date.now().toString().slice(-4)}${Math.floor(10 + Math.random() * 89)}-${i + 1}`;

      // Split raw meds by comma, semicolon, or plus sign
      const medList: Medication[] = [];
      if (r.medsRaw) {
        const rawItems = r.medsRaw
          .split(/[,;\n\+،]/)
          .map(s => s.trim())
          .filter(Boolean);

        rawItems.forEach(item => {
          medList.push({
            name: item,
            lastDispenseDate: r.lastDispenseDate,
            daysSupply: r.daysSupply || 30,
            timing: 'morning',
            mealRelation: 'after_meal',
          });
        });
      }

      const allergyText = r.allergies ? r.allergies.trim() : '';
      const isNkda =
        allergyText.toLowerCase().includes('nkda') ||
        allergyText.includes('لا يوجد') ||
        allergyText.includes('سليم');

      return {
        id: patientId,
        name: r.name,
        phone: r.phone,
        age: r.age,
        gender: r.gender,
        familyTag: r.familyTag,
        loyaltyPoints: 10,
        allergies: allergyText,
        allergiesStatus: isNkda ? 'nkda' : allergyText ? 'recorded' : 'not_recorded',
        notes: r.notes,
        medications: medList,
        createdAt: new Date().toISOString(),
      };
    });

    onCommitImport(newPatients);
    onClose();
  };

  const validCount = parsedRows.filter(r => r.isValid && !r.isDuplicate).length;
  const duplicateCount = parsedRows.filter(r => r.isDuplicate).length;
  const errorCount = parsedRows.filter(r => !r.isValid).length;

  const displayedRows = parsedRows.filter(r => {
    if (filterMode === 'VALID') return r.isValid && !r.isDuplicate;
    if (filterMode === 'ERRORS') return !r.isValid;
    if (filterMode === 'DUPLICATES') return r.isDuplicate;
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-[2px] flex items-center justify-center p-2 sm:p-4">
      <div
        className="bg-white dark:bg-[#201f1e] border border-[#EDEBE9] dark:border-[#3b3a39] rounded-[4px] shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden text-[#242424] dark:text-[#f3f2f1]"
        dir={lang === 'ar' ? 'rtl' : 'ltr'}
      >
        {/* Header (Fluent UI Style) */}
        <div className="px-4 py-3 border-b border-[#EDEBE9] dark:border-[#3b3a39] flex items-center justify-between bg-[#FAF9F8] dark:bg-[#252423]">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-[4px] bg-[#EFF6FC] dark:bg-[#112338] border border-[#0078D4] flex items-center justify-center text-[#0078D4]">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold leading-tight">
                {lang === 'ar' ? 'استيراد سجلات المرضى المجمع (Excel / CSV)' : 'Bulk Patient Import (Excel / CSV)'}
              </h2>
              <p className="text-[11px] text-[#605E5C] dark:text-[#a19f9d]">
                {lang === 'ar'
                  ? 'رفع وتغذية مئات المرضى المزمنين وأدويتهم بضغطة زر مع فحص التكرار والأخطاء'
                  : 'Import hundreds of chronic patients and regimens in seconds with validation'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => downloadSampleTemplate('xlsx')}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold border border-[#EDEBE9] dark:border-[#3b3a39] bg-white dark:bg-[#2d2c2c] hover:bg-[#F3F2F1] text-[#0078D4] rounded-[4px] cursor-pointer transition-colors"
              title={lang === 'ar' ? 'تنزيل قالب إكسل فارغ جاهز' : 'Download sample template'}
            >
              <Download className="w-3.5 h-3.5" />
              <span>{lang === 'ar' ? 'تنزيل نموذج Excel' : 'Sample Template'}</span>
            </button>
            <button
              onClick={onClose}
              className="p-1 rounded-[4px] text-[#605E5C] hover:text-[#242424] hover:bg-[#F3F2F1] dark:hover:bg-[#323130] transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-4 space-y-4 overflow-y-auto flex-1">
          {/* Dropzone Area */}
          {parsedRows.length === 0 ? (
            <div
              onDragOver={e => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-[#0078D4]/40 hover:border-[#0078D4] bg-[#FAF9F8] dark:bg-[#252423] hover:bg-[#EFF6FC]/30 rounded-[4px] p-8 text-center cursor-pointer transition-all space-y-3"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileChange}
                className="hidden"
              />
              <div className="w-12 h-12 mx-auto rounded-full bg-[#EFF6FC] dark:bg-[#112338] text-[#0078D4] flex items-center justify-center">
                <Upload className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-bold text-[#242424] dark:text-[#f3f2f1]">
                  {lang === 'ar'
                    ? 'اسحب وأفلت ملف Excel (.xlsx) أو (.csv) هنا، أو انقر للاختيار'
                    : 'Drag & drop Excel (.xlsx) or CSV file here, or click to browse'}
                </p>
                <p className="text-xs text-[#605E5C] dark:text-[#a19f9d]">
                  {lang === 'ar'
                    ? 'يدعم جداول الصيدليات، أسماء المرضى، أرقام الهواتف، قائمة الأدوية، تواريخ الصرف والجرعات'
                    : 'Supports Arabic and English headers, drug lists, phone numbers, and refill dates'}
                </p>
              </div>

              <div className="pt-2 flex items-center justify-center gap-3 text-xs text-[#605E5C] dark:text-[#a19f9d]">
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#107C41]" />
                  {lang === 'ar' ? 'تعرف تلقائي على الأعمدة' : 'Auto-detect columns'}
                </span>
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#107C41]" />
                  {lang === 'ar' ? 'منع التكرار التلقائي' : 'Duplicate protection'}
                </span>
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#107C41]" />
                  {lang === 'ar' ? 'مزامنة مباشرة مع Google Sheet' : 'Direct Cloud Sync'}
                </span>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {/* File Info & Validation Summary Banner */}
              <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-[#FAF9F8] dark:bg-[#252423] border border-[#EDEBE9] dark:border-[#3b3a39] rounded-[4px]">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-[#0078D4]" />
                  <span className="font-mono font-bold text-xs">{fileName}</span>
                  <span className="text-xs text-[#605E5C] dark:text-[#a19f9d]">
                    ({parsedRows.length} {lang === 'ar' ? 'صف إجمالي' : 'total rows'})
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setParsedRows([]);
                      setFile(null);
                    }}
                    className="text-xs text-[#0078D4] hover:underline cursor-pointer"
                  >
                    {lang === 'ar' ? 'تغيير الملف' : 'Change file'}
                  </button>
                </div>
              </div>

              {/* Status Filter Badges */}
              <div className="flex items-center justify-between flex-wrap gap-2 text-xs">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setFilterMode('ALL')}
                    className={`px-2 py-1 rounded-[4px] font-semibold border cursor-pointer transition-colors ${
                      filterMode === 'ALL'
                        ? 'bg-[#0078D4] text-white border-[#0078D4]'
                        : 'bg-white dark:bg-[#252423] text-[#242424] dark:text-[#f3f2f1] border-[#EDEBE9] dark:border-[#3b3a39]'
                    }`}
                  >
                    {lang === 'ar' ? 'الكل' : 'All'} ({parsedRows.length})
                  </button>

                  <button
                    type="button"
                    onClick={() => setFilterMode('VALID')}
                    className={`px-2 py-1 rounded-[4px] font-semibold border cursor-pointer transition-colors ${
                      filterMode === 'VALID'
                        ? 'bg-[#107C41] text-white border-[#107C41]'
                        : 'bg-white dark:bg-[#252423] text-[#107C41] border-[#EDEBE9] dark:border-[#3b3a39]'
                    }`}
                  >
                    ✓ {lang === 'ar' ? 'جاهز للاستيراد' : 'Valid'} ({validCount})
                  </button>

                  {duplicateCount > 0 && (
                    <button
                      type="button"
                      onClick={() => setFilterMode('DUPLICATES')}
                      className={`px-2 py-1 rounded-[4px] font-semibold border cursor-pointer transition-colors ${
                        filterMode === 'DUPLICATES'
                          ? 'bg-[#7A5B00] text-white border-[#7A5B00]'
                          : 'bg-white dark:bg-[#252423] text-[#7A5B00] border-[#EDEBE9] dark:border-[#3b3a39]'
                      }`}
                    >
                      ⚠️ {lang === 'ar' ? 'أرقام مكررة بالنظام' : 'Duplicates'} ({duplicateCount})
                    </button>
                  )}

                  {errorCount > 0 && (
                    <button
                      type="button"
                      onClick={() => setFilterMode('ERRORS')}
                      className={`px-2 py-1 rounded-[4px] font-semibold border cursor-pointer transition-colors ${
                        filterMode === 'ERRORS'
                          ? 'bg-[#A80000] text-white border-[#A80000]'
                          : 'bg-white dark:bg-[#252423] text-[#A80000] border-[#EDEBE9] dark:border-[#3b3a39]'
                      }`}
                    >
                      ✕ {lang === 'ar' ? 'أخطاء / نقص بيانات' : 'Errors'} ({errorCount})
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-1.5 text-xs text-[#242424] dark:text-[#f3f2f1] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={skipDuplicates}
                      onChange={e => setSkipDuplicates(e.target.checked)}
                      className="rounded accent-[#0078D4]"
                    />
                    <span>{lang === 'ar' ? 'تخطي السجلات ذات الأرقام المكررة' : 'Skip duplicate phone numbers'}</span>
                  </label>
                </div>
              </div>

              {/* Data Preview DetailsList */}
              <div className="border border-[#EDEBE9] dark:border-[#3b3a39] rounded-[4px] overflow-hidden max-h-[380px] overflow-y-auto">
                <table className="w-full text-right dir-rtl text-xs border-collapse">
                  <thead className="bg-[#FAF9F8] dark:bg-[#2d2c2c] text-[#605E5C] dark:text-[#a19f9d] text-[11px] font-semibold sticky top-0 border-b border-[#EDEBE9] dark:border-[#3b3a39] z-10">
                    <tr>
                      <th className="py-2 px-2.5 text-center w-12">#</th>
                      <th className="py-2 px-3">{lang === 'ar' ? 'الحالة' : 'Status'}</th>
                      <th className="py-2 px-3">{lang === 'ar' ? 'اسم المريض' : 'Patient Name'}</th>
                      <th className="py-2 px-3">{lang === 'ar' ? 'الهاتف' : 'Phone'}</th>
                      <th className="py-2 px-3">{lang === 'ar' ? 'العمر' : 'Age'}</th>
                      <th className="py-2 px-3">{lang === 'ar' ? 'العائلة' : 'Family'}</th>
                      <th className="py-2 px-3">{lang === 'ar' ? 'الأدوية المستخرجة' : 'Medications'}</th>
                      <th className="py-2 px-3">{lang === 'ar' ? 'مدة الصرف' : 'Days'}</th>
                      <th className="py-2 px-3">{lang === 'ar' ? 'العنوان / الملاحظات' : 'Notes/Address'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EDEBE9] dark:divide-[#3b3a39]">
                    {displayedRows.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="text-center py-8 text-[#605E5C] dark:text-[#a19f9d]">
                          {lang === 'ar' ? 'لا توجد سجلات مطابقة لهذا الفلتر' : 'No records matching filter'}
                        </td>
                      </tr>
                    ) : (
                      displayedRows.map((r, idx) => (
                        <tr
                          key={idx}
                          className={`hover:bg-[#F3F2F1] dark:hover:bg-[#2d2c2c] transition-colors ${
                            !r.isValid
                              ? 'bg-red-50/30 dark:bg-red-950/20'
                              : r.isDuplicate
                              ? 'bg-amber-50/30 dark:bg-amber-950/20'
                              : ''
                          }`}
                        >
                          <td className="py-2 px-2.5 text-center font-mono text-[11px] text-[#605E5C] dark:text-[#a19f9d]">
                            {r.rowNum}
                          </td>

                          {/* Status */}
                          <td className="py-2 px-3">
                            {r.isValid && !r.isDuplicate ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#107C41] bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 px-1.5 py-0.5 rounded-[4px]">
                                <CheckCircle2 className="w-3 h-3" />
                                {lang === 'ar' ? 'جاهز' : 'Ready'}
                              </span>
                            ) : r.isDuplicate ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#7A5B00] bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 px-1.5 py-0.5 rounded-[4px]">
                                <AlertTriangle className="w-3 h-3" />
                                {lang === 'ar' ? 'مكرر' : 'Duplicate'}
                              </span>
                            ) : (
                              <span
                                className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#A80000] bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 px-1.5 py-0.5 rounded-[4px]"
                                title={r.validationErrors.join(' | ')}
                              >
                                <AlertCircle className="w-3 h-3" />
                                {lang === 'ar' ? 'خطأ' : 'Error'}
                              </span>
                            )}
                          </td>

                          {/* Name */}
                          <td className="py-2 px-3 font-semibold text-[#242424] dark:text-[#f3f2f1]">
                            {r.name || <span className="text-[#A80000] italic">({lang === 'ar' ? 'مفقود' : 'Missing'})</span>}
                          </td>

                          {/* Phone */}
                          <td className="py-2 px-3 font-mono text-[11px]">
                            {r.phone || <span className="text-[#A80000] italic">({lang === 'ar' ? 'مفقود' : 'Missing'})</span>}
                          </td>

                          {/* Age */}
                          <td className="py-2 px-3 font-mono text-[11px]">
                            {r.age ? `${r.age}` : '—'}
                          </td>

                          {/* Family Tag */}
                          <td className="py-2 px-3">
                            {r.familyTag ? (
                              <span className="px-1.5 py-0.5 border border-[#EDEBE9] dark:border-[#3b3a39] bg-[#FAF9F8] dark:bg-[#252423] rounded-[4px] text-[10px]">
                                {r.familyTag}
                              </span>
                            ) : (
                              '—'
                            )}
                          </td>

                          {/* Meds */}
                          <td className="py-2 px-3 max-w-[200px] truncate" title={r.medsRaw}>
                            {r.medsRaw || <span className="text-[#605E5C] text-[10px]">—</span>}
                          </td>

                          {/* Days Supply */}
                          <td className="py-2 px-3 font-mono text-[11px]">
                            {r.daysSupply} {lang === 'ar' ? 'يوم' : 'd'}
                          </td>

                          {/* Notes */}
                          <td className="py-2 px-3 max-w-[180px] truncate text-[11px] text-[#605E5C] dark:text-[#a19f9d]" title={r.notes}>
                            {r.notes || '—'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-4 py-3 border-t border-[#EDEBE9] dark:border-[#3b3a39] bg-[#FAF9F8] dark:bg-[#252423] flex items-center justify-between flex-wrap gap-2">
          <div className="text-xs text-[#605E5C] dark:text-[#a19f9d]">
            {parsedRows.length > 0 && (
              <span>
                {lang === 'ar'
                  ? `سيتم استيراد ${
                      skipDuplicates ? validCount : validCount + duplicateCount
                    } مريض إلى قاعدة البيانات والمزامنة مع السحابة.`
                  : `Will import ${
                      skipDuplicates ? validCount : validCount + duplicateCount
                    } patients and sync to cloud.`}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-[4px] text-xs font-semibold border border-[#EDEBE9] dark:border-[#3b3a39] bg-white dark:bg-[#2d2c2c] hover:bg-[#F3F2F1] cursor-pointer transition-colors"
            >
              {lang === 'ar' ? 'إلغاء' : 'Cancel'}
            </button>

            {parsedRows.length > 0 && (
              <button
                type="button"
                onClick={handleCommit}
                disabled={validCount === 0 && (!duplicateCount || skipDuplicates)}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-[4px] text-xs font-semibold bg-[#0078D4] hover:bg-[#106EBE] active:bg-[#005A9E] disabled:opacity-50 disabled:cursor-not-allowed text-white border-0 transition-colors cursor-pointer"
              >
                <Database className="w-3.5 h-3.5 text-white" />
                <span>
                  {lang === 'ar'
                    ? `تأكيد استيراد (${skipDuplicates ? validCount : validCount + duplicateCount}) مريض`
                    : `Commit Import (${skipDuplicates ? validCount : validCount + duplicateCount})`}
                </span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
