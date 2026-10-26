import React, { useState } from 'react';
import {
  LayoutDashboard,
  Users,
  MoreHorizontal,
  Stethoscope,
  BellRing,
  Boxes,
  LineChart,
  Archive,
  Settings as SettingsIcon,
  X,
  Moon,
  Sun,
  Globe,
} from 'lucide-react';
import { ViewType } from './Navigation';

interface MobileBottomNavProps {
  activeView: ViewType;
  onSelectView: (view: ViewType) => void;
  dueRefillsCount: number;
  activeFollowUpsCount: number;
  lang: 'ar' | 'en';
  setLang: (lang: 'ar' | 'en') => void;
  theme: 'dark' | 'light';
  setTheme: (theme: 'dark' | 'light') => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeView,
  onSelectView,
  dueRefillsCount,
  activeFollowUpsCount,
  lang,
  setLang,
  theme,
  setTheme,
}) => {
  const [isMoreOpen, setIsMoreOpen] = useState(false);

  const mainTabs = [
    {
      id: 'dashboard' as ViewType,
      labelAr: 'اليوم',
      labelEn: 'Today',
      icon: <LayoutDashboard className="w-5 h-5" />,
    },
    {
      id: 'patients' as ViewType,
      labelAr: 'المرضى',
      labelEn: 'Patients',
      icon: <Users className="w-5 h-5" />,
    },
    {
      id: 'followup' as ViewType,
      labelAr: 'المتابعة',
      labelEn: 'Follow-up',
      icon: <Stethoscope className="w-5 h-5" />,
      badge: activeFollowUpsCount,
    },
  ];

  const moreItems = [
    {
      id: 'timeline' as ViewType,
      labelAr: 'جدول المواعيد والمراجعات',
      labelEn: 'Refill Timeline',
      icon: <BellRing className="w-5 h-5 text-amber-500" />,
      badge: dueRefillsCount,
    },
    {
      id: 'inventory' as ViewType,
      labelAr: 'توقع الطلب والمخزون',
      labelEn: 'Demand Forecast',
      icon: <Boxes className="w-5 h-5 text-emerald-500" />,
    },
    {
      id: 'reports' as ViewType,
      labelAr: 'التقارير والمؤشرات',
      labelEn: 'Reports & Vitals',
      icon: <LineChart className="w-5 h-5 text-purple-500" />,
    },
    {
      id: 'archive' as ViewType,
      labelAr: 'الأرشيف',
      labelEn: 'Archive',
      icon: <Archive className="w-5 h-5 text-slate-500" />,
    },
    {
      id: 'settings' as ViewType,
      labelAr: 'الإعدادات والربط',
      labelEn: 'Settings & Sync',
      icon: <SettingsIcon className="w-5 h-5 text-indigo-500" />,
    },
  ];

  const handleSelectMoreItem = (id: ViewType) => {
    onSelectView(id);
    setIsMoreOpen(false);
  };

  const isMoreActive = !mainTabs.some(t => t.id === activeView);

  return (
    <>
      {/* Fixed Mobile Bottom Bar */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-40 bg-white dark:bg-[#201f1e] border-t border-[#EDEBE9] dark:border-[#3b3a39] flex items-center justify-around h-16 pb-safe md:hidden shadow-lg"
        aria-label="Mobile Navigation"
      >
        {mainTabs.map(tab => {
          const isActive = activeView === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onSelectView(tab.id)}
              className={`flex-1 min-h-[48px] flex flex-col items-center justify-center gap-1 transition-colors relative ${
                isActive
                  ? 'text-[#0078D4] dark:text-[#2899F5] font-semibold'
                  : 'text-[#605E5C] dark:text-[#a19f9d] hover:text-[#242424] dark:hover:text-[#f3f2f1]'
              }`}
            >
              <div className="relative">
                {tab.icon}
                {tab.badge !== undefined && tab.badge > 0 && (
                  <span className="absolute -top-1.5 -right-2 bg-[#A80000] text-white text-[10px] font-bold px-1 min-w-[16px] h-4 rounded-full flex items-center justify-center">
                    {tab.badge > 99 ? '99+' : tab.badge}
                  </span>
                )}
              </div>
              <span className="text-[11px] leading-tight">
                {lang === 'ar' ? tab.labelAr : tab.labelEn}
              </span>
            </button>
          );
        })}

        {/* More Button */}
        <button
          onClick={() => setIsMoreOpen(true)}
          className={`flex-1 min-h-[48px] flex flex-col items-center justify-center gap-1 transition-colors relative ${
            isMoreActive
              ? 'text-[#0078D4] dark:text-[#2899F5] font-semibold'
              : 'text-[#605E5C] dark:text-[#a19f9d] hover:text-[#242424] dark:hover:text-[#f3f2f1]'
          }`}
        >
          <div className="relative">
            <MoreHorizontal className="w-5 h-5" />
            {(activeFollowUpsCount > 0 || dueRefillsCount > 0) && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-[#0078D4] rounded-full border border-white dark:border-[#201f1e]" />
            )}
          </div>
          <span className="text-[11px] leading-tight">
            {lang === 'ar' ? 'المزيد' : 'More'}
          </span>
        </button>
      </nav>

      {/* More Bottom Sheet Drawer */}
      {isMoreOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/60 backdrop-blur-xs md:hidden">
          <div
            className="fixed inset-0"
            onClick={() => setIsMoreOpen(false)}
            aria-label="Close menu"
          />
          <div className="relative z-10 bg-white dark:bg-[#201f1e] border-t border-[#EDEBE9] dark:border-[#3b3a39] rounded-t-2xl max-h-[85vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-200">
            {/* Grab Handle */}
            <div className="pt-3 pb-2 flex justify-center">
              <div className="w-12 h-1.5 bg-[#E1DFDD] dark:bg-[#484644] rounded-full" />
            </div>

            {/* Header */}
            <div className="px-4 pb-3 border-b border-[#EDEBE9] dark:border-[#3b3a39] flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-[#242424] dark:text-[#f3f2f1]">
                  {lang === 'ar' ? 'جميع الأقسام والأدوات' : 'All Sections & Tools'}
                </h3>
                <p className="text-xs text-[#605E5C] dark:text-[#a19f9d]">
                  {lang === 'ar' ? 'اختر القسم للانتقال السريع' : 'Select section to navigate'}
                </p>
              </div>
              <button
                onClick={() => setIsMoreOpen(false)}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center text-[#605E5C] dark:text-[#a19f9d] hover:text-[#242424] dark:hover:text-[#f3f2f1]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content List */}
            <div className="p-3 overflow-y-auto space-y-1">
              {moreItems.map(item => {
                const isActive = activeView === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleSelectMoreItem(item.id)}
                    className={`w-full min-h-[48px] px-3 py-2.5 rounded-[6px] flex items-center justify-between transition-colors ${
                      isActive
                        ? 'bg-[#EFF6FC] dark:bg-[#004578]/40 border border-[#0078D4]/30'
                        : 'hover:bg-[#FAF9F8] dark:hover:bg-[#292827]'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {item.icon}
                      <span className="text-sm font-medium text-[#242424] dark:text-[#f3f2f1]">
                        {lang === 'ar' ? item.labelAr : item.labelEn}
                      </span>
                    </div>
                    {item.badge !== undefined && item.badge > 0 && (
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#A80000] text-white">
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Quick Actions Footer (Theme & Language) */}
            <div className="p-4 bg-[#FAF9F8] dark:bg-[#11100F] border-t border-[#EDEBE9] dark:border-[#3b3a39] flex items-center justify-between gap-3 pb-safe">
              <button
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className="flex-1 min-h-[44px] px-3 py-2 rounded-[4px] border border-[#EDEBE9] dark:border-[#3b3a39] bg-white dark:bg-[#201f1e] text-xs font-semibold flex items-center justify-center gap-2 text-[#242424] dark:text-[#f3f2f1]"
              >
                {theme === 'dark' ? (
                  <>
                    <Sun className="w-4 h-4 text-amber-400" />
                    <span>{lang === 'ar' ? 'الوضع النهار' : 'Light Mode'}</span>
                  </>
                ) : (
                  <>
                    <Moon className="w-4 h-4 text-indigo-600" />
                    <span>{lang === 'ar' ? 'الوضع الليل' : 'Dark Mode'}</span>
                  </>
                )}
              </button>

              <button
                onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}
                className="flex-1 min-h-[44px] px-3 py-2 rounded-[4px] border border-[#EDEBE9] dark:border-[#3b3a39] bg-white dark:bg-[#201f1e] text-xs font-semibold flex items-center justify-center gap-2 text-[#242424] dark:text-[#f3f2f1]"
              >
                <Globe className="w-4 h-4 text-[#0078D4]" />
                <span>{lang === 'ar' ? 'English' : 'العربية'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
