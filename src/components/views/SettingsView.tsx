import React, { useState, useMemo } from 'react';
import {
  Settings as SettingsIcon,
  Save,
  Download,
  Upload,
  AlertTriangle,
  RefreshCw,
  Check,
  Code,
  Copy,
  X,
  Cloud,
  HelpCircle,
  Activity,
  FileCode,
  Trash2,
  FileSpreadsheet,
} from 'lucide-react';
import { Settings } from '../../types/pharmacy';
import { validateGasUrl, testSheetConnectionDetailed, GasDiagnosticResult } from '../../services/apiService';
import { APPS_SCRIPT_CODE } from '../../data/appsScriptTemplate';

interface SettingsViewProps {
  settings: Settings;
  lang: 'ar' | 'en';
  onSaveSettings: (settings: Settings) => void;
  onExportBackup: () => void;
  onExportCSV?: () => void;
  onImportBackup: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onResetDatabase: () => void;
  onTestSheetConnection: () => void;
  onPushLocalToSheet?: () => void;
  onOpenBulkImport?: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  lang,
  onSaveSettings,
  onExportBackup,
  onExportCSV,
  onImportBackup,
  onResetDatabase,
  onTestSheetConnection,
  onPushLocalToSheet,
  onOpenBulkImport,
}) => {
  const [formData, setFormData] = useState<Settings>({ ...settings });
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [showScriptModal, setShowScriptModal] = useState(false);
  const [scriptModalTab, setScriptModalTab] = useState<'code' | 'instructions' | 'faq'>('code');
  const [showNetlifyModal, setShowNetlifyModal] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  // Diagnostic testing state
  const [isDiagnosing, setIsDiagnosing] = useState(false);
  const [diagnosticResult, setDiagnosticResult] = useState<GasDiagnosticResult | null>(null);
  const [showDiagnosticModal, setShowDiagnosticModal] = useState(false);

  // Live URL validation
  const urlValidation = useMemo(() => validateGasUrl(formData.gasUrl), [formData.gasUrl]);

  // Interactive diagnostic runner
  const handleRunDiagnostic = async () => {
    if (!formData.gasUrl || !formData.gasUrl.trim()) return;
    setIsDiagnosing(true);
    setShowDiagnosticModal(true);
    try {
      const res = await testSheetConnectionDetailed(formData.gasUrl);
      setDiagnosticResult(res);
      if (res.success) {
        onTestSheetConnection();
      }
    } catch (err: any) {
      setDiagnosticResult({
        success: false,
        message: err.message || 'فشل الاتصال',
        tip: 'تحقق من اتصال الإنترنت ومن نسخ الرابط كاملاً.',
      });
    } finally {
      setIsDiagnosing(false);
    }
  };

  const handleFixDevUrl = () => {
    if (urlValidation.normalizedUrl) {
      setFormData({ ...formData, gasUrl: urlValidation.normalizedUrl });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveSettings(formData);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  return (
    <div className="space-y-3 max-w-4xl mx-auto bg-transparent text-[#242424] dark:text-[#f3f2f1]">
      {/* Header Banner */}
      <div className="bg-[#FFFFFF] dark:bg-[#201f1e] border border-[#EDEBE9] dark:border-[#3b3a39] rounded-[4px] p-2.5 sm:p-3">
        <div className="font-semibold text-base text-[#242424] dark:text-[#f3f2f1] flex items-center gap-2 tracking-tight">
          <SettingsIcon className="w-4 h-4 text-[#0078D4] dark:text-[#2899f5]" />
          <span>{lang === 'ar' ? 'الإعدادات العامة والربط السحابي' : 'Settings & Cloud Integration'}</span>
        </div>
        <p className="text-[11px] text-[#605E5C] dark:text-[#a19f9d] mt-0.5">
          {lang === 'ar'
            ? 'تخصيص اسم الصيدلية، ورابط مزامنة Google Sheet / Drive، وقوالب التذكير.'
            : 'Configure pharmacy branding, Google Sheet Web App endpoint, and messaging templates.'}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        {/* Pharmacy & Cloud */}
        <div className="bg-[#FFFFFF] dark:bg-[#201f1e] border border-[#EDEBE9] dark:border-[#3b3a39] rounded-[4px] p-2.5 sm:p-3 space-y-3">
          <div className="font-semibold text-sm text-[#242424] dark:text-[#f3f2f1]">
            {lang === 'ar' ? 'البيانات الأساسية والربط السحابي' : 'Basic & Cloud Configuration'}
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-[#242424] dark:text-[#f3f2f1]">
              {lang === 'ar' ? 'اسم الصيدلية أو المركز السريري' : 'Pharmacy / Clinic Brand Name'}
            </label>
            <input
              type="text"
              value={formData.pharmacyName}
              onChange={e => setFormData({ ...formData, pharmacyName: e.target.value })}
              className="w-full bg-[#FFFFFF] dark:bg-[#252423] border border-[#EDEBE9] dark:border-[#3b3a39] text-[#242424] dark:text-[#f3f2f1] text-xs rounded-[4px] p-2 outline-none focus:border-[#0078D4] dark:focus:border-[#2899f5]"
              required
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <label className="text-xs font-semibold text-[#242424] dark:text-[#f3f2f1] flex items-center gap-1.5">
                <span>{lang === 'ar' ? 'رابط Google Apps Script Web App URL' : 'Google Apps Script Web App URL'}</span>
                <span className="px-1.5 py-0.5 rounded-[4px] bg-[#EFF6FC] dark:bg-[#112338] text-[#0078D4] dark:text-[#60a5fa] text-[10px] font-mono border border-[#C7E0F4] dark:border-[#1e3a8a]">/exec</span>
              </label>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => setShowScriptModal(true)}
                  className="text-[11px] font-semibold text-[#242424] dark:text-[#f3f2f1] flex items-center gap-1.5 px-2.5 py-1 rounded-[4px] bg-[#FAF9F8] dark:bg-[#252423] border border-[#EDEBE9] dark:border-[#3b3a39] hover:bg-[#F3F2F1] dark:hover:bg-[#2d2c2c] transition-colors cursor-pointer"
                >
                  <Code className="w-3.5 h-3.5 text-[#0078D4] dark:text-[#2899f5]" />
                  <span>{lang === 'ar' ? 'كود Apps Script السريع' : 'Fast Apps Script & Guide'}</span>
                </button>

                {formData.gasUrl && (
                  <button
                    type="button"
                    onClick={handleRunDiagnostic}
                    disabled={isDiagnosing}
                    className="text-[11px] font-semibold text-[#242424] dark:text-[#f3f2f1] flex items-center gap-1.5 px-2.5 py-1 rounded-[4px] bg-[#FAF9F8] dark:bg-[#252423] border border-[#EDEBE9] dark:border-[#3b3a39] hover:bg-[#F3F2F1] dark:hover:bg-[#2d2c2c] transition-colors cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 text-[#0078D4] dark:text-[#2899f5] ${isDiagnosing ? 'animate-spin' : ''}`} />
                    <span>{isDiagnosing ? (lang === 'ar' ? 'جارِ الفحص...' : 'Testing...') : (lang === 'ar' ? 'فحص وااختبار الاتصال' : 'Test Sync')}</span>
                  </button>
                )}

                {formData.gasUrl && onPushLocalToSheet && (
                  <button
                    type="button"
                    onClick={onPushLocalToSheet}
                    className="text-[11px] font-semibold text-[#242424] dark:text-[#f3f2f1] flex items-center gap-1.5 px-2.5 py-1 rounded-[4px] bg-[#FAF9F8] dark:bg-[#252423] border border-[#EDEBE9] dark:border-[#3b3a39] hover:bg-[#F3F2F1] dark:hover:bg-[#2d2c2c] transition-colors cursor-pointer"
                    title={lang === 'ar' ? 'رفع وتصدير السجلات المحلية لتزويد الشيت' : 'Push local records to Google Sheet'}
                  >
                    <Upload className="w-3.5 h-3.5 text-[#0078D4] dark:text-[#2899f5]" />
                    <span>{lang === 'ar' ? 'تزويد الشيت محلياً' : 'Push Local Data'}</span>
                  </button>
                )}

                {formData.gasUrl && (
                  <button
                    type="button"
                    onClick={onResetDatabase}
                    className="text-[11px] font-semibold text-[#A80000] dark:text-[#f87171] flex items-center gap-1.5 px-2.5 py-1 rounded-[4px] bg-[#FDF3F3] dark:bg-[#3a1d1d] border border-[#E0A8A8] dark:border-[#7f1d1d] hover:bg-[#FCE8E6] dark:hover:bg-[#4a2323] transition-colors cursor-pointer"
                    title={lang === 'ar' ? 'تفريغ قاعدة البيانات ومسح شيت Google Sheet' : 'Reset Database & Google Sheet'}
                  >
                    <Trash2 className="w-3.5 h-3.5 text-[#A80000] dark:text-[#f87171]" />
                    <span>{lang === 'ar' ? 'تفريغ الشيت والموقع' : 'Reset DB & Sheet'}</span>
                  </button>
                )}
              </div>
            </div>

            <div className="relative">
              <input
                type="url"
                value={formData.gasUrl}
                onChange={e => setFormData({ ...formData, gasUrl: e.target.value })}
                placeholder="https://script.google.com/macros/s/.../exec"
                className={`w-full bg-[#FFFFFF] dark:bg-[#252423] border text-[#242424] dark:text-[#f3f2f1] text-xs rounded-[4px] p-2 font-mono outline-none transition-colors ${
                  formData.gasUrl && !urlValidation.isValid
                    ? 'border-[#A80000] dark:border-[#f87171] focus:border-[#A80000]'
                    : 'border-[#EDEBE9] dark:border-[#3b3a39] focus:border-[#0078D4] dark:focus:border-[#2899f5]'
                }`}
              />
            </div>

            {/* Smart Live Diagnostic Warnings */}
            {formData.gasUrl && !urlValidation.isValid && (
              <div className="p-3 rounded-[4px] bg-[#FDF3F3] dark:bg-[#3a1d1d] border border-[#E0A8A8] dark:border-[#7f1d1d] space-y-2 text-xs">
                <div className="flex items-start gap-2 text-[#A80000] dark:text-[#f87171] font-semibold">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-[#A80000] dark:text-[#f87171]" />
                  <span>{urlValidation.error || urlValidation.warning}</span>
                </div>
                {urlValidation.tip && (
                  <p className="text-[#605E5C] dark:text-[#a19f9d] text-[11px] leading-relaxed mr-6 font-mono">
                    {urlValidation.tip}
                  </p>
                )}
                {urlValidation.warning?.includes('/dev') && (
                  <button
                    type="button"
                    onClick={handleFixDevUrl}
                    className="mr-6 px-3 py-1 bg-[#0078D4] text-white font-semibold text-[11px] rounded-[4px] transition-colors cursor-pointer"
                  >
                    {lang === 'ar' ? 'تحويل الرابط تلقائياً إلى /exec' : 'Auto-fix URL to /exec'}
                  </button>
                )}
              </div>
            )}

            <div className="text-[11px] text-[#605E5C] dark:text-[#a19f9d] flex items-center justify-between font-mono">
              <span>
                {lang === 'ar'
                  ? 'يتيح المزامنة اللحظية مع Google Sheets وحفظ روابط صور الوصفات الطبية في Google Drive تلقائياً.'
                  : 'Enables real-time sync with Google Sheets and prescription storage in Google Drive.'}
              </span>
            </div>
          </div>
        </div>

        {/* Messaging Templates */}
        <div className="bg-[#FFFFFF] dark:bg-[#201f1e] border border-[#EDEBE9] dark:border-[#3b3a39] rounded-[4px] p-4 space-y-4">
          <div className="font-semibold text-sm text-[#242424] dark:text-[#f3f2f1]">
            {lang === 'ar' ? 'قوالب الرسائل المخصصة (WhatsApp & SMS Templates)' : 'Automated Messaging Templates'}
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-[#242424] dark:text-[#f3f2f1]">
              {lang === 'ar' ? 'قالب تذكير صرف العلاج المزمن (WhatsApp)' : 'Chronic Refill Reminder Template (WhatsApp)'}
            </label>
            <textarea
              rows={3}
              value={formData.waTemplate}
              onChange={e => setFormData({ ...formData, waTemplate: e.target.value })}
              className="w-full bg-[#FFFFFF] dark:bg-[#252423] border border-[#EDEBE9] dark:border-[#3b3a39] text-[#242424] dark:text-[#f3f2f1] text-xs rounded-[4px] p-2 outline-none focus:border-[#0078D4] dark:focus:border-[#2899f5] leading-relaxed"
            />
            <div className="text-[10px] text-[#605E5C] dark:text-[#a19f9d] font-mono">
              {lang === 'ar' ? 'المتغيرات المتاحة: {name}, {pharmacy}, {drug}, {date}' : 'Variables: {name}, {pharmacy}, {drug}, {date}'}
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-[#242424] dark:text-[#f3f2f1]">
              {lang === 'ar' ? 'قالب متابعة كورس المضاد الحيوي (Antibiotic Stewardship Check-in)' : 'Antibiotic Stewardship Check-in'}
            </label>
            <textarea
              rows={3}
              value={formData.waAbxTemplate}
              onChange={e => setFormData({ ...formData, waAbxTemplate: e.target.value })}
              className="w-full bg-[#FFFFFF] dark:bg-[#252423] border border-[#EDEBE9] dark:border-[#3b3a39] text-[#242424] dark:text-[#f3f2f1] text-xs rounded-[4px] p-2 outline-none focus:border-[#0078D4] dark:focus:border-[#2899f5] leading-relaxed"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-[#242424] dark:text-[#f3f2f1]">
              {lang === 'ar' ? 'قالب متابعة العلاج المزمن الجديد (Chronic Milestones Check-in)' : 'Chronic Therapy Milestone Check-in'}
            </label>
            <textarea
              rows={3}
              value={formData.waChronicFollowTemplate}
              onChange={e => setFormData({ ...formData, waChronicFollowTemplate: e.target.value })}
              className="w-full bg-[#FFFFFF] dark:bg-[#252423] border border-[#EDEBE9] dark:border-[#3b3a39] text-[#242424] dark:text-[#f3f2f1] text-xs rounded-[4px] p-2 outline-none focus:border-[#0078D4] dark:focus:border-[#2899f5] leading-relaxed"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-[#242424] dark:text-[#f3f2f1]">
              {lang === 'ar' ? 'قالب الرسائل النصية القصيرة (SMS Reminder Template)' : 'SMS Text Template'}
            </label>
            <textarea
              rows={2}
              value={formData.smsTemplate}
              onChange={e => setFormData({ ...formData, smsTemplate: e.target.value })}
              className="w-full bg-[#FFFFFF] dark:bg-[#252423] border border-[#EDEBE9] dark:border-[#3b3a39] text-[#242424] dark:text-[#f3f2f1] text-xs rounded-[4px] p-2 outline-none focus:border-[#0078D4] dark:focus:border-[#2899f5] leading-relaxed"
            />
          </div>
        </div>

        {/* Buttons */}
        <div className="flex items-center justify-between flex-wrap gap-3 pt-2">
          <button
            type="submit"
            className="flex items-center gap-1.5 px-4 py-2 rounded-[4px] bg-[#0078D4] hover:bg-[#106EBE] active:bg-[#005A9E] text-white font-semibold text-xs transition-colors cursor-pointer border-0 shadow-none"
          >
            {savedSuccess ? <Check className="w-4 h-4 text-white" /> : <Save className="w-4 h-4" />}
            <span>{savedSuccess ? (lang === 'ar' ? 'تم الحفظ بنجاح!' : 'Saved!') : (lang === 'ar' ? 'حفظ كافة الإعدادات' : 'Save Settings')}</span>
          </button>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={onExportBackup}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-[4px] bg-[#FFFFFF] dark:bg-[#252423] hover:bg-[#F3F2F1] dark:hover:bg-[#2d2c2c] text-[#242424] dark:text-[#f3f2f1] border border-[#EDEBE9] dark:border-[#3b3a39] text-xs font-semibold transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-[#605E5C] dark:text-[#a19f9d]" />
              <span>{lang === 'ar' ? 'تصدير نسخة احتياطية (JSON)' : 'Export JSON Backup'}</span>
            </button>

            {onExportCSV && (
              <button
                type="button"
                onClick={onExportCSV}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-[4px] bg-[#FFFFFF] dark:bg-[#252423] hover:bg-[#F3F2F1] dark:hover:bg-[#2d2c2c] text-[#242424] dark:text-[#f3f2f1] border border-[#EDEBE9] dark:border-[#3b3a39] text-xs font-semibold transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-[#605E5C] dark:text-[#a19f9d]" />
                <span>{lang === 'ar' ? 'تصدير جدول المرضى (CSV)' : 'Export Patients CSV'}</span>
              </button>
            )}

            <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-[4px] bg-[#FFFFFF] dark:bg-[#252423] hover:bg-[#F3F2F1] dark:hover:bg-[#2d2c2c] text-[#242424] dark:text-[#f3f2f1] border border-[#EDEBE9] dark:border-[#3b3a39] text-xs font-semibold transition-colors cursor-pointer">
              <Upload className="w-3.5 h-3.5 text-[#605E5C] dark:text-[#a19f9d]" />
              <span>{lang === 'ar' ? 'استيراد نسخة احتياطية' : 'Import JSON'}</span>
              <input
                type="file"
                accept=".json"
                onChange={onImportBackup}
                className="hidden"
              />
            </label>

            {onOpenBulkImport && (
              <button
                type="button"
                onClick={onOpenBulkImport}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-[4px] bg-[#FFFFFF] dark:bg-[#252423] hover:bg-[#F3F2F1] dark:hover:bg-[#2d2c2c] text-[#107C41] border border-[#107C41] text-xs font-semibold transition-colors cursor-pointer"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-[#107C41]" />
                <span>{lang === 'ar' ? 'استيراد مجمع (Excel / CSV)' : 'Bulk Excel Import'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={onResetDatabase}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-[4px] bg-[#FFFFFF] dark:bg-[#252423] hover:bg-[#FDF3F3] dark:hover:bg-[#3a1d1d] text-[#A80000] dark:text-[#f87171] border border-[#E0A8A8] dark:border-[#7f1d1d] text-xs font-semibold transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5 text-[#A80000] dark:text-[#f87171]" />
              <span>{lang === 'ar' ? 'تفريغ ومسح كافة البيانات' : 'Reset & Empty Database'}</span>
            </button>
          </div>
        </div>

        {/* Netlify Deployment Section */}
        <div className="bg-[#FFFFFF] dark:bg-[#201f1e] border border-[#EDEBE9] dark:border-[#3b3a39] rounded-[4px] p-4 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 border border-[#C7E0F4] dark:border-[#1e3a8a] bg-[#EFF6FC] dark:bg-[#112338] rounded-[4px] text-[#0078D4] dark:text-[#60a5fa]">
                <Cloud className="w-5 h-5" />
              </div>
              <div>
                <div className="font-semibold text-sm text-[#242424] dark:text-[#f3f2f1] flex items-center gap-2">
                  <span>{lang === 'ar' ? 'نشر الموقع واستضافته على Netlify مجاناً' : 'Deploy & Host on Netlify'}</span>
                  <span className="text-[10px] px-2 py-0.5 bg-[#EFF6FC] dark:bg-[#112338] text-[#0078D4] dark:text-[#60a5fa] border border-[#C7E0F4] dark:border-[#1e3a8a] rounded-[4px] font-mono font-semibold">
                    {lang === 'ar' ? 'جاهز للنشر' : 'Production Ready'}
                  </span>
                </div>
                <p className="text-xs text-[#605E5C] dark:text-[#a19f9d] mt-0.5">
                  {lang === 'ar'
                    ? 'تم تجهيز ملفات الاستضافة في حزمة جاهزة للسحب والإفلات على app.netlify.com/drop أو الرفع عبر GitHub.'
                    : 'The project is pre-built ready for instant deployment on Netlify.'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => setShowNetlifyModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-[4px] bg-[#FFFFFF] dark:bg-[#252423] hover:bg-[#F3F2F1] dark:hover:bg-[#2d2c2c] text-[#242424] dark:text-[#f3f2f1] border border-[#EDEBE9] dark:border-[#3b3a39] text-xs font-semibold transition-colors cursor-pointer"
              >
                <HelpCircle className="w-4 h-4 text-[#605E5C] dark:text-[#a19f9d]" />
                <span>{lang === 'ar' ? 'دليل خطوات الاستضافة' : 'View Netlify Guide'}</span>
              </button>
            </div>
          </div>
        </div>
      </form>

      {/* Fast Google Apps Script Backend Code Modal */}
      {showScriptModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#FFFFFF] dark:bg-[#201f1e] border border-[#EDEBE9] dark:border-[#3b3a39] rounded-[4px] w-full max-w-4xl max-h-[92vh] flex flex-col shadow-lg overflow-hidden text-[#242424] dark:text-[#f3f2f1]">
            <div className="p-4 border-b border-[#EDEBE9] dark:border-[#3b3a39] flex items-center justify-between bg-[#FAF9F8] dark:bg-[#2d2c2c]">
              <div className="flex items-center gap-2.5">
                <Code className="w-5 h-5 text-[#0078D4] dark:text-[#2899f5]" />
                <div>
                  <div className="font-semibold text-sm text-[#242424] dark:text-[#f3f2f1] flex items-center gap-2">
                    <span>{lang === 'ar' ? 'كود Google Apps Script السريع (Code.gs)' : 'Fast Google Apps Script Backend (Code.gs)'}</span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowScriptModal(false)}
                className="p-1 text-[#605E5C] dark:text-[#a19f9d] hover:text-[#242424] dark:hover:text-[#f3f2f1] hover:bg-[#EDEBE9] dark:hover:bg-[#3b3a39] rounded-[4px] transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex items-center border-b border-[#EDEBE9] dark:border-[#3b3a39] bg-[#FFFFFF] dark:bg-[#201f1e] px-4 gap-2">
              <button
                type="button"
                onClick={() => setScriptModalTab('code')}
                className={`py-2.5 px-3 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
                  scriptModalTab === 'code'
                    ? 'border-[#0078D4] text-[#0078D4] dark:text-[#2899f5]'
                    : 'border-transparent text-[#605E5C] dark:text-[#a19f9d] hover:text-[#242424] dark:hover:text-[#f3f2f1]'
                }`}
              >
                <FileCode className="w-4 h-4 inline mr-1" />
                <span>{lang === 'ar' ? 'كود السكريبت (Code.gs)' : 'Script (Code.gs)'}</span>
              </button>

              <button
                type="button"
                onClick={() => setScriptModalTab('instructions')}
                className={`py-2.5 px-3 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
                  scriptModalTab === 'instructions'
                    ? 'border-[#0078D4] text-[#0078D4] dark:text-[#2899f5]'
                    : 'border-transparent text-[#605E5C] dark:text-[#a19f9d] hover:text-[#242424] dark:hover:text-[#f3f2f1]'
                }`}
              >
                <HelpCircle className="w-4 h-4 inline mr-1" />
                <span>{lang === 'ar' ? 'طريقة التركيب' : 'Setup Guide'}</span>
              </button>
            </div>

            <div className="p-4 space-y-4 overflow-y-auto flex-1 text-xs">
              {scriptModalTab === 'code' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2 p-3 bg-[#FAF9F8] dark:bg-[#252423] border border-[#EDEBE9] dark:border-[#3b3a39] rounded-[4px]">
                    <div className="flex items-center gap-2 text-[#242424] dark:text-[#f3f2f1] font-mono">
                      <span className="font-semibold">Code.gs</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(APPS_SCRIPT_CODE);
                        setCopiedCode(true);
                        setTimeout(() => setCopiedCode(false), 2500);
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-[4px] bg-[#0078D4] hover:bg-[#106EBE] text-white font-semibold text-xs transition-colors cursor-pointer"
                    >
                      {copiedCode ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedCode ? (lang === 'ar' ? 'تم النسخ!' : 'Copied!') : (lang === 'ar' ? 'نسخ الكود' : 'Copy Code')}</span>
                    </button>
                  </div>

                  <div className="border border-[#EDEBE9] dark:border-[#3b3a39] bg-[#FAF9F8] dark:bg-[#11100f] rounded-[4px]">
                    <pre className="p-4 text-[11px] font-mono text-[#242424] dark:text-[#f3f2f1] overflow-x-auto max-h-[500px] leading-relaxed">
                      {APPS_SCRIPT_CODE}
                    </pre>
                  </div>
                </div>
              )}

              {scriptModalTab === 'instructions' && (
                <div className="space-y-3 text-[#242424] dark:text-[#f3f2f1]">
                  <div className="p-3 bg-[#FAF9F8] dark:bg-[#252423] border border-[#EDEBE9] dark:border-[#3b3a39] rounded-[4px] space-y-1">
                    <div className="font-semibold text-[#242424] dark:text-[#f3f2f1]">1. افتح جدول Google Sheet</div>
                    <p className="text-[#605E5C] dark:text-[#a19f9d] text-xs">من القائمة العلوية داخل الشيت، اضغط على: الامتدادات (Extensions) &gt; Apps Script.</p>
                  </div>
                  <div className="p-3 bg-[#FAF9F8] dark:bg-[#252423] border border-[#EDEBE9] dark:border-[#3b3a39] rounded-[4px] space-y-1">
                    <div className="font-semibold text-[#242424] dark:text-[#f3f2f1]">2. لصق الكود وحفظه</div>
                    <p className="text-[#605E5C] dark:text-[#a19f9d] text-xs">امسح الكود الموجود والصق كود Code.gs ثم احفظ الملف.</p>
                  </div>
                  <div className="p-3 bg-[#FAF9F8] dark:bg-[#252423] border border-[#EDEBE9] dark:border-[#3b3a39] rounded-[4px] space-y-1">
                    <div className="font-semibold text-[#242424] dark:text-[#f3f2f1]">3. نشر تطبيق الويب (Deploy)</div>
                    <p className="text-[#605E5C] dark:text-[#a19f9d] text-xs">اضغط Deploy &gt; New deployment &gt; Web app &gt; Execute as Me &gt; Who has access: Anyone.</p>
                  </div>
                </div>
              )}
            </div>

            <div className="p-3 bg-[#FAF9F8] dark:bg-[#2d2c2c] border-t border-[#EDEBE9] dark:border-[#3b3a39] flex justify-end">
              <button
                type="button"
                onClick={() => setShowScriptModal(false)}
                className="px-4 py-1.5 rounded-[4px] bg-[#FFFFFF] dark:bg-[#252423] hover:bg-[#F3F2F1] dark:hover:bg-[#3b3a39] text-[#242424] dark:text-[#f3f2f1] border border-[#EDEBE9] dark:border-[#3b3a39] text-xs font-semibold transition-colors cursor-pointer"
              >
                {lang === 'ar' ? 'إغلاق' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Diagnostics Modal */}
      {showDiagnosticModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#FFFFFF] dark:bg-[#201f1e] border border-[#EDEBE9] dark:border-[#3b3a39] rounded-[4px] w-full max-w-xl shadow-lg overflow-hidden text-[#242424] dark:text-[#f3f2f1]">
            <div className="p-4 border-b border-[#EDEBE9] dark:border-[#3b3a39] flex items-center justify-between bg-[#FAF9F8] dark:bg-[#2d2c2c]">
              <div className="flex items-center gap-2 font-semibold text-sm">
                <Activity className="w-5 h-5 text-[#0078D4] dark:text-[#2899f5]" />
                <span>{lang === 'ar' ? 'تقرير فحص وتشخيص الاتصال السحابي' : 'Cloud Connection Diagnostics Report'}</span>
              </div>
              <button
                type="button"
                onClick={() => setShowDiagnosticModal(false)}
                className="p-1 text-[#605E5C] dark:text-[#a19f9d] hover:text-[#242424] dark:hover:text-[#f3f2f1] hover:bg-[#EDEBE9] dark:hover:bg-[#3b3a39] rounded-[4px]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              {isDiagnosing ? (
                <div className="py-8 text-center space-y-3 font-mono">
                  <RefreshCw className="w-8 h-8 text-[#0078D4] dark:text-[#2899f5] animate-spin mx-auto" />
                  <div className="font-semibold text-[#242424] dark:text-[#f3f2f1] text-sm">
                    {lang === 'ar' ? 'جارِ فحص الاتصال...' : 'Testing Connection...'}
                  </div>
                </div>
              ) : diagnosticResult ? (
                <div className="space-y-4">
                  <div className={`p-4 rounded-[4px] border ${
                    diagnosticResult.success
                      ? 'bg-[#EFF6FC] dark:bg-[#112338] border-[#C7E0F4] dark:border-[#1e3a8a] text-[#0078D4] dark:text-[#60a5fa]'
                      : 'bg-[#FDF3F3] dark:bg-[#3a1d1d] border-[#E0A8A8] dark:border-[#7f1d1d] text-[#A80000] dark:text-[#f87171]'
                  }`}>
                    <div className="font-semibold text-sm">
                      {diagnosticResult.message}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="p-3 bg-[#FAF9F8] dark:bg-[#2d2c2c] border-t border-[#EDEBE9] dark:border-[#3b3a39] flex justify-end">
              <button
                type="button"
                onClick={() => setShowDiagnosticModal(false)}
                className="px-4 py-1.5 rounded-[4px] bg-[#FFFFFF] dark:bg-[#252423] hover:bg-[#F3F2F1] dark:hover:bg-[#3b3a39] text-[#242424] dark:text-[#f3f2f1] border border-[#EDEBE9] dark:border-[#3b3a39] text-xs font-semibold"
              >
                {lang === 'ar' ? 'إغلاق' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Netlify Guide Modal */}
      {showNetlifyModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#FFFFFF] dark:bg-[#201f1e] border border-[#EDEBE9] dark:border-[#3b3a39] rounded-[4px] w-full max-w-2xl overflow-hidden text-[#242424] dark:text-[#f3f2f1] shadow-lg">
            <div className="p-4 border-b border-[#EDEBE9] dark:border-[#3b3a39] flex items-center justify-between bg-[#FAF9F8] dark:bg-[#2d2c2c]">
              <div className="flex items-center gap-2 font-semibold text-sm">
                <Cloud className="w-5 h-5 text-[#0078D4] dark:text-[#2899f5]" />
                <span>{lang === 'ar' ? 'طريقة استضافة ونشر الموقع على Netlify' : 'How to Deploy on Netlify'}</span>
              </div>
              <button
                type="button"
                onClick={() => setShowNetlifyModal(false)}
                className="p-1 text-[#605E5C] dark:text-[#a19f9d] hover:text-[#242424] dark:hover:text-[#f3f2f1] hover:bg-[#EDEBE9] dark:hover:bg-[#3b3a39] rounded-[4px]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-3 text-xs leading-relaxed text-[#242424] dark:text-[#f3f2f1]">
              <p>{lang === 'ar' ? 'يمكن رفع مجلد dist مباشرة عبر Netlify Drop أو ربط حساب GitHub للتحديث التلقائي.' : 'Deploy dist folder via Netlify Drop or link GitHub.'}</p>
            </div>

            <div className="p-3 bg-[#FAF9F8] dark:bg-[#2d2c2c] border-t border-[#EDEBE9] dark:border-[#3b3a39] flex justify-end">
              <button
                type="button"
                onClick={() => setShowNetlifyModal(false)}
                className="px-4 py-1.5 rounded-[4px] bg-[#FFFFFF] dark:bg-[#252423] hover:bg-[#F3F2F1] dark:hover:bg-[#3b3a39] text-[#242424] dark:text-[#f3f2f1] border border-[#EDEBE9] dark:border-[#3b3a39] text-xs font-semibold"
              >
                {lang === 'ar' ? 'إغلاق' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
