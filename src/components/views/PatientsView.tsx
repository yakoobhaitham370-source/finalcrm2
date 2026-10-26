import React, { useState, useMemo, useEffect } from 'react';
import {
  Users,
  Search,
  Plus,
  FileText,
  Archive,
  Star,
  Filter,
  Download,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Sparkles,
  LineChart,
  ArrowDownAZ,
  FileSpreadsheet,
  Upload,
} from 'lucide-react';
import { Patient } from '../../types/pharmacy';
import { calculatePDC } from '../../utils/pharmacyCalculations';
import { useDebounce } from '../../utils/useDebounce';

interface PatientsViewProps {
  patients: Patient[];
  lang: 'ar' | 'en';
  onOpenPatientModal: (patientId?: string, tab?: string) => void;
  onOpenHouseholdModal: (familyTag: string) => void;
  onOpenAiRxModal?: () => void;
  onOpenBulkImport?: () => void;
  onExportExcel?: () => void;
  onArchivePatient: (patientId: string) => void;
  onShowToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  onClearSearch?: () => void;
  debouncedSearchQuery?: string;
}

export const PatientsView: React.FC<PatientsViewProps> = ({
  patients,
  lang,
  onOpenPatientModal,
  onOpenHouseholdModal,
  onOpenAiRxModal,
  onOpenBulkImport,
  onExportExcel,
  onArchivePatient,
  onShowToast,
  searchQuery,
  onSearchChange,
  onClearSearch,
  debouncedSearchQuery: externalDebouncedQuery,
}) => {
  const [localSearch, setLocalSearch] = useState('');
  const debouncedLocal = useDebounce(localSearch, 200);

  const effectiveSearch = searchQuery !== undefined ? searchQuery : localSearch;
  const effectiveDebouncedSearch =
    externalDebouncedQuery !== undefined ? externalDebouncedQuery : debouncedLocal;

  const handleSearchInput = (val: string) => {
    if (onSearchChange) {
      onSearchChange(val);
    } else {
      setLocalSearch(val);
    }
  };

  const handleClear = () => {
    if (onClearSearch) {
      onClearSearch();
    } else {
      setLocalSearch('');
    }
  };

  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [familyFilter, setFamilyFilter] = useState('ALL');
  const [adherenceFilter, setAdherenceFilter] = useState('ALL');

  const renderAllergyBadge = (patient: Patient) => {
    const status = patient.allergiesStatus;
    const allergies = patient.allergies?.trim() || '';

    if (status === 'nkda' || allergies.toLowerCase().includes('nkda') || allergies.includes('لا يوجد')) {
      return (
        <span className="inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-[4px] bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
          NKDA (لا توجد حساسية)
        </span>
      );
    }

    if (status === 'recorded' || allergies.length > 0) {
      return (
        <span className="inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-[4px] bg-red-50 dark:bg-red-950/60 text-[#A80000] dark:text-red-300 border border-red-200 dark:border-red-800">
          حساسية: {allergies}
        </span>
      );
    }

    return (
      <span className="inline-flex items-center text-[10px] font-medium px-2 py-0.5 rounded-[4px] bg-[#EDEBE9] dark:bg-[#3b3a39] text-[#605E5C] dark:text-[#a19f9d]">
        الحساسية غير مسجلة
      </span>
    );
  };

  const [pageSize, setPageSize] = useState<number>(50);
  const [currentPage, setCurrentPage] = useState<number>(1);

  const activePatients = useMemo(() => patients.filter(p => !p.isArchived), [patients]);

  const uniqueFamilies = useMemo(() => {
    const set = new Set<string>();
    activePatients.forEach(p => {
      if (p.familyTag && p.familyTag.trim()) set.add(p.familyTag.trim());
    });
    return Array.from(set);
  }, [activePatients]);

  const filteredPatients = useMemo(() => {
    const q = effectiveDebouncedSearch.toLowerCase().trim();
    const digitsOnly = q.replace(/\D/g, '');

    const filtered = activePatients.filter(p => {
      const phoneRaw = p.phone || '';
      const phoneDigits = phoneRaw.replace(/\D/g, '');
      const matchPhone =
        phoneRaw.toLowerCase().includes(q) ||
        (digitsOnly.length >= 2 && phoneDigits.includes(digitsOnly));

      const matchSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        matchPhone ||
        p.id.toLowerCase().includes(q) ||
        (p.familyTag && p.familyTag.toLowerCase().includes(q)) ||
        (p.notes && p.notes.toLowerCase().includes(q)) ||
        (p.allergies && p.allergies.toLowerCase().includes(q)) ||
        (p.medications || []).some(m => m.name.toLowerCase().includes(q));

      const matchFamily =
        familyFilter === 'ALL' ||
        (familyFilter === 'NO_FAMILY' && !p.familyTag) ||
        p.familyTag === familyFilter;

      const pdc = calculatePDC(p);
      const matchAdherence =
        adherenceFilter === 'ALL' ||
        (adherenceFilter === 'HIGH' && pdc >= 80) ||
        (adherenceFilter === 'LOW' && pdc < 80);

      return matchSearch && matchFamily && matchAdherence;
    });

    const collator = new Intl.Collator([lang === 'ar' ? 'ar' : 'en', 'ar', 'en'], {
      sensitivity: 'base',
      numeric: true,
    });

    return [...filtered].sort((a, b) => {
      return collator.compare((a.name || '').trim(), (b.name || '').trim());
    });
  }, [activePatients, effectiveDebouncedSearch, familyFilter, adherenceFilter, lang]);

  useEffect(() => {
    setCurrentPage(1);
  }, [effectiveDebouncedSearch, familyFilter, adherenceFilter, pageSize, sortOrder]);

  const totalPages = pageSize === -1 ? 1 : Math.max(1, Math.ceil(filteredPatients.length / pageSize));
  const validCurrentPage = Math.min(currentPage, totalPages);

  const paginatedPatients = useMemo(() => {
    if (pageSize === -1) return filteredPatients;
    const startIdx = (validCurrentPage - 1) * pageSize;
    return filteredPatients.slice(startIdx, startIdx + pageSize);
  }, [filteredPatients, validCurrentPage, pageSize]);

  const startRecord = filteredPatients.length === 0 ? 0 : (validCurrentPage - 1) * (pageSize === -1 ? filteredPatients.length : pageSize) + 1;
  const endRecord = pageSize === -1 ? filteredPatients.length : Math.min(validCurrentPage * pageSize, filteredPatients.length);



  return (
    <div className="space-y-1.5 sm:space-y-2 bg-transparent text-[#242424]">
      {/* CommandBar Header panel */}
      <div className="bg-[#FFFFFF] dark:bg-[#201f1e] border-b sm:border border-[#EDEBE9] dark:border-[#3b3a39] rounded-none sm:rounded-[4px] p-2.5 sm:p-3 space-y-2 -mt-px sm:mt-0">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <div>
            <div className="font-semibold text-sm text-[#242424] dark:text-[#f3f2f1] flex items-center gap-1.5 tracking-tight">
              <Users className="w-4 h-4 text-[#0078D4]" />
              <span>{lang === 'ar' ? 'دليل المرضى وسجلات العوائل' : 'Patients Directory & Family Registry'}</span>
            </div>
            <div className="text-[11px] text-[#605E5C] dark:text-[#a19f9d] mt-0.5 font-mono">
              {lang === 'ar'
                ? `إجمالي ${activePatients.length} ملف نشط / ${uniqueFamilies.length} عائلة`
                : `${activePatients.length} active patients / ${uniqueFamilies.length} families`}
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            {onOpenBulkImport && (
              <button
                type="button"
                onClick={onOpenBulkImport}
                className="flex items-center gap-1 px-2.5 py-1 rounded-[4px] text-xs font-semibold bg-[#FFFFFF] dark:bg-[#252423] hover:bg-[#F3F2F1] dark:hover:bg-[#323130] text-[#107C41] border border-[#107C41] transition-colors cursor-pointer min-h-[36px]"
                title={lang === 'ar' ? 'استيراد مئات المرضى من ملف Excel أو CSV' : 'Bulk import patients from Excel/CSV'}
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-[#107C41]" />
                <span>{lang === 'ar' ? 'استيراد Excel' : 'Import Excel'}</span>
              </button>
            )}

            {onExportExcel && (
              <button
                type="button"
                onClick={onExportExcel}
                className="flex items-center gap-1 px-2.5 py-1 rounded-[4px] text-xs font-semibold bg-[#FFFFFF] dark:bg-[#252423] hover:bg-[#F3F2F1] dark:hover:bg-[#323130] text-[#605E5C] dark:text-[#a19f9d] border border-[#EDEBE9] dark:border-[#3b3a39] transition-colors cursor-pointer min-h-[36px]"
                title={lang === 'ar' ? 'تصدير كامل سجل المرضى إلى ملف Excel' : 'Export patients to Excel'}
              >
                <Download className="w-3.5 h-3.5" />
                <span>{lang === 'ar' ? 'تصدير' : 'Export'}</span>
              </button>
            )}

            {onOpenAiRxModal && (
              <button
                type="button"
                onClick={onOpenAiRxModal}
                className="flex items-center gap-1 px-2.5 py-1 rounded-[4px] text-xs font-semibold bg-[#FFFFFF] dark:bg-[#252423] hover:bg-[#EFF6FC] dark:hover:bg-[#112338] text-[#0078D4] border border-[#0078D4] transition-colors cursor-pointer min-h-[36px]"
                title={lang === 'ar' ? 'استخراج بيانات المريض والأدوية' : 'AI Rx Extraction'}
              >
                <Sparkles className="w-3 h-3 text-[#0078D4]" />
                <span>{lang === 'ar' ? 'استخراج ذكي' : 'AI Rx Extract'}</span>
              </button>
            )}
            {/* Per-page selector moved right beside New Patient button */}
            <div className="flex items-center gap-1.5 bg-[#FFFFFF] dark:bg-[#252423] border border-[#EDEBE9] dark:border-[#3b3a39] rounded-[4px] px-2 py-1 min-h-[36px]">
              <span className="text-[11px] text-[#605E5C] dark:text-[#a19f9d] whitespace-nowrap">{lang === 'ar' ? 'لكل صفحة:' : 'Per page:'}</span>
              <select
                value={pageSize}
                onChange={e => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="bg-transparent text-[#242424] dark:text-[#f3f2f1] text-xs font-semibold outline-none cursor-pointer"
              >
                <option value={25} className="bg-white dark:bg-[#252423]">25</option>
                <option value={50} className="bg-white dark:bg-[#252423]">50</option>
                <option value={100} className="bg-white dark:bg-[#252423]">100</option>
                <option value={200} className="bg-white dark:bg-[#252423]">200</option>
                <option value={-1} className="bg-white dark:bg-[#252423]">{lang === 'ar' ? 'الكل (All)' : 'All'}</option>
              </select>
            </div>
            <button
              onClick={() => onOpenPatientModal()}
              className="flex items-center gap-1 px-3 py-1 rounded-[4px] text-xs font-semibold bg-[#0078D4] hover:bg-[#106EBE] active:bg-[#005A9E] text-white border-0 transition-colors cursor-pointer shadow-none min-h-[36px]"
            >
              <Plus className="w-3.5 h-3.5 text-white" />
              <span>{lang === 'ar' ? 'تسجيل مريض جديد' : 'New Patient'}</span>
            </button>
          </div>
        </div>

        {/* Filter & Search controls (Search bar and Adherence levels only) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1.5 border-t border-[#EDEBE9] dark:border-[#3b3a39]">
          {/* Fluent UI Underlined Search */}
          <div className="relative flex items-center border-b border-[#EDEBE9] dark:border-[#3b3a39] focus-within:border-b-2 focus-within:border-[#0078D4] transition-all pb-0.5">
            <Search className="w-3.5 h-3.5 text-[#605E5C] dark:text-[#a19f9d] shrink-0" />
            <input
              type="text"
              value={effectiveSearch}
              onChange={e => handleSearchInput(e.target.value)}
              placeholder={lang === 'ar' ? 'بحث بالاسم، الهاتف، التشخيص، الدواء...' : 'Search name, phone, diagnosis, drug...'}
              className="w-full bg-transparent border-none text-[#242424] dark:text-[#f3f2f1] placeholder-[#605E5C] dark:placeholder-[#a19f9d] text-xs px-2 py-0.5 outline-none"
            />
            {effectiveSearch && (
              <button
                type="button"
                onClick={handleClear}
                className="text-[#605E5C] dark:text-[#a19f9d] hover:text-[#242424] dark:hover:text-[#f3f2f1] transition-colors cursor-pointer p-0.5"
                title={lang === 'ar' ? 'مسح البحث' : 'Clear search'}
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Adherence Filter */}
          <select
            value={adherenceFilter}
            onChange={e => setAdherenceFilter(e.target.value)}
            className="w-full bg-[#FFFFFF] dark:bg-[#252423] border border-[#EDEBE9] dark:border-[#3b3a39] text-[#242424] dark:text-[#f3f2f1] text-xs rounded-[4px] p-1.5 outline-none focus:border-[#0078D4]"
          >
            <option value="ALL">{lang === 'ar' ? 'جميع مستويات الالتزام' : 'All Adherence Levels'}</option>
            <option value="HIGH">{lang === 'ar' ? 'ملتزمون ممتازون (PDC ≥ 80%)' : 'High Adherence (≥80%)'}</option>
            <option value="LOW">{lang === 'ar' ? 'معرضون للخطر (PDC < 80%)' : 'Low Adherence (<80%)'}</option>
          </select>
        </div>
      </div>

      {/* Patients Table - DetailsList Layout */}
      <div className="bg-[#FFFFFF] dark:bg-[#201f1e] border-y sm:border border-[#EDEBE9] dark:border-[#3b3a39] rounded-none sm:rounded-[4px] overflow-hidden">
        {/* Desktop View: Table with horizontal scroll */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-right dir-rtl text-xs border-collapse">
            <thead className="bg-[#FAF9F8] dark:bg-[#2d2c2c] text-[#242424] dark:text-[#f3f2f1] font-semibold border-b border-[#EDEBE9] dark:border-[#3b3a39]">
              <tr>
                <th className="py-2 px-2.5 text-[10px] uppercase tracking-wider">{lang === 'ar' ? 'المعرف' : 'ID'}</th>
                <th className="py-2 px-2.5 text-[10px] uppercase tracking-wider">
                  <div className="flex items-center gap-1 font-semibold text-[#242424] dark:text-[#f3f2f1]">
                    <span>{lang === 'ar' ? 'المريض والهاتف' : 'Patient & Phone'}</span>
                    <span className="inline-flex items-center gap-0.5 px-1 py-0.2 rounded-[2px] bg-[#EFF6FC] dark:bg-[#112338] text-[#0078D4] border border-[#C7E0F4] dark:border-[#1e4a6f] text-[9px] font-mono font-bold">
                      <ArrowDownAZ className="w-2.5 h-2.5" />
                      <span>{lang === 'ar' ? 'أ-ي' : 'A-Z'}</span>
                    </span>
                  </div>
                </th>
                <th className="py-2 px-2.5 text-[10px] uppercase tracking-wider">{lang === 'ar' ? 'العمر / الجنس' : 'Age / Sex'}</th>
                <th className="py-2 px-2.5 text-[10px] uppercase tracking-wider">{lang === 'ar' ? 'رمز العائلة' : 'Family Tag'}</th>
                <th className="py-2 px-2.5 text-[10px] uppercase tracking-wider">{lang === 'ar' ? 'الأدوية النشطة' : 'Active Meds'}</th>
                <th className="py-2 px-2.5 text-[10px] uppercase tracking-wider">{lang === 'ar' ? 'الالتزام (PDC)' : 'PDC'}</th>
                <th className="py-2 px-2.5 text-[10px] uppercase tracking-wider">{lang === 'ar' ? 'نقاط الولاء' : 'Loyalty'}</th>
                <th className="py-2 px-2.5 text-[10px] uppercase tracking-wider text-center">{lang === 'ar' ? 'إدارة الملف' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EDEBE9] dark:divide-[#3b3a39] text-[#242424] dark:text-[#f3f2f1]">
              {activePatients.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-[#605E5C] dark:text-[#a19f9d]">
                    <div className="max-w-md mx-auto space-y-2">
                      <div className="w-8 h-8 bg-[#FAF9F8] dark:bg-[#2d2c2c] border border-[#EDEBE9] dark:border-[#3b3a39] rounded-[4px] flex items-center justify-center mx-auto text-[#0078D4]">
                        <Users className="w-4 h-4" />
                      </div>
                      <div className="font-semibold text-xs text-[#242424] dark:text-[#f3f2f1]">
                        {lang === 'ar' ? 'دليل المرضى فارغ حالياً' : 'Patient Directory is Empty'}
                      </div>
                      <button
                        onClick={() => onOpenPatientModal()}
                        className="inline-flex items-center gap-1 px-3 py-1 rounded-[4px] text-xs font-semibold bg-[#0078D4] hover:bg-[#106EBE] text-white transition-all cursor-pointer mt-1"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>{lang === 'ar' ? 'تسجيل مريض جديد' : 'Add First Patient'}</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ) : filteredPatients.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-[#605E5C] dark:text-[#a19f9d]">
                    {lang === 'ar' ? 'لا يوجد مرضى مطابقين لشروط البحث.' : 'No matching patients found.'}
                  </td>
                </tr>
              ) : (
                paginatedPatients.map(p => {
                  const pdc = calculatePDC(p);
                  return (
                    <tr key={p.id} className="hover:bg-[#F3F2F1] dark:hover:bg-[#323130] transition-colors">
                      <td className="py-1.5 px-2.5 font-mono text-[#605E5C] dark:text-[#a19f9d] text-[10px]">{p.id}</td>
                      <td className="py-1.5 px-2.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <button
                            onClick={() => onOpenPatientModal(p.id)}
                            className="font-bold text-[#0078D4] hover:underline text-right transition-colors cursor-pointer block text-xs"
                          >
                            {p.name}
                          </button>
                          {p.phoneUnavailable ? (
                            <span className="text-[10px] text-[#A80000] bg-red-50 dark:bg-red-950/50 px-1.5 py-0.2 rounded font-mono">
                              {lang === 'ar' ? 'بدون هاتف' : 'No phone'}
                            </span>
                          ) : (
                            <span className="text-[10px] text-[#605E5C] dark:text-[#a19f9d] font-mono" dir="ltr">
                              {p.phone}
                            </span>
                          )}
                        </div>
                        <div className="mt-0.5">{renderAllergyBadge(p)}</div>
                      </td>
                      <td className="py-1.5 px-2.5 text-[#605E5C] dark:text-[#a19f9d] text-[11px]">
                        {p.age ? `${p.age}y` : '—'} / {p.gender || '—'}
                      </td>
                      <td className="py-1.5 px-2.5">
                        {p.familyTag ? (
                          <button
                            onClick={() => onOpenHouseholdModal(p.familyTag!)}
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[4px] text-[10px] font-semibold bg-[#EFF6FC] dark:bg-[#112338] text-[#0078D4] border border-[#C7E0F4] dark:border-[#1e4a6f] hover:bg-[#DEECF9] transition-colors cursor-pointer"
                          >
                            <span>{p.familyTag}</span>
                          </button>
                        ) : (
                          <span className="text-[#605E5C] dark:text-[#a19f9d] text-[10px]">{lang === 'ar' ? 'فردي' : 'Solo'}</span>
                        )}
                      </td>
                      <td className="py-1.5 px-2.5">
                        <span className="font-semibold text-[#242424] dark:text-[#f3f2f1] text-[11px]">
                          {(p.medications || []).length} {lang === 'ar' ? 'أدوية' : 'meds'}
                        </span>
                        <div className="text-[10px] text-[#605E5C] dark:text-[#a19f9d] truncate max-w-[180px]" dir="ltr">
                          {(p.medications || []).map(m => m.name).join(', ')}
                        </div>
                      </td>
                      <td className="py-1.5 px-2.5">
                        <span
                          className={`inline-block font-mono font-semibold px-1.5 py-0.2 rounded-[4px] text-[10px] ${
                            pdc >= 80
                              ? 'bg-[#EFF6FC] dark:bg-[#112338] text-[#0078D4] border border-[#C7E0F4] dark:border-[#1e4a6f]'
                              : 'bg-[#FDF3F3] dark:bg-[#3a1d1d] text-[#A80000] dark:text-[#f1707b] border border-[#E0A8A8] dark:border-[#6e3535]'
                          }`}
                        >
                          {pdc}%
                        </span>
                      </td>
                      <td className="py-1.5 px-2.5">
                        <span className="inline-flex items-center gap-1 font-semibold font-mono text-[#242424] dark:text-[#f3f2f1] border border-[#EDEBE9] dark:border-[#3b3a39] bg-[#FAF9F8] dark:bg-[#2d2c2c] px-1.5 py-0.2 rounded-[4px] text-[10px]">
                          <Star className="w-2.5 h-2.5 text-[#0078D4]" />
                          <span>{p.loyaltyPoints || 0}</span>
                        </span>
                      </td>
                      <td className="py-1.5 px-2.5">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => onOpenPatientModal(p.id)}
                            className="min-h-[44px] px-2.5 py-1 rounded-[4px] bg-[#FFFFFF] dark:bg-[#252423] hover:bg-[#F3F2F1] dark:hover:bg-[#323130] text-[#242424] dark:text-[#f3f2f1] border border-[#EDEBE9] dark:border-[#3b3a39] transition-colors font-semibold text-xs cursor-pointer flex items-center justify-center gap-1"
                          >
                            <FileText className="w-3.5 h-3.5 text-[#0078D4]" />
                            <span>{lang === 'ar' ? 'الملف' : 'Dossier'}</span>
                          </button>
                          <button
                            onClick={() => onOpenPatientModal(p.id, 'analytics')}
                            title={lang === 'ar' ? 'عرض مخطط الالتزام' : 'Adherence Chart'}
                            className="min-h-[44px] min-w-[44px] flex items-center justify-center p-1.5 rounded-[4px] bg-[#FFFFFF] dark:bg-[#252423] hover:bg-[#F3F2F1] dark:hover:bg-[#323130] text-[#605E5C] dark:text-[#a19f9d] border border-[#EDEBE9] dark:border-[#3b3a39] cursor-pointer"
                          >
                            <LineChart className="w-3.5 h-3.5" />
                          </button>
                          {p.familyTag && (
                            <button
                              onClick={() => onOpenHouseholdModal(p.familyTag!)}
                              title={lang === 'ar' ? 'توحيد صرف العائلة' : 'Sync Family'}
                              className="min-h-[44px] px-2 py-1 rounded-[4px] bg-[#EFF6FC] dark:bg-[#112338] text-[#0078D4] border border-[#C7E0F4] dark:border-[#1e4a6f] text-xs font-semibold cursor-pointer flex items-center justify-center"
                            >
                              Sync
                            </button>
                          )}
                          <button
                            onClick={() => onArchivePatient(p.id)}
                            title={lang === 'ar' ? 'أرشفة' : 'Archive'}
                            className="min-h-[44px] min-w-[44px] flex items-center justify-center p-1.5 rounded-[4px] bg-[#FFFFFF] dark:bg-[#252423] hover:bg-[#FDF3F3] dark:hover:bg-[#3a1d1d] text-[#605E5C] hover:text-[#A80000] border border-[#EDEBE9] dark:border-[#3b3a39] cursor-pointer"
                          >
                            <Archive className="w-3.5 h-3.5" />
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

        {/* Mobile View: Fixed Ultra-Compact Stacked Patient Cards (Zero horizontal swiping) */}
        <div className="block md:hidden divide-y divide-[#EDEBE9] dark:divide-[#3b3a39]">
          {filteredPatients.length === 0 ? (
            <div className="p-4 text-center text-xs text-[#605E5C] dark:text-[#a19f9d]">
              {lang === 'ar' ? 'لا يوجد مرضى مطابقون' : 'No matching patients'}
            </div>
          ) : (
            paginatedPatients.map(p => {
              const pdc = calculatePDC(p);
              return (
                <div key={p.id} className="p-2 bg-white dark:bg-[#201f1e] space-y-1">
                  <div className="flex items-center justify-between gap-1.5">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <button
                          onClick={() => onOpenPatientModal(p.id)}
                          className="text-xs font-bold text-[#0078D4] hover:underline text-right block truncate"
                        >
                          {p.name}
                        </button>
                        <span className="font-mono text-[9px] text-[#605E5C] dark:text-[#a19f9d]">{p.id}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[10px] text-[#605E5C] dark:text-[#a19f9d] mt-0.5">
                        {p.phoneUnavailable ? (
                          <span className="text-[9px] text-[#A80000] font-semibold">{lang === 'ar' ? 'بدون هاتف' : 'No phone'}</span>
                        ) : (
                          <span dir="ltr" className="font-mono text-[9px]">{p.phone}</span>
                        )}
                        <span>•</span>
                        <span>{p.age ? `${p.age}y` : '—'} / {p.gender || '—'}</span>
                      </div>
                    </div>

                    <button
                      onClick={() => onOpenPatientModal(p.id)}
                      className="px-2 py-1 bg-[#0078D4] hover:bg-[#106EBE] text-white text-[11px] font-semibold rounded-[4px] shrink-0 flex items-center gap-1 cursor-pointer"
                    >
                      <FileText className="w-3 h-3" />
                      <span>{lang === 'ar' ? 'الملف' : 'View'}</span>
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center gap-1 text-[10px] pt-0.5">
                    {renderAllergyBadge(p)}
                    <span className={`font-mono text-[9px] px-1.5 py-0.2 rounded-[4px] ${
                      pdc >= 80 ? 'bg-[#EFF6FC] dark:bg-[#112338] text-[#0078D4] border border-[#C7E0F4] dark:border-[#1e4a6f]' : 'bg-[#FDF3F3] dark:bg-[#3a1d1d] text-[#A80000] border border-[#E0A8A8]'
                    }`}>
                      PDC: {pdc}%
                    </span>
                    {p.familyTag && (
                      <button
                        onClick={() => onOpenHouseholdModal(p.familyTag!)}
                        className="px-1.5 py-0.2 text-[9px] font-semibold bg-[#EFF6FC] dark:bg-[#112338] text-[#0078D4] rounded-[4px] border border-[#C7E0F4] dark:border-[#1e4a6f]"
                      >
                        {p.familyTag}
                      </button>
                    )}
                    <span className="text-[#605E5C] dark:text-[#a19f9d] text-[9px] font-semibold">
                      {(p.medications || []).length} {lang === 'ar' ? 'أدوية' : 'meds'}
                    </span>
                    <span className="inline-flex items-center gap-0.5 font-mono text-[#242424] dark:text-[#f3f2f1] bg-[#FAF9F8] dark:bg-[#2d2c2c] border border-[#EDEBE9] dark:border-[#3b3a39] px-1 py-0.2 rounded-[4px] text-[9px]">
                      <Star className="w-2.5 h-2.5 text-[#0078D4]" />
                      <span>{p.loyaltyPoints || 0}</span>
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* High-Performance Pagination Footer */}
        {filteredPatients.length > 0 && (
          <div className="bg-[#FAF9F8] dark:bg-[#2d2c2c] border-t border-[#EDEBE9] dark:border-[#3b3a39] px-4 py-2.5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            {/* Range Counter */}
            <div className="flex items-center gap-3 text-[#242424] dark:text-[#f3f2f1] flex-wrap">
              <span className="font-mono text-[#605E5C] dark:text-[#a19f9d]">
                {lang === 'ar'
                  ? `عرض ${startRecord} - ${endRecord} من إجمالي ${filteredPatients.length} مريض`
                  : `Showing ${startRecord}-${endRecord} of ${filteredPatients.length} patients`}
              </span>
            </div>

            {/* Page Buttons */}
            {pageSize !== -1 && totalPages > 1 && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentPage(1)}
                  disabled={validCurrentPage <= 1}
                  className="p-1 rounded-[4px] bg-[#FFFFFF] dark:bg-[#252423] hover:bg-[#F3F2F1] dark:hover:bg-[#323130] text-[#242424] dark:text-[#f3f2f1] disabled:opacity-30 disabled:cursor-not-allowed border border-[#EDEBE9] dark:border-[#3b3a39] cursor-pointer transition-colors"
                  title={lang === 'ar' ? 'الصفحة الأولى' : 'First page'}
                >
                  <ChevronsRight className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={validCurrentPage <= 1}
                  className="flex items-center gap-1 px-2 py-1 rounded-[4px] bg-[#FFFFFF] dark:bg-[#252423] hover:bg-[#F3F2F1] dark:hover:bg-[#323130] text-[#242424] dark:text-[#f3f2f1] disabled:opacity-30 disabled:cursor-not-allowed border border-[#EDEBE9] dark:border-[#3b3a39] font-semibold cursor-pointer transition-colors"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                  <span>{lang === 'ar' ? 'السابق' : 'Prev'}</span>
                </button>

                {/* Page Jump Selector */}
                <div className="flex items-center gap-1 px-2 font-semibold font-mono text-[#242424] dark:text-[#f3f2f1]">
                  <span>{validCurrentPage}</span>
                  <span className="text-[#605E5C] dark:text-[#a19f9d]">/</span>
                  <span>{totalPages}</span>
                </div>

                <button
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={validCurrentPage >= totalPages}
                  className="flex items-center gap-1 px-2 py-1 rounded-[4px] bg-[#FFFFFF] dark:bg-[#252423] hover:bg-[#F3F2F1] dark:hover:bg-[#323130] text-[#242424] dark:text-[#f3f2f1] disabled:opacity-30 disabled:cursor-not-allowed border border-[#EDEBE9] dark:border-[#3b3a39] font-semibold cursor-pointer transition-colors"
                >
                  <span>{lang === 'ar' ? 'التالي' : 'Next'}</span>
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={validCurrentPage >= totalPages}
                  className="p-1 rounded-[4px] bg-[#FFFFFF] dark:bg-[#252423] hover:bg-[#F3F2F1] dark:hover:bg-[#323130] text-[#242424] dark:text-[#f3f2f1] disabled:opacity-30 disabled:cursor-not-allowed border border-[#EDEBE9] dark:border-[#3b3a39] cursor-pointer transition-colors"
                  title={lang === 'ar' ? 'الصفحة الأخيرة' : 'Last page'}
                >
                  <ChevronsLeft className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
