import React from 'react';
import {
  LayoutDashboard,
  Users,
  Clock,
  Stethoscope,
  BellRing,
  Boxes,
  LineChart,
  Archive,
  Settings as SettingsIcon,
} from 'lucide-react';

export type ViewType =
  | 'dashboard'
  | 'patients'
  | 'followup'
  | 'timeline'
  | 'inventory'
  | 'reports'
  | 'archive'
  | 'settings';

interface NavigationProps {
  activeView: ViewType;
  onSelectView: (view: ViewType) => void;
  dueRefillsCount: number;
  activeFollowUpsCount: number;
  lang: 'ar' | 'en';
}

export const Navigation: React.FC<NavigationProps> = ({
  activeView,
  onSelectView,
  dueRefillsCount,
  activeFollowUpsCount,
  lang,
}) => {
  const navItems: {
    id: ViewType;
    labelAr: string;
    labelEn: string;
    icon: React.ReactNode;
    badge?: number;
  }[] = [
    {
      id: 'dashboard',
      labelAr: 'لوحة التحكم والمصروفات',
      labelEn: 'Daily Queue',
      icon: <LayoutDashboard className="w-4 h-4" />,
    },
    {
      id: 'patients',
      labelAr: 'المرضى والعائلات',
      labelEn: 'Patients & Records',
      icon: <Users className="w-4 h-4" />,
    },
    {
      id: 'followup',
      labelAr: 'المتابعة السريرية',
      labelEn: 'Clinical Follow-Up',
      icon: <Stethoscope className="w-4 h-4" />,
      badge: activeFollowUpsCount,
    },
    {
      id: 'timeline',
      labelAr: 'جدول المواعيد',
      labelEn: 'Refill Timeline',
      icon: <BellRing className="w-4 h-4" />,
      badge: dueRefillsCount,
    },
    {
      id: 'inventory',
      labelAr: 'توقع الطلب والمخزون',
      labelEn: 'Demand Forecast',
      icon: <Boxes className="w-4 h-4" />,
    },
    {
      id: 'reports',
      labelAr: 'التقارير والمؤشرات',
      labelEn: 'Reports & Vitals',
      icon: <LineChart className="w-4 h-4" />,
    },
    {
      id: 'archive',
      labelAr: 'الأرشيف',
      labelEn: 'Archive',
      icon: <Archive className="w-4 h-4" />,
    },
    {
      id: 'settings',
      labelAr: 'الإعدادات والربط',
      labelEn: 'Settings & Sync',
      icon: <SettingsIcon className="w-4 h-4" />,
    },
  ];

  return (
    <nav className="hidden md:flex bg-white dark:bg-[#201f1e] border-b border-[#EDEBE9] dark:border-[#3b3a39] px-4 md:px-6 items-center gap-1 overflow-x-auto scrollbar-none sticky top-14 z-30 transition-colors duration-200">
      {navItems.map(item => {
        const isActive = activeView === item.id;
        return (
          <button
            key={item.id}
            onClick={() => onSelectView(item.id)}
            className={`flex items-center gap-2 py-2.5 px-3 text-xs font-semibold whitespace-nowrap border-b-2 transition-colors cursor-pointer ${
              isActive
                ? 'border-[#0078D4] text-[#0078D4] bg-transparent'
                : 'border-transparent text-[#605E5C] dark:text-[#a19f9d] hover:text-[#242424] dark:hover:text-[#f3f2f1] hover:border-[#EDEBE9] dark:hover:border-[#3b3a39]'
            }`}
          >
            <span className={isActive ? 'text-[#0078D4]' : 'text-[#605E5C] dark:text-[#a19f9d]'}>{item.icon}</span>
            <span>{lang === 'ar' ? item.labelAr : item.labelEn}</span>
            {item.badge !== undefined && item.badge > 0 && (
              <span
                className={`text-[10px] font-mono font-semibold px-1.5 py-0.2 rounded-[4px] ${
                  isActive
                    ? 'bg-[#0078D4] text-white'
                    : 'bg-[#EDEBE9] dark:bg-[#3b3a39] text-[#242424] dark:text-[#f3f2f1]'
                }`}
              >
                {item.badge}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
};
