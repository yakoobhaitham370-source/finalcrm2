import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Stethoscope,
  X,
  Check,
  Search,
  User,
  Phone,
  ChevronDown,
  Pill,
  AlertTriangle,
  Users,
} from 'lucide-react';
import { Patient, FollowUpEntry, FollowUpType } from '../../types/pharmacy';
import { formatYMD, parseLocalDate } from '../../utils/pharmacyCalculations';

interface FollowUpModalProps {
  isOpen: boolean;
  onClose: () => void;
  patients: Patient[];
  lang: 'ar' | 'en';
  onAddFollowUp: (entry: Omit<FollowUpEntry, 'id' | 'createdAt'>) => void;
  onShowToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  initialPatientId?: string;
}

const normalizeSearchText = (str: string): string => {
  if (!str) return '';
  return str
    .toLowerCase()
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[\u064B-\u065F]/g, '')
    .trim();
};

export const FollowUpModal: React.FC<FollowUpModalProps> = ({
  isOpen,
  onClose,
  patients,
  lang,
  onAddFollowUp,
  onShowToast,
  initialPatientId,
}) => {
  const activePatients = useMemo(() => patients.filter(p => !p.isArchived), [patients]);

  const [patientId, setPatientId] = useState<string>(initialPatientId || activePatients[0]?.id || '');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isDropdownOpen, setIsDropdownOpen] = useState<boolean>(false);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);

  const [type, setType] = useState<FollowUpType>('ANTIBIOTIC');
  const [drug, setDrug] = useState<string>('');
  const [startDateStr, setStartDateStr] = useState<string>(formatYMD(new Date()));
  const [daysOffset, setDaysOffset] = useState<number>(3);
  const [notes, setNotes] = useState<string>('');

  const comboboxRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Sync state when modal opens
  useEffect(() => {
    if (isOpen) {
      const targetId = initialPatientId || (patientId && activePatients.some(p => p.id === patientId) ? patientId : activePatients[0]?.id || '');
      setPatientId(targetId);
      const selected = activePatients.find(p => p.id === targetId);
      setSearchQuery(selected ? selected.name : '');
      setIsDropdownOpen(false);
      setHighlightedIndex(-1);
    }
  }, [isOpen, initialPatientId]);

  // Click outside listener for combobox
  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (comboboxRef.current && !comboboxRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
        const selected = activePatients.find(p => p.id === patientId);
        if (selected) {
          setSearchQuery(selected.name);
        }
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [activePatients, patientId]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (isDropdownOpen && highlightedIndex >= 0 && listRef.current) {
      const items = listRef.current.querySelectorAll('[data-patient-item]');
      const activeEl = items[highlightedIndex] as HTMLElement | undefined;
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlightedIndex, isDropdownOpen]);

  const selectedPatient = useMemo(() => {
    return activePatients.find(p => p.id === patientId);
  }, [activePatients, patientId]);

  const filteredPatients = useMemo(() => {
    const query = normalizeSearchText(searchQuery);
    if (!query) {
      return [...activePatients].sort((a, b) => a.name.localeCompare(b.name, lang === 'ar' ? 'ar' : 'en'));
    }
    return activePatients.filter(p => {
      const nameNorm = normalizeSearchText(p.name);
      const phoneNorm = (p.phone || '').replace(/\D/g, '');
      const queryDigits = query.replace(/\D/g, '');
      const idNorm = normalizeSearchText(p.id);
      const familyNorm = normalizeSearchText(p.familyTag || '');

      return (
        nameNorm.includes(query) ||
        (queryDigits && phoneNorm.includes(queryDigits)) ||
        idNorm.includes(query) ||
        familyNorm.includes(query)
      );
    });
  }, [activePatients, searchQuery, lang]);

  if (!isOpen) return null;

  const handleSelectPatient = (p: Patient) => {
    setPatientId(p.id);
    setSearchQuery(p.name);
    setIsDropdownOpen(false);
    setHighlightedIndex(-1);
  };

  const handleClearPatient = () => {
    setPatientId('');
    setSearchQuery('');
    setIsDropdownOpen(true);
    setHighlightedIndex(-1);
    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 50);
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!isDropdownOpen) {
        setIsDropdownOpen(true);
        setHighlightedIndex(0);
      } else {
        setHighlightedIndex(prev => (prev + 1 < filteredPatients.length ? prev + 1 : 0));
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!isDropdownOpen) {
        setIsDropdownOpen(true);
        setHighlightedIndex(filteredPatients.length - 1);
      } else {
        setHighlightedIndex(prev => (prev - 1 >= 0 ? prev - 1 : filteredPatients.length - 1));
      }
    } else if (e.key === 'Enter') {
      if (isDropdownOpen && highlightedIndex >= 0 && filteredPatients[highlightedIndex]) {
        e.preventDefault();
        handleSelectPatient(filteredPatients[highlightedIndex]);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsDropdownOpen(false);
    }
  };

  const handleTypeChange = (newType: FollowUpType) => {
    setType(newType);
    if (newType === 'ANTIBIOTIC') setDaysOffset(3);
    else if (newType === 'CHRONIC_INIT') setDaysOffset(7);
    else if (newType === 'TITRATION') setDaysOffset(14);
    else setDaysOffset(30);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const patient = activePatients.find(p => p.id === patientId);
    if (!patient) {
      onShowToast(lang === 'ar' ? 'يرجى اختيار مريض للمتابعة السريرية' : 'Please select a patient for clinical follow-up', 'error');
      searchInputRef.current?.focus();
      return;
    }
    if (!drug.trim()) {
      onShowToast(lang === 'ar' ? 'يرجى إدخال اسم الدواء' : 'Please enter medication name', 'error');
      return;
    }

    const start = parseLocalDate(startDateStr);
    const dueDate = new Date(start.getFullYear(), start.getMonth(), start.getDate() + daysOffset);

    onAddFollowUp({
      patientId: patient.id,
      patientName: patient.name,
      phone: patient.phone,
      type,
      drug: drug.trim(),
      startDate: startDateStr,
      dueDate: formatYMD(dueDate),
      daysOffset,
      notes: notes.trim(),
      resolved: false,
    });

    onClose();
    onShowToast(lang === 'ar' ? 'تم تسجيل خطة المتابعة السريرية بنجاح' : 'Clinical follow-up registered', 'success');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-[#FFFFFF] dark:bg-[#201f1e] border border-[#EDEBE9] dark:border-[#3b3a39] rounded-[4px] max-w-lg w-full shadow-lg overflow-visible flex flex-col text-[#242424] dark:text-[#f3f2f1]">
        {/* Header */}
        <div className="p-4 bg-[#FAF9F8] dark:bg-[#2d2c2c] border-b border-[#EDEBE9] dark:border-[#3b3a39] flex items-center justify-between">
          <div className="font-semibold text-base text-[#242424] dark:text-[#f3f2f1] flex items-center gap-2">
            <Stethoscope className="w-5 h-5 text-[#0078D4] dark:text-[#2899f5]" />
            <span>{lang === 'ar' ? 'تسجيل متابعة سريرية جديدة' : 'New Clinical Follow-Up'}</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-[4px] text-[#605E5C] dark:text-[#a19f9d] hover:text-[#242424] dark:hover:text-[#f3f2f1] hover:bg-[#EDEBE9] dark:hover:bg-[#3b3a39] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-4 text-xs">
          {/* Searchable Patient Combobox */}
          <div className="space-y-1 relative" ref={comboboxRef}>
            <div className="flex items-center justify-between">
              <label className="font-semibold text-[#242424] dark:text-[#f3f2f1] flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-[#0078D4] dark:text-[#2899f5]" />
                <span>{lang === 'ar' ? 'اختر المريض (اكتب الاسم للبحث السريع) *' : 'Select Patient (Type name to search fast) *'}</span>
              </label>
              {selectedPatient && (
                <button
                  type="button"
                  onClick={handleClearPatient}
                  className="text-[11px] text-[#0078D4] dark:text-[#2899f5] hover:underline cursor-pointer flex items-center gap-1"
                >
                  <X className="w-3 h-3" />
                  <span>{lang === 'ar' ? 'تغيير أو مسح' : 'Change / Clear'}</span>
                </button>
              )}
            </div>

            {/* Input with Search Icon and Controls */}
            <div className="relative">
              <div className="absolute inset-y-0 start-0 flex items-center ps-2.5 pointer-events-none text-[#605E5C] dark:text-[#a19f9d]">
                <Search className="w-3.5 h-3.5" />
              </div>
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={e => {
                  setSearchQuery(e.target.value);
                  setIsDropdownOpen(true);
                  setHighlightedIndex(0);
                }}
                onFocus={() => {
                  setIsDropdownOpen(true);
                }}
                onKeyDown={handleInputKeyDown}
                placeholder={
                  lang === 'ar'
                    ? 'اكتب اسم المريض أو رقم الهاتف للوصول السريع...'
                    : 'Type patient name or phone number for quick access...'
                }
                className="w-full bg-[#FFFFFF] dark:bg-[#252423] border border-[#EDEBE9] dark:border-[#3b3a39] text-[#242424] dark:text-[#f3f2f1] rounded-[4px] py-2 ps-8 pe-16 outline-none focus:border-[#0078D4] dark:focus:border-[#2899f5] focus:ring-1 focus:ring-[#0078D4] transition-all placeholder:text-[#8A8886]"
                autoComplete="off"
              />
              <div className="absolute inset-y-0 end-0 flex items-center pe-2 gap-1">
                {searchQuery && (
                  <button
                    type="button"
                    onClick={handleClearPatient}
                    className="p-1 rounded text-[#605E5C] dark:text-[#a19f9d] hover:text-[#242424] dark:hover:text-[#f3f2f1] hover:bg-[#F3F2F1] dark:hover:bg-[#2d2c2c] cursor-pointer"
                    title={lang === 'ar' ? 'مسح البحث' : 'Clear search'}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsDropdownOpen(prev => !prev)}
                  className="p-1 rounded text-[#605E5C] dark:text-[#a19f9d] hover:text-[#242424] dark:hover:text-[#f3f2f1] hover:bg-[#F3F2F1] dark:hover:bg-[#2d2c2c] cursor-pointer"
                  title={lang === 'ar' ? 'عرض القائمة' : 'Toggle list'}
                >
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
                </button>
              </div>
            </div>

            {/* Search Results Dropdown */}
            {isDropdownOpen && (
              <div className="absolute left-0 right-0 top-full mt-1 z-30 bg-[#FFFFFF] dark:bg-[#201f1e] border border-[#EDEBE9] dark:border-[#3b3a39] rounded-[4px] shadow-lg overflow-hidden flex flex-col">
                <div className="px-3 py-1.5 bg-[#FAF9F8] dark:bg-[#2d2c2c] border-b border-[#EDEBE9] dark:border-[#3b3a39] text-[11px] text-[#605E5C] dark:text-[#a19f9d] flex items-center justify-between">
                  <span>
                    {filteredPatients.length}{' '}
                    {lang === 'ar' ? 'مريض متاح' : 'patients found'}
                  </span>
                  <span className="text-[10px] text-[#8A8886]">
                    {lang === 'ar' ? 'استخدم الأسهم ⇅ و Enter للاختيار' : 'Use ⇅ and Enter to select'}
                  </span>
                </div>

                <div ref={listRef} className="max-h-52 overflow-y-auto divide-y divide-[#EDEBE9] dark:divide-[#3b3a39]">
                  {filteredPatients.length === 0 ? (
                    <div className="p-4 text-center text-[#605E5C] dark:text-[#a19f9d]">
                      <p className="font-semibold">{lang === 'ar' ? 'لم يتم العثور على أي مريض' : 'No patients found'}</p>
                      <p className="text-[11px] text-[#8A8886] mt-0.5">
                        {lang === 'ar' ? 'تحقق من صحة الاسم المكتوب أو رقم الهاتف' : 'Check spelling or try a phone number'}
                      </p>
                    </div>
                  ) : (
                    filteredPatients.map((p, index) => {
                      const isSelected = p.id === patientId;
                      const isHighlighted = index === highlightedIndex;
                      return (
                        <div
                          key={p.id}
                          data-patient-item
                          onMouseEnter={() => setHighlightedIndex(index)}
                          onClick={() => handleSelectPatient(p)}
                          className={`px-3 py-2 cursor-pointer flex items-center justify-between gap-2 transition-colors ${
                            isSelected
                              ? 'bg-[#EFF6FC] dark:bg-[#112338] border-s-4 border-[#0078D4]'
                              : isHighlighted
                              ? 'bg-[#F3F2F1] dark:bg-[#252423]'
                              : 'hover:bg-[#F3F2F1] dark:hover:bg-[#252423]'
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-[#242424] dark:text-[#f3f2f1] truncate">{p.name}</span>
                              {p.familyTag && (
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 bg-[#FAF9F8] dark:bg-[#252423] border border-[#EDEBE9] dark:border-[#3b3a39] text-[#605E5C] dark:text-[#a19f9d] rounded-[3px] text-[10px]">
                                  <Users className="w-2.5 h-2.5 text-[#0078D4] dark:text-[#2899f5]" />
                                  {p.familyTag}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-3 text-[11px] text-[#605E5C] dark:text-[#a19f9d] mt-0.5">
                              <span className="font-mono flex items-center gap-1">
                                <Phone className="w-3 h-3 text-[#8A8886]" />
                                {p.phone || (lang === 'ar' ? 'بدون هاتف' : 'No phone')}
                              </span>
                              {p.medications && p.medications.length > 0 && (
                                <span className="flex items-center gap-1 text-[#0078D4] dark:text-[#2899f5]">
                                  <Pill className="w-3 h-3" />
                                  {p.medications.length} {lang === 'ar' ? 'أدوية' : 'meds'}
                                </span>
                              )}
                            </div>
                          </div>
                          {isSelected && <Check className="w-4 h-4 text-[#0078D4] dark:text-[#2899f5] shrink-0" />}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* Selected Patient Overview Card */}
            {selectedPatient && (
              <div className="mt-2 p-2.5 bg-[#FAF9F8] dark:bg-[#252423] border border-[#EDEBE9] dark:border-[#3b3a39] rounded-[4px] flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-7 h-7 rounded-[4px] bg-[#EFF6FC] dark:bg-[#112338] text-[#0078D4] dark:text-[#60a5fa] border border-[#C7E0F4] dark:border-[#1e3a8a] flex items-center justify-center shrink-0 font-semibold text-xs">
                    {selectedPatient.name.trim().charAt(0) || 'P'}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-[#242424] dark:text-[#f3f2f1] truncate">{selectedPatient.name}</span>
                      <span className="font-mono text-[11px] text-[#605E5C] dark:text-[#a19f9d]">({selectedPatient.phone})</span>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-[#605E5C] dark:text-[#a19f9d] mt-0.5">
                      {selectedPatient.age && (
                        <span>
                          {selectedPatient.age} {lang === 'ar' ? 'سنة' : 'y/o'}
                        </span>
                      )}
                      <span>•</span>
                      <span>
                        {selectedPatient.medications?.length || 0} {lang === 'ar' ? 'أدوية نشطة' : 'active meds'}
                      </span>
                    </div>
                  </div>
                </div>
                {selectedPatient.allergies && (
                  <div className="shrink-0 flex items-center gap-1 px-2 py-1 bg-[#FFF4CE] dark:bg-[#3a3118] border border-[#FFE699] dark:border-[#854d0e] text-[#7A5B00] dark:text-[#fde047] rounded-[3px] text-[10px] font-medium max-w-[150px] truncate" title={selectedPatient.allergies}>
                    <AlertTriangle className="w-3 h-3 text-[#A80000] dark:text-[#f87171] shrink-0" />
                    <span className="truncate">{selectedPatient.allergies}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="font-semibold text-[#242424] dark:text-[#f3f2f1]">
                {lang === 'ar' ? 'نوع المتابعة السريرية *' : 'Follow-Up Category *'}
              </label>
              <select
                value={type}
                onChange={e => handleTypeChange(e.target.value as FollowUpType)}
                className="w-full bg-[#FFFFFF] dark:bg-[#252423] border border-[#EDEBE9] dark:border-[#3b3a39] text-[#242424] dark:text-[#f3f2f1] rounded-[4px] p-2 outline-none focus:border-[#0078D4] dark:focus:border-[#2899f5]"
              >
                <option value="ANTIBIOTIC">مضاد حيوي (Stewardship)</option>
                <option value="CHRONIC_INIT">بدء علاج مزمن جديد</option>
                <option value="TITRATION">معايرة جرعة (Titration)</option>
                <option value="SIDE_EFFECT">رصد أعراض جانبية</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-[#242424] dark:text-[#f3f2f1]">
                {lang === 'ar' ? 'اسم العلاج / المضاد *' : 'Medication / Antibiotic *'}
              </label>
              <input
                type="text"
                value={drug}
                onChange={e => setDrug(e.target.value)}
                placeholder="Augmentin 1g, Glucophage..."
                className="w-full bg-[#FFFFFF] dark:bg-[#252423] border border-[#EDEBE9] dark:border-[#3b3a39] text-[#242424] dark:text-[#f3f2f1] rounded-[4px] p-2 outline-none focus:border-[#0078D4] dark:focus:border-[#2899f5]"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="font-semibold text-[#242424] dark:text-[#f3f2f1]">
                {lang === 'ar' ? 'تاريخ البدء أو الصرف' : 'Start Date'}
              </label>
              <input
                type="date"
                value={startDateStr}
                onChange={e => setStartDateStr(e.target.value)}
                className="w-full bg-[#FFFFFF] dark:bg-[#252423] border border-[#EDEBE9] dark:border-[#3b3a39] text-[#242424] dark:text-[#f3f2f1] rounded-[4px] p-2 outline-none focus:border-[#0078D4] dark:focus:border-[#2899f5] font-mono"
              />
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-[#242424] dark:text-[#f3f2f1]">
                {lang === 'ar' ? 'موعد المتابعة (بعد كم يوم؟)' : 'Milestone Timing'}
              </label>
              <select
                value={daysOffset}
                onChange={e => setDaysOffset(parseInt(e.target.value, 10))}
                className="w-full bg-[#FFFFFF] dark:bg-[#252423] border border-[#EDEBE9] dark:border-[#3b3a39] text-[#242424] dark:text-[#f3f2f1] rounded-[4px] p-2 outline-none focus:border-[#0078D4] dark:focus:border-[#2899f5]"
              >
                <option value={3}>بعد 3 أيام (استجابة أولية / حرارة / تقبل)</option>
                <option value={7}>بعد 7 أيام (إكمال كورس مضاد / استقرار)</option>
                <option value={14}>بعد 14 يوم (معايرة خافض ضغط أو سكر)</option>
                <option value={30}>بعد 30 يوم (فحص وظائف أو آلام عضلات الستاتين)</option>
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label className="font-semibold text-[#242424] dark:text-[#f3f2f1]">
              {lang === 'ar' ? 'ملاحظات الاستشارة والتعليمات الخاصة' : 'Counseling & Clinical Notes'}
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="مثال: تم التنبيه على أخذ العلاج بعد الطعام ومراقبة هبوط الحرارة..."
              className="w-full bg-[#FFFFFF] dark:bg-[#252423] border border-[#EDEBE9] dark:border-[#3b3a39] text-[#242424] dark:text-[#f3f2f1] rounded-[4px] p-2 outline-none focus:border-[#0078D4] dark:focus:border-[#2899f5]"
            />
          </div>

          {/* Footer */}
          <div className="pt-3 border-t border-[#EDEBE9] dark:border-[#3b3a39] flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-[4px] bg-[#FFFFFF] dark:bg-[#252423] hover:bg-[#F3F2F1] dark:hover:bg-[#3b3a39] text-[#242424] dark:text-[#f3f2f1] font-semibold border border-[#EDEBE9] dark:border-[#3b3a39] transition-colors cursor-pointer"
            >
              {lang === 'ar' ? 'إلغاء' : 'Cancel'}
            </button>
            <button
              type="submit"
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-[4px] bg-[#0078D4] hover:bg-[#106EBE] active:bg-[#005A9E] text-white font-semibold transition-colors cursor-pointer border-0 shadow-none"
            >
              <Check className="w-4 h-4 text-white" />
              <span>{lang === 'ar' ? 'حفظ وتفعيل خطة المتابعة' : 'Activate Follow-Up'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

