import React, { useMemo } from 'react';
import { Boxes, Download, ShoppingCart } from 'lucide-react';
import { Patient } from '../../types/pharmacy';
import { calculateInventoryDemand } from '../../utils/pharmacyCalculations';

interface InventoryForecastViewProps {
  patients: Patient[];
  lang: 'ar' | 'en';
  onShowToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export const InventoryForecastView: React.FC<InventoryForecastViewProps> = ({
  patients,
  lang,
  onShowToast,
}) => {
  const forecastItems = useMemo(() => calculateInventoryDemand(patients), [patients]);

  const totalUrgentPacks = useMemo(() => {
    return forecastItems.reduce((acc, item) => acc + item.demand7Days, 0);
  }, [forecastItems]);

  const total30DayPacks = useMemo(() => {
    return forecastItems.reduce((acc, item) => acc + item.estimatedBoxesNeeded, 0);
  }, [forecastItems]);

  const handleExportOrder = () => {
    const headers = ['Medication,GenericClass,ActivePatients,Demand7Days,Demand14Days,EstimatedBoxes30Days'];
    const rows = forecastItems.map(
      item =>
        `"${item.drugName}","${item.genericClass}","${item.activePatientsCount}","${item.demand7Days}","${item.demand14Days}","${item.estimatedBoxesNeeded}"`
    );
    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers, ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `PharmPulse_Stock_Forecast_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    onShowToast(lang === 'ar' ? 'تم تصدير طلبية التوريد المقترحة بنجاح' : 'Exported purchase order CSV', 'success');
  };

  return (
    <div className="space-y-3 bg-transparent text-[#242424] dark:text-[#f3f2f1]">
      {/* Header and Summary */}
      <div className="bg-[#FFFFFF] dark:bg-[#201f1e] border border-[#EDEBE9] dark:border-[#3b3a39] rounded-[4px] p-2.5 sm:p-3 space-y-2.5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
          <div>
            <div className="font-semibold text-base text-[#242424] dark:text-[#f3f2f1] flex items-center gap-2 tracking-tight">
              <Boxes className="w-4 h-4 text-[#0078D4] dark:text-[#2899f5]" />
              <span>{lang === 'ar' ? 'التنبؤ بالطلب والمخزون' : 'Demand Forecasting & Stock'}</span>
            </div>
            <p className="text-[11px] text-[#605E5C] dark:text-[#a19f9d] mt-0.5 max-w-3xl">
              {lang === 'ar'
                ? 'تحليل جدول استحقاق الوصفات المزمنة لتحديد الطلبيات القادمة وتفادي النفاد.'
                : 'Aggregated demand projection based on chronic refill timelines.'}
            </p>
          </div>

          <button
            onClick={handleExportOrder}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-[4px] text-xs font-semibold bg-[#0078D4] hover:bg-[#106EBE] active:bg-[#005A9E] text-white transition-colors cursor-pointer border-0 shadow-none min-h-[44px]"
          >
            <Download className="w-3.5 h-3.5 text-white" />
            <span>{lang === 'ar' ? 'تصدير الطلبية' : 'Export Order'}</span>
          </button>
        </div>

        {/* Metric summary badges */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 border-t border-[#EDEBE9] dark:border-[#3b3a39]">
          <div className="bg-[#FFFFFF] dark:bg-[#201f1e] border border-[#EDEBE9] dark:border-[#3b3a39] p-2 rounded-[4px] flex items-center justify-between">
            <div>
              <div className="text-[11px] text-[#605E5C] dark:text-[#a19f9d]">{lang === 'ar' ? 'الأصناف المتابعة' : 'Tracked SKUs'}</div>
              <div className="text-lg font-bold font-mono text-[#242424] dark:text-[#f3f2f1] leading-none mt-0.5">{forecastItems.length}</div>
            </div>
            <div className="w-7 h-7 rounded-[4px] bg-[#EFF6FC] dark:bg-[#112338] flex items-center justify-center text-[#0078D4] dark:text-[#60a5fa]">
              <Boxes className="w-3.5 h-3.5" />
            </div>
          </div>

          <div className="bg-[#FDF3F3] dark:bg-[#3a1d1d] border border-[#E0A8A8] dark:border-[#7f1d1d] p-3 rounded-[4px] flex items-center justify-between">
            <div>
              <div className="text-xs text-[#A80000] dark:text-[#f87171] font-semibold">{lang === 'ar' ? 'عبوات مطلوبة خلال 7 أيام' : 'Urgent (7-Day Demand)'}</div>
              <div className="text-2xl font-bold font-mono text-[#A80000] dark:text-[#f87171] mt-0.5">{totalUrgentPacks}</div>
            </div>
            <div className="w-9 h-9 rounded-[4px] bg-[#FDF3F3] dark:bg-[#3a1d1d] flex items-center justify-center text-[#A80000] dark:text-[#f87171]">
              <Boxes className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-[#FFFFFF] dark:bg-[#201f1e] border border-[#EDEBE9] dark:border-[#3b3a39] p-3 rounded-[4px] flex items-center justify-between">
            <div>
              <div className="text-xs text-[#242424] dark:text-[#f3f2f1] font-semibold">{lang === 'ar' ? 'إجمالي الاحتياج الشهري التقديري' : '30-Day Total Projected Boxes'}</div>
              <div className="text-2xl font-bold font-mono text-[#242424] dark:text-[#f3f2f1] mt-0.5">{total30DayPacks}</div>
            </div>
            <div className="w-9 h-9 rounded-[4px] bg-[#FAF9F8] dark:bg-[#252423] border border-[#EDEBE9] dark:border-[#3b3a39] flex items-center justify-center text-[#242424] dark:text-[#f3f2f1]">
              <ShoppingCart className="w-5 h-5" />
            </div>
          </div>
        </div>
      </div>

      {/* Forecast Table - DetailsList */}
      <div className="bg-[#FFFFFF] dark:bg-[#201f1e] border border-[#EDEBE9] dark:border-[#3b3a39] rounded-[4px] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right dir-rtl text-xs border-collapse">
            <thead className="bg-[#FAF9F8] dark:bg-[#2d2c2c] text-[#242424] dark:text-[#f3f2f1] border-b border-[#EDEBE9] dark:border-[#3b3a39]">
              <tr>
                <th className="py-2.5 px-3 text-[11px] uppercase tracking-wider">{lang === 'ar' ? 'اسم الدواء (العلامة التجارية)' : 'Brand Name'}</th>
                <th className="py-2.5 px-3 text-[11px] uppercase tracking-wider">{lang === 'ar' ? 'الفئة العلاجية' : 'Generic Class'}</th>
                <th className="py-2.5 px-3 text-[11px] uppercase tracking-wider">{lang === 'ar' ? 'المرضى النشطون' : 'Active Patients'}</th>
                <th className="py-2.5 px-3 text-[11px] uppercase tracking-wider">{lang === 'ar' ? 'طلب 7 أيام' : '7d Need'}</th>
                <th className="py-2.5 px-3 text-[11px] uppercase tracking-wider">{lang === 'ar' ? 'طلب 14 يوم' : '14d Need'}</th>
                <th className="py-2.5 px-3 text-[11px] uppercase tracking-wider">{lang === 'ar' ? 'الطلبية المقترحة (30 يوم)' : '30d Order (Boxes)'}</th>
                <th className="py-2.5 px-3 text-[11px] uppercase tracking-wider text-center">{lang === 'ar' ? 'أولوية التوريد' : 'Priority'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EDEBE9] dark:divide-[#3b3a39] text-[#242424] dark:text-[#f3f2f1]">
              {forecastItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-[#605E5C] dark:text-[#a19f9d]">
                    <div className="space-y-1">
                      <div className="font-semibold text-[#242424] dark:text-[#f3f2f1]">
                        {lang === 'ar' ? 'لا توجد أدوية أو مرضى لحساب توقعات المخزون حالياً' : 'No Active Medications to Forecast'}
                      </div>
                      <div className="text-xs text-[#605E5C] dark:text-[#a19f9d]">
                        {lang === 'ar' ? 'أضف مرضى بأدويتهم المزمنة لتوقع كميات الطلبيات ومواعيد إعادة التوريد.' : 'Register patients with chronic regimens to generate demand forecasts.'}
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                forecastItems.map((item, idx) => (
                <tr key={idx} className="hover:bg-[#F3F2F1] dark:hover:bg-[#252423] transition-colors">
                  <td className="py-2.5 px-3 font-semibold text-[#242424] dark:text-[#f3f2f1]">
                    {item.drugName}
                  </td>
                  <td className="py-2.5 px-3">
                    <span className="font-mono text-[#242424] dark:text-[#f3f2f1] bg-[#FAF9F8] dark:bg-[#252423] border border-[#EDEBE9] dark:border-[#3b3a39] px-2 py-0.5 rounded-[4px] text-[11px]">
                      {item.genericClass}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 font-semibold text-[#242424] dark:text-[#f3f2f1] font-mono">
                    {item.activePatientsCount} {lang === 'ar' ? 'مرضى' : 'pts'}
                  </td>
                  <td className="py-2.5 px-3">
                    {item.demand7Days > 0 ? (
                      <span className="font-semibold font-mono text-[#A80000] dark:text-[#f87171] bg-[#FDF3F3] dark:bg-[#3a1d1d] border border-[#E0A8A8] dark:border-[#7f1d1d] px-2 py-0.5 rounded-[4px]">
                        {item.demand7Days} {lang === 'ar' ? 'عبوة' : 'packs'}
                      </span>
                    ) : (
                      <span className="text-[#605E5C] dark:text-[#a19f9d]">0</span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 font-semibold font-mono text-[#242424] dark:text-[#f3f2f1]">
                    {item.demand14Days}
                  </td>
                  <td className="py-2.5 px-3 font-bold font-mono text-[#242424] dark:text-[#f3f2f1] text-sm">
                    {item.estimatedBoxesNeeded}
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    {item.status === 'critical' ? (
                      <span className="inline-block text-[10px] font-semibold font-mono px-2 py-0.5 rounded-[4px] bg-[#FDF3F3] dark:bg-[#3a1d1d] text-[#A80000] dark:text-[#f87171] border border-[#E0A8A8] dark:border-[#7f1d1d]">
                        {lang === 'ar' ? 'حرج وعاجل' : 'Urgent Restock'}
                      </span>
                    ) : item.status === 'warning' ? (
                      <span className="inline-block text-[10px] font-semibold font-mono px-2 py-0.5 rounded-[4px] bg-[#FFF4CE] dark:bg-[#3a3118] text-[#7A5B00] dark:text-[#fde047] border border-[#FFE699] dark:border-[#854d0e]">
                        {lang === 'ar' ? 'متابعة قريبة' : 'Medium Priority'}
                      </span>
                    ) : (
                      <span className="inline-block text-[10px] font-semibold font-mono px-2 py-0.5 rounded-[4px] bg-[#FAF9F8] dark:bg-[#252423] text-[#605E5C] dark:text-[#a19f9d] border border-[#EDEBE9] dark:border-[#3b3a39]">
                        {lang === 'ar' ? 'مستقر' : 'Stable'}
                      </span>
                    )}
                  </td>
                </tr>
              )))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
