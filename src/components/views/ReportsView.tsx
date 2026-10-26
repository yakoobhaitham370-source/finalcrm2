import React, { useMemo } from 'react';
import { LineChart, Award, Activity, CheckCircle2 } from 'lucide-react';
import { Patient } from '../../types/pharmacy';
import { calculatePDC } from '../../utils/pharmacyCalculations';

interface ReportsViewProps {
  patients: Patient[];
  lang: 'ar' | 'en';
}

export const ReportsView: React.FC<ReportsViewProps> = ({ patients, lang }) => {
  const activePatients = useMemo(() => patients.filter(p => !p.isArchived), [patients]);

  const { avgPdc, totalPoints, highPdcCount, lowPdcCount, fullBoxesCount } = useMemo(() => {
    let totalPdcSum = 0;
    let pointsSum = 0;
    let high = 0;
    let low = 0;
    let fullBoxes = 0;

    activePatients.forEach(p => {
      const pdc = calculatePDC(p);
      totalPdcSum += pdc;
      pointsSum += Number(p.loyaltyPoints) || 0;
      if (pdc >= 80) high++;
      else low++;

      (p.medications || []).forEach(m => {
        if (Number(m.daysSupply) >= 30) fullBoxes++;
      });
    });

    const avg = activePatients.length > 0 ? Math.round(totalPdcSum / activePatients.length) : 100;
    return {
      avgPdc: avg,
      totalPoints: pointsSum,
      highPdcCount: high,
      lowPdcCount: low,
      fullBoxesCount: fullBoxes,
    };
  }, [activePatients]);

  const clinicalVitalsPoints = useMemo(() => {
    const list: { name: string; bp: string; sys: number; dia: number; sugar: number; date: string }[] = [];
    activePatients.forEach(p => {
      (p.vitals || []).forEach(v => {
        const parts = (v.bp || '').split('/');
        const sys = parseInt(parts[0], 10);
        const dia = parseInt(parts[1], 10);
        const sugarVal = parseInt(v.sugar || '', 10);
        if (!isNaN(sys) && !isNaN(dia)) {
          list.push({
            name: p.name,
            bp: v.bp,
            sys,
            dia,
            sugar: isNaN(sugarVal) ? 110 : sugarVal,
            date: v.date,
          });
        }
      });
    });
    return list.slice(0, 10);
  }, [activePatients]);

  return (
    <div className="space-y-3 bg-transparent text-[#242424] dark:text-[#f3f2f1]">
      {/* Overview Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <div className="bg-[#FFFFFF] dark:bg-[#201f1e] border border-[#EDEBE9] dark:border-[#3b3a39] rounded-[4px] p-2.5 flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold text-[#605E5C] dark:text-[#a19f9d]">
              {lang === 'ar' ? 'متوسط الالتزام (PDC)' : 'Average PDC'}
            </div>
            <div className="text-lg sm:text-xl font-bold font-mono text-[#242424] dark:text-[#f3f2f1] leading-tight">{avgPdc}%</div>
            <div className="text-[10px] text-[#605E5C] dark:text-[#a19f9d] mt-0.5 font-mono">
              {lang === 'ar' ? `${highPdcCount} ملتزم / ${lowPdcCount} بحاجة دعم` : `${highPdcCount} high / ${lowPdcCount} low`}
            </div>
          </div>
          <div className="w-8 h-8 rounded-[4px] bg-[#EFF6FC] dark:bg-[#112338] flex items-center justify-center text-[#0078D4] dark:text-[#2899f5] shrink-0">
            <Activity className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-[#FFFFFF] dark:bg-[#201f1e] border border-[#EDEBE9] dark:border-[#3b3a39] rounded-[4px] p-4 relative flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#605E5C] dark:text-[#a19f9d] tracking-wide">
              {lang === 'ar' ? 'نقاط الولاء الممنوحة' : 'Total Loyalty Stars Awarded'}
            </span>
            <Award className="w-5 h-5 text-[#0078D4] dark:text-[#2899f5]" />
          </div>
          <div className="text-2xl font-bold font-mono text-[#242424] dark:text-[#f3f2f1] mt-2">{totalPoints}</div>
          <div className="text-xs text-[#605E5C] dark:text-[#a19f9d] mt-1">
            {lang === 'ar' ? 'مكافآت التكرار المنتظم والصرف الفصلي' : 'Rewarded for timely adherence'}
          </div>
        </div>

        <div className="bg-[#FFFFFF] dark:bg-[#201f1e] border border-[#EDEBE9] dark:border-[#3b3a39] rounded-[4px] p-4 relative flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#605E5C] dark:text-[#a19f9d] tracking-wide">
              {lang === 'ar' ? 'صرف شهري كامل (Full Boxes)' : '30+ Day Dispensing Events'}
            </span>
            <CheckCircle2 className="w-5 h-5 text-[#0078D4] dark:text-[#2899f5]" />
          </div>
          <div className="text-2xl font-bold font-mono text-[#242424] dark:text-[#f3f2f1] mt-2">{fullBoxesCount}</div>
          <div className="text-xs text-[#605E5C] dark:text-[#a19f9d] mt-1">
            {lang === 'ar' ? 'وصفات تم تغطيتها لشهر كامل فأكثر' : 'Sustained full-pack supply'}
          </div>
        </div>
      </div>

      {/* Interactive Clinical Vitals Trajectory Chart */}
      <div className="bg-[#FFFFFF] dark:bg-[#201f1e] border border-[#EDEBE9] dark:border-[#3b3a39] rounded-[4px] p-4 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="font-semibold text-lg text-[#242424] dark:text-[#f3f2f1] flex items-center gap-2 tracking-tight">
            <LineChart className="w-5 h-5 text-[#0078D4] dark:text-[#2899f5]" />
            <span>{lang === 'ar' ? 'منحنى مؤشرات ضغط الدم وسكر الدم لعينات المرضى' : 'Clinical Blood Pressure & Glycemic Trajectory'}</span>
          </div>
          <div className="flex items-center gap-3 text-xs font-semibold font-mono">
            <span className="flex items-center gap-1.5 text-[#0078D4] dark:text-[#2899f5]">
              <span className="w-3 h-3 bg-[#0078D4] dark:bg-[#2899f5] rounded-[2px] inline-block" />
              <span>Systolic</span>
            </span>
            <span className="flex items-center gap-1.5 text-[#605E5C] dark:text-[#a19f9d]">
              <span className="w-3 h-3 bg-[#605E5C] dark:bg-[#8a8886] rounded-[2px] inline-block" />
              <span>Diastolic</span>
            </span>
            <span className="flex items-center gap-1.5 text-[#A80000] dark:text-[#f87171]">
              <span className="w-3 h-3 bg-[#A80000] dark:bg-[#f87171] rounded-[2px] inline-block" />
              <span>Sugar</span>
            </span>
          </div>
        </div>

        {/* Chart Container */}
        <div className="w-full bg-[#FAF9F8] dark:bg-[#252423] p-4 rounded-[4px] border border-[#EDEBE9] dark:border-[#3b3a39] overflow-x-auto">
          {clinicalVitalsPoints.length === 0 ? (
            <div className="text-center py-10 text-[#605E5C] dark:text-[#a19f9d] text-xs">
              {lang === 'ar' ? 'سجل قراءات العلامات الحيوية في الملفات السريرية لعرض المنحنى البياني هنا.' : 'No recorded vitals yet.'}
            </div>
          ) : (
            <div className="min-w-[600px] h-64 flex flex-col justify-between relative">
              <div className="absolute top-[35%] left-0 right-0 border-b border-[#EDEBE9] dark:border-[#3b3a39] border-dashed flex justify-end">
                <span className="text-[10px] font-mono text-[#605E5C] dark:text-[#a19f9d] bg-[#FAF9F8] dark:bg-[#252423] px-1">Goal BP: 130/80</span>
              </div>

              <div className="h-48 flex items-end justify-between px-6 gap-4">
                {clinicalVitalsPoints.map((pt, i) => {
                  const sysHeight = Math.min(100, Math.max(10, ((pt.sys - 80) / 100) * 100));
                  const diaHeight = Math.min(100, Math.max(10, ((pt.dia - 40) / 80) * 100));
                  const sugarHeight = Math.min(100, Math.max(10, ((pt.sugar - 70) / 150) * 100));

                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-2 group">
                      <div className="text-[10px] text-[#605E5C] dark:text-[#a19f9d] font-mono opacity-0 group-hover:opacity-100 transition-opacity">
                        {pt.bp}
                      </div>
                      <div className="w-full flex items-end justify-center gap-1 h-36">
                        <div
                          style={{ height: `${sysHeight}%` }}
                          className="w-2.5 bg-[#0078D4] dark:bg-[#2899f5] rounded-t-[2px] transition-all"
                          title={`Systolic: ${pt.sys} mmHg`}
                        />
                        <div
                          style={{ height: `${diaHeight}%` }}
                          className="w-2.5 bg-[#605E5C] dark:bg-[#8a8886] rounded-t-[2px] transition-all"
                          title={`Diastolic: ${pt.dia} mmHg`}
                        />
                        <div
                          style={{ height: `${sugarHeight}%` }}
                          className="w-2.5 bg-[#A80000] dark:bg-[#f87171] rounded-t-[2px] transition-all"
                          title={`Sugar: ${pt.sugar} mg/dL`}
                        />
                      </div>
                      <div className="text-[11px] font-semibold text-[#242424] dark:text-[#f3f2f1] truncate max-w-[80px] text-center">
                        {pt.name.split(' ')[0]}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
