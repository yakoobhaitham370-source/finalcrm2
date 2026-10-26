import React, { useState, useRef, useEffect } from 'react';
import {
  RefreshCw,
  Globe,
  Sun,
  Moon,
  Plus,
  Stethoscope,
  Search,
  X,
  User,
  Phone,
  ArrowRight,
  ArrowLeft,
  Pill,
  Sparkles,
  Loader2,
  ExternalLink,
} from 'lucide-react';
import { Patient } from '../types/pharmacy';
import { calculatePDC } from '../utils/pharmacyCalculations';

interface HeaderProps {
  pharmacyName: string;
  currentTime?: string;
  syncStatus: 'synced' | 'syncing' | 'error' | 'idle';
  syncMessage: string;
  onSync: () => void;
  lang: 'ar' | 'en';
  onToggleLang: () => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  onOpenNewPatient: () => void;
  onOpenNewFollowUp: () => void;

  // Global Search Props
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onClearSearch: () => void;
  matchingPatients: Patient[];
  isDebouncing?: boolean;
  onSelectPatient: (patientId: string) => void;
  onViewAllResults: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  pharmacyName,
  currentTime: externalCurrentTime,
  syncStatus,
  syncMessage,
  onSync,
  lang,
  onToggleLang,
  theme,
  onToggleTheme,
  onOpenNewPatient,
  onOpenNewFollowUp,
  searchQuery,
  onSearchChange,
  onClearSearch,
  matchingPatients,
  isDebouncing = false,
  onSelectPatient,
  onViewAllResults,
}) => {
  const [internalTime, setInternalTime] = useState<string>(() => new Date().toTimeString().split(' ')[0]);

  useEffect(() => {
    const timer = setInterval(() => {
      setInternalTime(new Date().toTimeString().split(' ')[0]);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const currentTime = externalCurrentTime || internalTime;
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
        setIsDropdownOpen(true);
      } else if (
        e.key === '/' &&
        document.activeElement?.tagName !== 'INPUT' &&
        document.activeElement?.tagName !== 'TEXTAREA'
      ) {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
        setIsDropdownOpen(true);
      } else if (e.key === 'Escape') {
        setIsDropdownOpen(false);
        inputRef.current?.blur();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onViewAllResults();
      setIsDropdownOpen(false);
    }
  };

  const hasSearchText = searchQuery.trim().length > 0;
  const isArabic = lang === 'ar';
  const ArrowIcon = ArrowLeft;

  return (
    <header className="h-14 bg-white dark:bg-[#201f1e] border-b border-[#EDEBE9] dark:border-[#3b3a39] px-4 md:px-6 flex items-center justify-between gap-3 sticky top-0 z-40 transition-colors duration-200">
      {/* Brand */}
      <div className="flex items-center gap-3 shrink-0">
        <div className="w-8 h-8 bg-[#0078D4] text-white flex items-center justify-center font-bold text-base rounded-[4px] shrink-0">
          Rx
        </div>
        <div className="hidden sm:block">
          <div className="font-bold text-sm tracking-tight text-[#242424] dark:text-[#f3f2f1] flex items-center gap-2">
            <span>PharmPulse</span>
            <span className="hidden md:inline-block text-[10px] uppercase font-semibold tracking-wider px-1.5 py-0.2 border border-[#0078D4] text-[#0078D4] rounded-[4px]">
              CRM
            </span>
          </div>
          <div className="text-xs text-[#605E5C] dark:text-[#a19f9d] font-normal truncate max-w-[140px] md:max-w-none">
            {pharmacyName || (isArabic ? 'صيدلية النبض السريرية' : 'Clinical Pharmacy Engine')}
          </div>
        </div>
      </div>

      {/* Global Real-Time Search Bar (Fluent UI Underlined Style) */}
      <div
        ref={searchContainerRef}
        className="flex-1 max-w-xs sm:max-w-sm md:max-w-md lg:max-w-lg relative mx-2"
      >
        <div
          className={`flex items-center gap-2 px-2 py-1.5 border-b text-xs bg-transparent transition-all ${
            isDropdownOpen && hasSearchText
              ? 'border-b-2 border-[#0078D4]'
              : 'border-[#EDEBE9] dark:border-[#3b3a39] hover:border-[#0078D4] focus-within:border-b-2 focus-within:border-[#0078D4]'
          }`}
        >
          <Search className="w-4 h-4 text-[#605E5C] dark:text-[#a19f9d] shrink-0" />
          
          <input
            ref={inputRef}
            type="text"
            value={searchQuery}
            onChange={e => {
              onSearchChange(e.target.value);
              if (!isDropdownOpen) setIsDropdownOpen(true);
            }}
            onFocus={() => {
              if (hasSearchText) setIsDropdownOpen(true);
            }}
            onKeyDown={handleInputKeyDown}
            placeholder={
              isArabic
                ? 'بحث فوري عن مريض بالاسم أو الهاتف... (Ctrl+K)'
                : 'Search patient by name or phone... (Ctrl+K)'
            }
            className="w-full bg-transparent text-[#242424] dark:text-[#f3f2f1] placeholder-[#605E5C] dark:placeholder-[#a19f9d] outline-none text-xs"
          />

          {isDebouncing ? (
            <Loader2 className="w-3.5 h-3.5 text-[#0078D4] animate-spin shrink-0" />
          ) : hasSearchText ? (
            <button
              onClick={() => {
                onClearSearch();
                inputRef.current?.focus();
              }}
              title={isArabic ? 'مسح البحث' : 'Clear search'}
              className="p-0.5 text-[#605E5C] dark:text-[#a19f9d] hover:text-[#242424] dark:hover:text-[#f3f2f1] cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          ) : (
            <kbd className="hidden lg:inline-flex items-center gap-0.5 text-[9px] font-mono font-medium px-1.5 py-0.2 border border-[#EDEBE9] dark:border-[#3b3a39] text-[#605E5C] dark:text-[#a19f9d] rounded-[4px] shrink-0 bg-[#FAF9F8] dark:bg-[#2d2c2c]">
              ⌘K
            </kbd>
          )}
        </div>

        {/* Real-Time Search Results Dropdown Popover */}
        {isDropdownOpen && hasSearchText && (
          <div className="absolute top-full mt-1.5 inset-x-0 bg-white dark:bg-[#252423] border border-[#EDEBE9] dark:border-[#3b3a39] z-50 overflow-hidden divide-y divide-[#EDEBE9] dark:divide-[#3b3a39] rounded-[4px] shadow-lg">
            {/* Dropdown Header */}
            <div className="px-3.5 py-2 bg-[#FAF9F8] dark:bg-[#2d2c2c] flex items-center justify-between text-xs border-b border-[#EDEBE9] dark:border-[#3b3a39]">
              <div className="font-semibold text-[#242424] dark:text-[#f3f2f1] flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#0078D4]" />
                <span>
                  {isArabic ? 'نتائج البحث السريع' : 'Real-time Search Results'}
                </span>
                <span className="px-1.5 py-0.2 font-mono font-semibold text-[10px] bg-[#0078D4] text-white rounded-[4px]">
                  {matchingPatients.length} {isArabic ? 'مطابق' : 'found'}
                </span>
              </div>
              <span className="text-[10px] text-[#605E5C] dark:text-[#a19f9d]">
                {isArabic ? 'بحث بالاسم ورقم الهاتف' : 'Matching Name & Phone'}
              </span>
            </div>

            {/* Matching Patient Results List */}
            <div className="max-h-72 overflow-y-auto divide-y divide-[#EDEBE9] dark:divide-[#3b3a39]">
              {matchingPatients.length === 0 ? (
                <div className="p-6 text-center">
                  <div className="w-8 h-8 border border-[#EDEBE9] dark:border-[#3b3a39] mx-auto flex items-center justify-center text-[#605E5C] dark:text-[#a19f9d] mb-2 rounded-[4px] bg-[#FAF9F8] dark:bg-[#2d2c2c]">
                    <Search className="w-4 h-4" />
                  </div>
                  <div className="font-semibold text-xs text-[#242424] dark:text-[#f3f2f1]">
                    {isArabic ? 'لا توجد نتائج مطابقة' : 'No patients found'}
                  </div>
                  <div className="text-xs text-[#605E5C] dark:text-[#a19f9d] mt-1 max-w-xs mx-auto">
                    {isArabic
                      ? `لم نعثر على أي مريض بالاسم أو الهاتف "${searchQuery}".`
                      : `No patient matching name or phone "${searchQuery}".`}
                  </div>
                  <button
                    onClick={() => {
                      setIsDropdownOpen(false);
                      onOpenNewPatient();
                    }}
                    className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-[#0078D4] text-white hover:bg-[#106EBE] rounded-[4px] cursor-pointer transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{isArabic ? 'تسجيل مريض جديد بهذا الاسم' : 'Add New Patient'}</span>
                  </button>
                </div>
              ) : (
                matchingPatients.slice(0, 8).map(patient => {
                  const pdc = calculatePDC(patient);
                  return (
                    <div
                      key={patient.id}
                      onClick={() => {
                        onSelectPatient(patient.id);
                        setIsDropdownOpen(false);
                      }}
                      className="p-2.5 hover:bg-[#F3F2F1] dark:hover:bg-[#323130] cursor-pointer transition-colors flex items-center justify-between gap-3 group"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-7 h-7 border border-[#EDEBE9] dark:border-[#3b3a39] text-[#0078D4] bg-[#FAF9F8] dark:bg-[#2d2c2c] flex items-center justify-center font-bold text-xs shrink-0 rounded-[4px]">
                          {patient.name.charAt(0) || <User className="w-3.5 h-3.5" />}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-semibold text-xs text-[#242424] dark:text-[#f3f2f1]">
                              {patient.name}
                            </span>
                            <span className="font-mono text-[10px] text-[#605E5C] dark:text-[#a19f9d] px-1 border border-[#EDEBE9] dark:border-[#3b3a39] rounded-[4px] bg-[#FAF9F8] dark:bg-[#2d2c2c]">
                              {patient.id}
                            </span>
                            {patient.familyTag && (
                              <span className="text-[10px] font-semibold text-[#0078D4] border border-[#0078D4]/40 px-1.5 py-0.2 rounded-[4px] flex items-center gap-0.5 bg-[#EFF6FC] dark:bg-[#112338]">
                                <span>👨‍👩‍👧‍👦</span>
                                <span>{patient.familyTag}</span>
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-xs text-[#605E5C] dark:text-[#a19f9d] mt-0.5">
                            <span className="flex items-center gap-1 font-mono text-[#242424] dark:text-[#f3f2f1]">
                              <Phone className="w-3 h-3 text-[#605E5C] dark:text-[#a19f9d]" />
                              <span dir="ltr">{patient.phone}</span>
                            </span>
                            {patient.age && (
                              <span>
                                {patient.age} {isArabic ? 'سنة' : 'yrs'}
                              </span>
                            )}
                            <span className="flex items-center gap-1">
                              <Pill className="w-3 h-3 text-[#605E5C] dark:text-[#a19f9d]" />
                              <span>
                                {(patient.medications || []).length} {isArabic ? 'أدوية' : 'meds'}
                              </span>
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded-[4px] border ${
                            pdc < 80
                              ? 'border-[#E0A8A8] dark:border-[#6e3535] text-[#A80000] dark:text-[#f1707b] bg-[#FDF3F3] dark:bg-[#3a1d1d]'
                              : 'border-[#EDEBE9] dark:border-[#3b3a39] text-[#242424] dark:text-[#f3f2f1] bg-white dark:bg-[#292827]'
                          }`}
                        >
                          {pdc}% PDC
                        </span>

                        <div className="text-[#605E5C] dark:text-[#a19f9d] group-hover:text-[#0078D4]">
                          <ExternalLink className="w-3.5 h-3.5" />
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Dropdown Footer */}
            {matchingPatients.length > 0 && (
              <div className="p-2 bg-[#FAF9F8] dark:bg-[#2d2c2c] flex items-center justify-between border-t border-[#EDEBE9] dark:border-[#3b3a39]">
                <button
                  onClick={() => {
                    onViewAllResults();
                    setIsDropdownOpen(false);
                  }}
                  className="w-full py-1.5 px-3 text-xs font-semibold text-[#0078D4] hover:bg-[#0078D4] hover:text-white transition-all flex items-center justify-center gap-2 border border-[#0078D4] rounded-[4px] cursor-pointer"
                >
                  <span>
                    {isArabic
                      ? `عرض كافة النتائج (${matchingPatients.length} مريض) في دليل المرضى`
                      : `View all (${matchingPatients.length}) results in Patients Directory`}
                  </span>
                  <ArrowIcon className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Actions (CommandBar Item Style) */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Clock */}
        <div className="hidden sm:flex font-mono text-xs font-semibold px-2.5 py-1.5 bg-[#FAF9F8] dark:bg-[#2d2c2c] text-[#242424] dark:text-[#f3f2f1] border border-[#EDEBE9] dark:border-[#3b3a39] rounded-[4px]">
          {currentTime}
        </div>

        {/* Sync Status Button */}
        <button
          onClick={onSync}
          title={isArabic ? 'انقر للمزامنة الفورية مع Google Sheet' : 'Click to sync with Google Sheet'}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border border-[#EDEBE9] dark:border-[#3b3a39] hover:bg-[#F3F2F1] dark:hover:bg-[#323130] text-[#242424] dark:text-[#f3f2f1] bg-white dark:bg-[#201f1e] rounded-[4px] cursor-pointer transition-colors"
        >
          <RefreshCw
            className={`w-3.5 h-3.5 ${syncStatus === 'syncing' ? 'animate-spin text-[#0078D4]' : 'text-[#605E5C] dark:text-[#a19f9d]'}`}
          />
          <span className="hidden lg:inline">{syncMessage}</span>
        </button>

        {/* Quick Add Patient (Primary Action) */}
        <button
          onClick={onOpenNewPatient}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-[#0078D4] text-white hover:bg-[#106EBE] active:bg-[#005A9E] rounded-[4px] cursor-pointer shadow-none transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          <span className="hidden md:inline">{isArabic ? 'مريض جديد' : 'New Patient'}</span>
        </button>

        {/* Quick Add Follow-up */}
        <button
          onClick={onOpenNewFollowUp}
          className="hidden xl:flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-white dark:bg-[#201f1e] text-[#242424] dark:text-[#f3f2f1] border border-[#EDEBE9] dark:border-[#3b3a39] hover:bg-[#F3F2F1] dark:hover:bg-[#323130] rounded-[4px] cursor-pointer transition-colors"
        >
          <Stethoscope className="w-3.5 h-3.5 text-[#0078D4]" />
          <span>{isArabic ? 'متابعة سريرية' : 'New Follow-Up'}</span>
        </button>

        {/* Language Toggle */}
        <button
          onClick={onToggleLang}
          title={isArabic ? 'Switch to English' : 'التحويل للعربية'}
          className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold bg-white dark:bg-[#201f1e] text-[#242424] dark:text-[#f3f2f1] border border-[#EDEBE9] dark:border-[#3b3a39] hover:bg-[#F3F2F1] dark:hover:bg-[#323130] rounded-[4px] cursor-pointer transition-colors"
        >
          <Globe className="w-3.5 h-3.5 text-[#605E5C] dark:text-[#a19f9d]" />
          <span>{isArabic ? 'EN' : 'عربي'}</span>
        </button>

        {/* Theme Toggle */}
        <button
          onClick={onToggleTheme}
          title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
          className="p-1.5 text-[#605E5C] dark:text-[#a19f9d] hover:text-[#242424] dark:hover:text-[#f3f2f1] bg-white dark:bg-[#201f1e] border border-[#EDEBE9] dark:border-[#3b3a39] hover:bg-[#F3F2F1] dark:hover:bg-[#323130] rounded-[4px] cursor-pointer transition-colors"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4 text-[#f3d36b]" /> : <Moon className="w-4 h-4" />}
        </button>
      </div>
    </header>
  );
};
