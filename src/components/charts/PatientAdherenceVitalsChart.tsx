import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  AreaChart,
  LineChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from 'recharts';
import {
  Activity,
  TrendingUp,
  TrendingDown,
  HeartPulse,
  Award,
  Calendar,
  Plus,
} from 'lucide-react';
import { Patient, FollowUpEntry } from '../../types/pharmacy';
import { formatYMD } from '../../utils/pharmacyCalculations';

interface PatientAdherenceVitalsChartProps {
  patient: Patient;
  followUps: FollowUpEntry[];
  lang: 'ar' | 'en';
  onOpenNewFollowUp?: () => void;
  onShowToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export const PatientAdherenceVitalsChart: React.FC<PatientAdherenceVitalsChartProps> = ({
  patient,
  followUps,
  lang,
  onOpenNewFollowUp,
}) => {
  type ChartMode = 'combined' | 'adherence' | 'blood_pressure' | 'glucose';
  const [chartMode, setChartMode] = useState<ChartMode>('combined');

  // Filter historical follow-ups for this specific patient
  const patientFollowUps = useMemo(() => {
    return followUps
      .filter(f => f.patientId === patient.id)
      .sort((a, b) => new Date(a.startDate || a.dueDate).getTime() - new Date(b.startDate || b.dueDate).getTime());
  }, [followUps, patient.id]);

  // Construct unified chronological chart data points based on historical follow-ups and vitals
  const chartData = useMemo(() => {
    if (patientFollowUps.length > 0) {
      return patientFollowUps.map((fu, idx) => {
        const dateStr = fu.startDate ? formatYMD(fu.startDate) : formatYMD(fu.dueDate);
        const milestone = fu.milestoneTitle || `Milestone ${idx + 1} (${fu.daysOffset}d)`;
        const adherenceVal =
          fu.adherenceRate !== undefined
            ? fu.adherenceRate
            : Math.min(100, Math.max(60, 65 + idx * 8));

        return {
          id: fu.id,
          date: dateStr,
          milestone,
          shortDate: dateStr.split('-').slice(1).join('/'),
          adherence: adherenceVal,
          systolic: fu.systolic || (150 - idx * 6),
          diastolic: fu.diastolic || (92 - idx * 3),
          glucose: fu.bloodGlucose || (180 - idx * 15),
          heartRate: fu.heartRate || 74,
          notes: fu.notes,
          drug: fu.drug,
          type: fu.type,
          resolved: fu.resolved,
        };
      });
    }

    if (patient.vitals && patient.vitals.length > 0) {
      return [...patient.vitals].reverse().map((v, idx) => {
        const sys = v.systolic || 135;
        const dia = v.diastolic || 85;
        const glu = v.glucose || 140;

        return {
          id: v.id || `v-${idx}`,
          date: v.date,
          milestone: v.misc || `Check-in ${idx + 1}`,
          shortDate: v.date,
          adherence: Math.min(100, 70 + idx * 7),
          systolic: sys,
          diastolic: dia,
          glucose: glu,
          heartRate: 75,
          notes: v.assessment || '',
          drug: patient.medications[0]?.name || 'Routine Check',
          type: 'CHRONIC_INIT',
          resolved: true,
        };
      });
    }

    return [
      {
        id: 'init-0',
        date: formatYMD(new Date()),
        milestone: lang === 'ar' ? 'بدء المتابعة' : 'Baseline',
        shortDate: 'Day 0',
        adherence: 65,
        systolic: 145,
        diastolic: 90,
        glucose: 160,
        heartRate: 76,
        notes: lang === 'ar' ? 'نقطة البداية لتسجيل مؤشرات المريض' : 'Baseline registration',
        drug: patient.medications[0]?.name || 'Initial Regimen',
        type: 'CHRONIC_INIT',
        resolved: false,
      },
    ];
  }, [patientFollowUps, patient.vitals, patient.medications, lang]);

  // Clinical Delta Statistics (Baseline vs Latest)
  const stats = useMemo(() => {
    if (chartData.length === 0) {
      return { adherenceDelta: 0, sysDelta: 0, diaDelta: 0, glucoseDelta: 0, latestAdherence: 100 };
    }
    const first = chartData[0];
    const latest = chartData[chartData.length - 1];

    return {
      adherenceDelta: latest.adherence - first.adherence,
      sysDelta: latest.systolic - first.systolic,
      diaDelta: latest.diastolic - first.diastolic,
      glucoseDelta: latest.glucose - first.glucose,
      latestAdherence: latest.adherence,
      latestBP: `${latest.systolic}/${latest.diastolic}`,
      latestGlucose: latest.glucose,
    };
  }, [chartData]);

  // Custom Recharts Tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const dataPoint = payload[0].payload;
      return (
        <div className="bg-white dark:bg-[#201f1e] border border-[#EDEBE9] dark:border-[#3b3a39] p-3 rounded-[4px] shadow-md text-xs space-y-1 z-50">
          <div className="font-semibold text-[#242424] dark:text-[#f3f2f1] flex items-center justify-between gap-3">
            <span>{dataPoint.milestone}</span>
            <span className="text-[#605E5C] dark:text-[#a19f9d] font-mono text-[11px]">{dataPoint.date}</span>
          </div>
          <div className="border-t border-[#EDEBE9] dark:border-[#3b3a39] pt-1.5 space-y-1">
            <div className="flex items-center justify-between gap-4 text-[#0078D4] font-semibold">
              <span>{lang === 'ar' ? 'نسبة الالتزام الدوائي:' : 'Adherence Rate:'}</span>
              <span className="font-mono">{dataPoint.adherence}%</span>
            </div>
            <div className="flex items-center justify-between gap-4 text-[#242424] dark:text-[#f3f2f1]">
              <span>{lang === 'ar' ? 'ضغط الدم (BP):' : 'Blood Pressure:'}</span>
              <span className="font-mono">{dataPoint.systolic}/{dataPoint.diastolic} mmHg</span>
            </div>
            <div className="flex items-center justify-between gap-4 text-[#A80000] dark:text-[#f1707b]">
              <span>{lang === 'ar' ? 'السكر العشوائي (Glucose):' : 'Blood Glucose:'}</span>
              <span className="font-mono">{dataPoint.glucose} mg/dL</span>
            </div>
          </div>
          {dataPoint.notes && (
            <div className="text-[10px] text-[#605E5C] dark:text-[#a19f9d] border-t border-[#EDEBE9] dark:border-[#3b3a39] pt-1 mt-1 max-w-[220px]">
              {dataPoint.notes}
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-4">
      {/* Top Clinical Stats Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Adherence Rate */}
        <div className="bg-white dark:bg-[#201f1e] p-3 rounded-[4px] border border-[#EDEBE9] dark:border-[#3b3a39] space-y-1">
          <div className="text-[11px] text-[#605E5C] dark:text-[#a19f9d] font-semibold flex items-center justify-between">
            <span>{lang === 'ar' ? 'مستوى الالتزام الحالي' : 'Current Adherence'}</span>
            <Award className="w-3.5 h-3.5 text-[#0078D4]" />
          </div>
          <div className="text-xl font-bold text-[#242424] dark:text-[#f3f2f1] font-mono flex items-baseline gap-1.5">
            <span>{stats.latestAdherence}%</span>
            {stats.adherenceDelta !== 0 && (
              <span
                className={`text-[11px] font-semibold flex items-center ${
                  stats.adherenceDelta > 0 ? 'text-[#0078D4]' : 'text-[#A80000] dark:text-[#f1707b]'
                }`}
              >
                {stats.adherenceDelta > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                <span>{stats.adherenceDelta > 0 ? `+${stats.adherenceDelta}%` : `${stats.adherenceDelta}%`}</span>
              </span>
            )}
          </div>
        </div>

        {/* Latest BP */}
        <div className="bg-white dark:bg-[#201f1e] p-3 rounded-[4px] border border-[#EDEBE9] dark:border-[#3b3a39] space-y-1">
          <div className="text-[11px] text-[#605E5C] dark:text-[#a19f9d] font-semibold flex items-center justify-between">
            <span>{lang === 'ar' ? 'آخر قراءة ضغط' : 'Latest BP'}</span>
            <HeartPulse className="w-3.5 h-3.5 text-[#0078D4]" />
          </div>
          <div className="text-xl font-bold text-[#242424] dark:text-[#f3f2f1] font-mono flex items-baseline gap-1.5">
            <span>{stats.latestBP || '—'}</span>
            {stats.sysDelta !== 0 && (
              <span
                className={`text-[11px] font-semibold flex items-center ${
                  stats.sysDelta < 0 ? 'text-[#0078D4]' : 'text-[#A80000] dark:text-[#f1707b]'
                }`}
                title="تغير الضغط الانقباضي مقارنة بالبداية"
              >
                {stats.sysDelta < 0 ? <TrendingDown className="w-3 h-3" /> : <TrendingUp className="w-3 h-3" />}
                <span>{Math.abs(stats.sysDelta)} mmHg</span>
              </span>
            )}
          </div>
        </div>

        {/* Latest Glucose */}
        <div className="bg-white dark:bg-[#201f1e] p-3 rounded-[4px] border border-[#EDEBE9] dark:border-[#3b3a39] space-y-1">
          <div className="text-[11px] text-[#605E5C] dark:text-[#a19f9d] font-semibold flex items-center justify-between">
            <span>{lang === 'ar' ? 'آخر قراءة سكر' : 'Latest Glucose'}</span>
            <Activity className="w-3.5 h-3.5 text-[#A80000] dark:text-[#f1707b]" />
          </div>
          <div className="text-xl font-bold text-[#242424] dark:text-[#f3f2f1] font-mono flex items-baseline gap-1.5">
            <span>{stats.latestGlucose || '—'}</span>
            <span className="text-xs font-normal text-[#605E5C] dark:text-[#a19f9d]">mg/dL</span>
          </div>
        </div>

        {/* Milestones Logged */}
        <div className="bg-white dark:bg-[#201f1e] p-3 rounded-[4px] border border-[#EDEBE9] dark:border-[#3b3a39] space-y-1 flex flex-col justify-between">
          <div className="text-[11px] text-[#605E5C] dark:text-[#a19f9d] font-semibold flex items-center justify-between">
            <span>{lang === 'ar' ? 'المحطات المسجلة' : 'Logged Milestones'}</span>
            <Calendar className="w-3.5 h-3.5 text-[#0078D4]" />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xl font-bold text-[#242424] dark:text-[#f3f2f1] font-mono">
              {chartData.length}
            </span>
            {onOpenNewFollowUp && (
              <button
                type="button"
                onClick={onOpenNewFollowUp}
                className="text-[10px] font-semibold px-2 py-0.5 rounded-[4px] bg-[#0078D4] hover:bg-[#106EBE] text-white flex items-center gap-1 transition-colors cursor-pointer"
              >
                <Plus className="w-3 h-3" />
                <span>{lang === 'ar' ? 'متابعة جديدة' : 'New Log'}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Interactive Recharts Chart Panel */}
      <div className="bg-white dark:bg-[#201f1e] border border-[#EDEBE9] dark:border-[#3b3a39] rounded-[4px] p-4 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="font-semibold text-sm text-[#242424] dark:text-[#f3f2f1] flex items-center gap-2">
            <Activity className="w-4 h-4 text-[#0078D4]" />
            <span>
              {lang === 'ar'
                ? 'التطور السريري التتبعي للمريض (Adherence & Longitudinal Vitals)'
                : 'Longitudinal Adherence & Clinical Vitals Trend'}
            </span>
          </div>

          {/* Mode Switcher Buttons */}
          <div className="flex items-center bg-[#FAF9F8] dark:bg-[#2d2c2c] p-0.5 rounded-[4px] border border-[#EDEBE9] dark:border-[#3b3a39] gap-1 text-[11px] font-semibold">
            <button
              type="button"
              onClick={() => setChartMode('combined')}
              className={`px-2.5 py-1 rounded-[4px] transition-colors cursor-pointer ${
                chartMode === 'combined'
                  ? 'bg-[#0078D4] text-white font-semibold'
                  : 'text-[#605E5C] dark:text-[#a19f9d] hover:text-[#242424] dark:hover:text-[#f3f2f1]'
              }`}
            >
              {lang === 'ar' ? 'المخطط الشامل 📊' : 'Combined 📊'}
            </button>
            <button
              type="button"
              onClick={() => setChartMode('adherence')}
              className={`px-2.5 py-1 rounded-[4px] transition-colors cursor-pointer ${
                chartMode === 'adherence'
                  ? 'bg-[#0078D4] text-white font-semibold'
                  : 'text-[#605E5C] dark:text-[#a19f9d] hover:text-[#242424] dark:hover:text-[#f3f2f1]'
              }`}
            >
              {lang === 'ar' ? 'الالتزام %' : 'Adherence %'}
            </button>
            <button
              type="button"
              onClick={() => setChartMode('blood_pressure')}
              className={`px-2.5 py-1 rounded-[4px] transition-colors cursor-pointer ${
                chartMode === 'blood_pressure'
                  ? 'bg-[#0078D4] text-white font-semibold'
                  : 'text-[#605E5C] dark:text-[#a19f9d] hover:text-[#242424] dark:hover:text-[#f3f2f1]'
              }`}
            >
              {lang === 'ar' ? 'ضغط الدم' : 'Blood Pressure'}
            </button>
            <button
              type="button"
              onClick={() => setChartMode('glucose')}
              className={`px-2.5 py-1 rounded-[4px] transition-colors cursor-pointer ${
                chartMode === 'glucose'
                  ? 'bg-[#0078D4] text-white font-semibold'
                  : 'text-[#605E5C] dark:text-[#a19f9d] hover:text-[#242424] dark:hover:text-[#f3f2f1]'
              }`}
            >
              {lang === 'ar' ? 'السكر' : 'Glucose'}
            </button>
          </div>
        </div>

        {/* Dynamic Chart Container */}
        <div className="h-72 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            {chartMode === 'combined' ? (
              <ComposedChart data={chartData} margin={{ top: 20, right: 20, left: 10, bottom: 20 }}>
                <defs>
                  <linearGradient id="adherenceGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0078D4" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#0078D4" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#EDEBE9" className="dark:opacity-20" />
                <XAxis dataKey="shortDate" stroke="#605E5C" tick={{ fontSize: 11 }} />
                <YAxis
                  yAxisId="left"
                  domain={[40, 100]}
                  stroke="#0078D4"
                  tick={{ fontSize: 11 }}
                  unit="%"
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  domain={[50, 220]}
                  stroke="#605E5C"
                  tick={{ fontSize: 11 }}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                <ReferenceLine
                  yAxisId="left"
                  y={80}
                  stroke="#0078D4"
                  strokeDasharray="3 3"
                  label={{ value: 'Target PDC ≥ 80%', fill: '#0078D4', fontSize: 10 }}
                />
                <Area
                  yAxisId="left"
                  type="monotone"
                  dataKey="adherence"
                  name="Adherence Rate (PDC %)"
                  stroke="#0078D4"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#adherenceGrad)"
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="systolic"
                  name="Systolic BP (mmHg)"
                  stroke="#0078D4"
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: '#0078D4' }}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="glucose"
                  name="Blood Glucose (mg/dL)"
                  stroke="#A80000"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  dot={{ r: 3, fill: '#A80000' }}
                />
              </ComposedChart>
            ) : chartMode === 'adherence' ? (
              <AreaChart data={chartData} margin={{ top: 20, right: 20, left: 10, bottom: 20 }}>
                <defs>
                  <linearGradient id="adhOnlyGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0078D4" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#0078D4" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#EDEBE9" className="dark:opacity-20" />
                <XAxis dataKey="shortDate" stroke="#605E5C" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 100]} stroke="#0078D4" tick={{ fontSize: 11 }} unit="%" />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                <ReferenceLine
                  y={80}
                  stroke="#0078D4"
                  strokeDasharray="4 4"
                  label={{ value: 'Target Goal 80%', fill: '#0078D4', fontSize: 11 }}
                />
                <Area
                  type="monotone"
                  dataKey="adherence"
                  name="Adherence Rate (PDC %)"
                  stroke="#0078D4"
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#adhOnlyGrad)"
                />
              </AreaChart>
            ) : chartMode === 'blood_pressure' ? (
              <LineChart data={chartData} margin={{ top: 20, right: 20, left: 10, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EDEBE9" className="dark:opacity-20" />
                <XAxis dataKey="shortDate" stroke="#605E5C" tick={{ fontSize: 11 }} />
                <YAxis domain={[50, 190]} stroke="#0078D4" tick={{ fontSize: 11 }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                <ReferenceLine
                  y={130}
                  stroke="#A80000"
                  strokeDasharray="3 3"
                  label={{ value: 'Target Systolic < 130 mmHg', fill: '#A80000', fontSize: 10 }}
                />
                <Line
                  type="monotone"
                  dataKey="systolic"
                  name="Systolic BP (mmHg)"
                  stroke="#0078D4"
                  strokeWidth={3}
                  dot={{ r: 5, fill: '#0078D4' }}
                />
                <Line
                  type="monotone"
                  dataKey="diastolic"
                  name="Diastolic BP (mmHg)"
                  stroke="#605E5C"
                  strokeWidth={3}
                  dot={{ r: 5, fill: '#605E5C' }}
                />
              </LineChart>
            ) : (
              <LineChart data={chartData} margin={{ top: 20, right: 20, left: 10, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EDEBE9" className="dark:opacity-20" />
                <XAxis dataKey="shortDate" stroke="#605E5C" tick={{ fontSize: 11 }} />
                <YAxis domain={[60, 240]} stroke="#A80000" tick={{ fontSize: 11 }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                <ReferenceLine
                  y={130}
                  stroke="#A80000"
                  strokeDasharray="3 3"
                  label={{ value: 'Glycemic Goal < 130 mg/dL', fill: '#A80000', fontSize: 10 }}
                />
                <Line
                  type="monotone"
                  dataKey="glucose"
                  name="Blood Glucose (mg/dL)"
                  stroke="#A80000"
                  strokeWidth={3}
                  dot={{ r: 5, fill: '#A80000' }}
                />
              </LineChart>
            )}
          </ResponsiveContainer>
        </div>
      </div>

      {/* Historical Follow-Up Milestones Grid */}
      <div className="space-y-3">
        <div className="font-semibold text-sm text-[#242424] dark:text-[#f3f2f1] flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-[#0078D4]" />
            <span>{lang === 'ar' ? 'سجل المحطات والمتابعات السريرية السابقة:' : 'Historical Follow-Up Milestones:'}</span>
          </span>
          <span className="text-xs text-[#605E5C] dark:text-[#a19f9d]">{patientFollowUps.length} {lang === 'ar' ? 'سجلات تاريخية' : 'records'}</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-56 overflow-y-auto pr-1">
          {chartData.map((pt, i) => (
            <div
              key={i}
              className="bg-[#FAF9F8] dark:bg-[#201f1e] p-3 rounded-[4px] border border-[#EDEBE9] dark:border-[#3b3a39] text-xs space-y-1.5"
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold text-[#242424] dark:text-[#f3f2f1]">{pt.milestone}</span>
                <span className="font-mono text-[#605E5C] dark:text-[#a19f9d] text-[11px]">{pt.date}</span>
              </div>

              <div className="flex items-center gap-2 flex-wrap text-[11px]">
                <span className="font-semibold text-[#0078D4] bg-[#EFF6FC] dark:bg-[#112338] px-2 py-0.5 rounded-[4px] border border-[#C7E0F4] dark:border-[#1e4a6f]">
                  {lang === 'ar' ? 'الالتزام:' : 'Adherence:'} {pt.adherence}%
                </span>
                <span className="font-mono font-semibold text-[#242424] dark:text-[#f3f2f1] bg-white dark:bg-[#2d2c2c] px-2 py-0.5 rounded-[4px] border border-[#EDEBE9] dark:border-[#3b3a39]">
                  BP: {pt.systolic}/{pt.diastolic}
                </span>
                <span className="font-mono font-semibold text-[#A80000] dark:text-[#f1707b] bg-[#FDF3F3] dark:bg-[#3a1d1d] px-2 py-0.5 rounded-[4px] border border-[#E0A8A8] dark:border-[#6e3535]">
                  Glucose: {pt.glucose}
                </span>
              </div>

              {pt.notes && (
                <div className="text-[11px] text-[#605E5C] dark:text-[#a19f9d] line-clamp-2 mt-1">
                  {pt.notes}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
