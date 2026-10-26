import React, { useState, useMemo } from 'react';
import { Archive, RotateCcw, ArrowUpDown, ArrowDownAZ, ArrowUpZA } from 'lucide-react';
import { Patient } from '../../types/pharmacy';

interface ArchiveViewProps {
  patients: Patient[];
  lang: 'ar' | 'en';
  onRestorePatient: (patientId: string) => void;
}

export const ArchiveView: React.FC<ArchiveViewProps> = ({
  patients,
  lang,
  onRestorePatient,
}) => {
  const [sortOrder, setSortOrder] = useState<'default' | 'asc' | 'desc'>('default');

  const archived = useMemo(() => {
    const list = patients.filter(p => p.isArchived);
    if (sortOrder === 'default') return list;

    const collator = new Intl.Collator([lang === 'ar' ? 'ar' : 'en', 'ar', 'en'], {
      sensitivity: 'base',
      numeric: true,
    });

    return [...list].sort((a, b) => {
      const cmp = collator.compare((a.name || '').trim(), (b.name || '').trim());
      return sortOrder === 'asc' ? cmp : -cmp;
    });
  }, [patients, sortOrder, lang]);

  return (
    <div className="space-y-4 bg-transparent text-[#242424] dark:text-[#f3f2f1]">
      <div className="bg-[#FFFFFF] dark:bg-[#201f1e] border border-[#EDEBE9] dark:border-[#3b3a39] rounded-[4px] p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="font-semibold text-lg text-[#242424] dark:text-[#f3f2f1] flex items-center gap-2 tracking-tight">
            <Archive className="w-5 h-5 text-[#0078D4] dark:text-[#2899f5]" />
            <span>{lang === 'ar' ? 'سجل المرضى المؤرشفين' : 'Archived Patients Archive'}</span>
          </div>
          <p className="text-xs text-[#605E5C] dark:text-[#a19f9d]">
            {lang === 'ar'
              ? 'الملفات التي تم تعطيلها مؤقتاً أو نقلها إلى الأرشيف مع إمكانية استعادتها بجميع سجلاتها بضغطة واحدة.'
              : 'Patients marked as inactive or archived. Can be restored anytime with all past vitals and regimens intact.'}
          </p>
        </div>

        {/* Quick Sort Toggle for Archived */}
        <div className="inline-flex rounded-[4px] border border-[#EDEBE9] dark:border-[#3b3a39] bg-[#FAF9F8] dark:bg-[#252423] p-0.5 text-xs self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setSortOrder(prev => (prev === 'asc' ? 'default' : 'asc'))}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-[3px] font-semibold transition-all cursor-pointer ${
              sortOrder === 'asc'
                ? 'bg-[#EFF6FC] dark:bg-[#112338] text-[#0078D4] dark:text-[#60a5fa] border border-[#C7E0F4] dark:border-[#1e3a8a]'
                : 'text-[#605E5C] dark:text-[#a19f9d] hover:text-[#242424] dark:hover:text-[#f3f2f1] hover:bg-[#F3F2F1] dark:hover:bg-[#2d2c2c]'
            }`}
            title={lang === 'ar' ? 'ترتيب تصاعدي: أ إلى ي (A → Z)' : 'Sort Ascending: A → Z (أ → ي)'}
          >
            <ArrowDownAZ className="w-3.5 h-3.5" />
            <span>{lang === 'ar' ? 'أ → ي' : 'A → Z'}</span>
          </button>
          <button
            type="button"
            onClick={() => setSortOrder(prev => (prev === 'desc' ? 'default' : 'desc'))}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-[3px] font-semibold transition-all cursor-pointer ${
              sortOrder === 'desc'
                ? 'bg-[#EFF6FC] dark:bg-[#112338] text-[#0078D4] dark:text-[#60a5fa] border border-[#C7E0F4] dark:border-[#1e3a8a]'
                : 'text-[#605E5C] dark:text-[#a19f9d] hover:text-[#242424] dark:hover:text-[#f3f2f1] hover:bg-[#F3F2F1] dark:hover:bg-[#2d2c2c]'
            }`}
            title={lang === 'ar' ? 'ترتيب تنازلي: ي إلى أ (Z → A)' : 'Sort Descending: Z → A (ي → أ)'}
          >
            <ArrowUpZA className="w-3.5 h-3.5" />
            <span>{lang === 'ar' ? 'ي → أ' : 'Z → A'}</span>
          </button>
        </div>
      </div>

      <div className="bg-[#FFFFFF] dark:bg-[#201f1e] border border-[#EDEBE9] dark:border-[#3b3a39] rounded-[4px] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right dir-rtl text-xs border-collapse">
            <thead className="bg-[#FAF9F8] dark:bg-[#2d2c2c] text-[#242424] dark:text-[#f3f2f1] border-b border-[#EDEBE9] dark:border-[#3b3a39]">
              <tr>
                <th className="py-2.5 px-3 text-[11px] uppercase tracking-wider">
                  <button
                    type="button"
                    onClick={() => {
                      setSortOrder(prev => {
                        if (prev === 'default') return 'asc';
                        if (prev === 'asc') return 'desc';
                        return 'default';
                      });
                    }}
                    className={`flex items-center gap-1.5 font-semibold transition-colors cursor-pointer group ${
                      sortOrder !== 'default' ? 'text-[#0078D4] dark:text-[#2899f5]' : 'text-[#242424] dark:text-[#f3f2f1] hover:text-[#0078D4] dark:hover:text-[#2899f5]'
                    }`}
                    title={lang === 'ar' ? 'انقر للترتيب الأبجدي أ-ي أو ي-أ' : 'Click to sort: A-Z / أ-ي'}
                  >
                    <span>{lang === 'ar' ? 'المريض' : 'Patient'}</span>
                    {sortOrder === 'asc' ? (
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-[2px] bg-[#EFF6FC] dark:bg-[#112338] text-[#0078D4] dark:text-[#60a5fa] border border-[#C7E0F4] dark:border-[#1e3a8a] text-[10px] font-mono font-bold">
                        <ArrowDownAZ className="w-3 h-3" />
                        <span>{lang === 'ar' ? 'أ-ي' : 'A-Z'}</span>
                      </span>
                    ) : sortOrder === 'desc' ? (
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-[2px] bg-[#EFF6FC] dark:bg-[#112338] text-[#0078D4] dark:text-[#60a5fa] border border-[#C7E0F4] dark:border-[#1e3a8a] text-[10px] font-mono font-bold">
                        <ArrowUpZA className="w-3 h-3" />
                        <span>{lang === 'ar' ? 'ي-أ' : 'Z-A'}</span>
                      </span>
                    ) : (
                      <ArrowUpDown className="w-3 h-3 text-[#605E5C] dark:text-[#a19f9d] opacity-60 group-hover:opacity-100" />
                    )}
                  </button>
                </th>
                <th className="py-2.5 px-3 text-[11px] uppercase tracking-wider">{lang === 'ar' ? 'الهاتف' : 'Phone'}</th>
                <th className="py-2.5 px-3 text-[11px] uppercase tracking-wider">{lang === 'ar' ? 'سبب الأرشفة' : 'Reason'}</th>
                <th className="py-2.5 px-3 text-[11px] uppercase tracking-wider">{lang === 'ar' ? 'تاريخ الأرشفة' : 'Archived Date'}</th>
                <th className="py-2.5 px-3 text-[11px] uppercase tracking-wider text-center">{lang === 'ar' ? 'استعادة' : 'Restore'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EDEBE9] dark:divide-[#3b3a39] text-[#242424] dark:text-[#f3f2f1]">
              {archived.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-[#605E5C] dark:text-[#a19f9d]">
                    {lang === 'ar' ? 'الأرشيف فارغ حالياً.' : 'Archive is empty.'}
                  </td>
                </tr>
              ) : (
                archived.map(p => (
                  <tr key={p.id} className="hover:bg-[#F3F2F1] dark:hover:bg-[#252423] transition-colors">
                    <td className="py-2.5 px-3 font-semibold text-[#242424] dark:text-[#f3f2f1]">{p.name}</td>
                    <td className="py-2.5 px-3 font-mono text-[#605E5C] dark:text-[#a19f9d]">{p.phone}</td>
                    <td className="py-2.5 px-3 text-[#605E5C] dark:text-[#a19f9d]">{p.archiveReason || (lang === 'ar' ? 'تحويل إلى الأرشيف' : 'Archived')}</td>
                    <td className="py-2.5 px-3 font-mono text-[#605E5C] dark:text-[#a19f9d]">{p.archivedDate || '—'}</td>
                    <td className="py-2.5 px-3 text-center">
                      <button
                        onClick={() => onRestorePatient(p.id)}
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-[4px] bg-[#0078D4] hover:bg-[#106EBE] active:bg-[#005A9E] text-white font-semibold transition-colors cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>{lang === 'ar' ? 'استعادة الملف' : 'Restore'}</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
