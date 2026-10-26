import { Patient, Medication } from '../types/pharmacy';
import { calculateDaysRemaining, formatPhoneForWhatsApp, formatYMD } from './pharmacyCalculations';

export interface CrossSellItem {
  id: string;
  name: string;
  nameEn: string;
  category: 'supplement' | 'device' | 'care' | 'hygiene';
  targetCondition: string;
  targetConditionEn: string;
  triggerDrugs: string[];
  clinicalRationaleAr: string;
  clinicalRationaleEn: string;
  suggestedAction: string;
  estimatedMargin?: string;
}

export const CLINICAL_CROSS_SELL_CATALOG: CrossSellItem[] = [
  {
    id: 'cs-b12',
    name: 'فيتامين B12 / نيوروبيون (Neurobion)',
    nameEn: 'Vitamin B12 / Neurobion Complex',
    category: 'supplement',
    targetCondition: 'داء السكري (مستخدمي الميتفورمين)',
    targetConditionEn: 'Diabetes (Metformin users)',
    triggerDrugs: ['glucophage', 'metformin', 'كلوكوفيج', 'ميتفورمين', 'janumet', 'جانومايت'],
    clinicalRationaleAr: 'الميتفورمين يقلل امتصاص فيتامين B12 بنسبة تصل إلى 30%؛ مكمل B12 يقي من التنميل والاعتلال العصبي السكري المحيطي.',
    clinicalRationaleEn: 'Metformin depletes Vitamin B12 absorption; co-supplementation prevents diabetic peripheral neuropathy.',
    suggestedAction: 'اقتراح حبة يومياً أو إبرة أسبوعية لدعم الأعصاب',
    estimatedMargin: 'عالي الربحية (High Margin)',
  },
  {
    id: 'cs-glucometer',
    name: 'أشرطة فحص السكر ووخازات معقمة',
    nameEn: 'Blood Glucose Test Strips & Lancets',
    category: 'device',
    targetCondition: 'متابعة السكري المنزلية',
    targetConditionEn: 'Home Diabetes Monitoring',
    triggerDrugs: ['glucophage', 'metformin', 'insulin', 'diamicron', 'amaryl', 'januvia', 'انسولين', 'أماريل', 'دايمكرون'],
    clinicalRationaleAr: 'متابعة السكر الصيامي وبعد الوجبات تضمن ضبط جرعات العلاج وتفادي نوبات هبوط السكر المفاجئة.',
    clinicalRationaleEn: 'Frequent glucose self-monitoring prevents hypoglycemia and verifies glycemic target stability.',
    suggestedAction: 'تذكير بتجديد علبة الأشرطة الشهرية مع كل صرف دوائي',
    estimatedMargin: 'استهلاك شهري متكرر (Recurring)',
  },
  {
    id: 'cs-foot-care',
    name: 'كريم يوريا طبي للعناية بالقدم السكرية (Urea 10-20%)',
    nameEn: 'Diabetic Foot Urea Moisturizing Cream',
    category: 'care',
    targetCondition: 'الوقاية من جفاف وتقرحات القدم',
    targetConditionEn: 'Diabetic Foot Ulcer Prevention',
    triggerDrugs: ['glucophage', 'metformin', 'insulin', 'jardiance', 'forxiga', 'انسولين'],
    clinicalRationaleAr: 'مرضى السكري معرضون لجفاف وتشقق الكعبين والتقرحات؛ الترطيب اليومي باليوريا يمنع مضاعفات القدم السكرية الخطيرة.',
    clinicalRationaleEn: 'Diabetic anhidrosis leads to heel cracking and ulcers; daily urea restores skin integrity.',
    suggestedAction: 'إرشاده لتطبيقه يومياً بين الأصابع والكعبين',
    estimatedMargin: 'عناية سريرية ذات قيمة مضافة',
  },
  {
    id: 'cs-coq10',
    name: 'مساعد الإنزيم كيو 10 (Coenzyme Q10 100-200mg)',
    nameEn: 'Coenzyme Q10 (CoQ10 100mg)',
    category: 'supplement',
    targetCondition: 'مرضى الكولسترول والدهون (مستخدمي الستاتين)',
    targetConditionEn: 'Dyslipidemia (Statin users)',
    triggerDrugs: ['atorvastatin', 'lipitor', 'rosuvastatin', 'crestor', 'simvastatin', 'ليبيتور', 'كريستور', 'أتورفاستاتين'],
    clinicalRationaleAr: 'أدوية الستاتين تثبط إنتاج CoQ10 الطبيعي في الجسم بنسبة 40% مما يسبب آلام وهن العضلات؛ تعويضه يحمي العضلات ويدعم طاقة عضلة القلب.',
    clinicalRationaleEn: 'Statins deplete endogenous CoQ10 leading to myalgia; supplementation relieves muscle fatigue.',
    suggestedAction: 'اقتراح كبسولة واحدة يومياً مع وجبة دهنية',
    estimatedMargin: 'منتج راقٍ وعالي العائد',
  },
  {
    id: 'cs-omega3',
    name: 'أوميغا 3 عالي النقاوة (Omega-3 Fish Oil 1000mg EPA/DHA)',
    nameEn: 'Ultra-Pure Omega-3 Fish Oil 1000mg',
    category: 'supplement',
    targetCondition: 'صحة الأوعية الدموية وتخفيض الدهون الثلاثية',
    targetConditionEn: 'Cardiovascular Support & Triglyceride Reduction',
    triggerDrugs: ['lipitor', 'crestor', 'atorvastatin', 'rosuvastatin', 'plavix', 'aspirin', 'أسبرين', 'بلافيكس'],
    clinicalRationaleAr: 'يعزز مرونة الشرايين ويخفض الدهون الثلاثية (Triglycerides) ويعمل بتآزر ممتاز مع أدوية الكولسترول والضغط.',
    clinicalRationaleEn: 'Reduces triglycerides, optimizes vascular elasticity, and synergizes with statin lipid therapy.',
    suggestedAction: 'تناول 1-2 كبسولة يومياً بعد الأكل',
    estimatedMargin: 'مبيعات متكررة ممتازة',
  },
  {
    id: 'cs-bp-monitor',
    name: 'جهاز قياس ضغط الدم الرقمي المنزلي (Digital BP Monitor)',
    nameEn: 'Home Digital Blood Pressure Monitor',
    category: 'device',
    targetCondition: 'ارتفاع ضغط الدم والقلب',
    targetConditionEn: 'Hypertension & Cardiac Care',
    triggerDrugs: ['concor', 'bisoprolol', 'valsartan', 'diovan', 'amlodipine', 'exforge', 'نورفاسك', 'كنكور', 'فالسارتان', 'أكسفورج'],
    clinicalRationaleAr: 'تسجيل قراءات الضغط في الصباح والمساء يتيح للصيدلي والطبيب تقييم فاعلية الجرعة واستبعاد متلازمة المعطف الأبيض.',
    clinicalRationaleEn: 'Home BP profiling identifies white-coat or masked hypertension and confirms therapeutic response.',
    suggestedAction: 'عرض الجهاز مع تدريب المريض مجاناً على طريقة القياس الصحيحة',
    estimatedMargin: 'قيمة فاتورة مرتفعة (High Basket Value)',
  },
  {
    id: 'cs-intimate-wash',
    name: 'غسول طبي وقائي للمسالك البولية (pH Balanced Wash)',
    nameEn: 'Intimate Protective Hydrating Wash',
    category: 'hygiene',
    targetCondition: 'مستخدمي مثبطات SGLT2 (فوركسيجا / جارديانس)',
    targetConditionEn: 'SGLT2 Inhibitor Therapy (Jardiance / Forxiga)',
    triggerDrugs: ['jardiance', 'forxiga', 'empagliflozin', 'dapagliflozin', 'جارديانس', 'فوركسيجا', 'synjardy', 'سيناجاردي'],
    clinicalRationaleAr: 'أدوية SGLT2 تطرح السكر في البول مما يزيد احتمالية التهابات المسالك التناسلية والفطرية بنسبة 3 أضعاف؛ الغسول الوقائي وشرب الماء يحمي المريض.',
    clinicalRationaleEn: 'SGLT2 inhibitors induce glucosuria, tripling genital mycotic infection risk; preventative hygiene is essential.',
    suggestedAction: 'تقديم نصيحة النظافة الوقائية وزيادة السوائل مع بيع الغسول المناسب',
    estimatedMargin: 'رعاية صيدلانية متخصصة',
  },
  {
    id: 'cs-magnesium-calcium',
    name: 'كالسيوم سترات + فيتامين D3 ومغنيسيوم',
    nameEn: 'Calcium Citrate + Vitamin D3 & Magnesium',
    category: 'supplement',
    targetCondition: 'مستخدمي مضادات الحموضة وPPIs لفترات طويلة',
    targetConditionEn: 'Long-term PPI use (Omeprazole, Nexium)',
    triggerDrugs: ['nexium', 'esomeprazole', 'omeprazole', 'controloc', 'pantoprazole', 'نيكسيوم', 'كونترولوك', 'أوميبرازول'],
    clinicalRationaleAr: 'تثبيط حمض المعدة المزمن يقلل امتصاص الكالسيوم والمغنيسيوم ويزيد هشاشة العظام؛ سترات الكالسيوم مع D3 يمتص دون الحاجة لحموضة المعدة.',
    clinicalRationaleEn: 'Chronic hypochlorhydria impairs calcium and magnesium absorption; calcium citrate absorbs independently of pH.',
    suggestedAction: 'حبة يومياً للحفاظ على كثافة العظام وصحة العضلات',
    estimatedMargin: 'عالي الطلب',
  },
];

/**
 * Evaluates patient's medications and returns personalized cross-selling items
 */
export function getCrossSellRecommendations(medications: Medication[]): CrossSellItem[] {
  if (!medications || medications.length === 0) return [];

  const medNamesStr = medications
    .map(m => (m.name || '').toLowerCase())
    .join(' ');

  const matched: CrossSellItem[] = [];

  for (const item of CLINICAL_CROSS_SELL_CATALOG) {
    const hits = item.triggerDrugs.some(trigger => medNamesStr.includes(trigger.toLowerCase()));
    if (hits) {
      matched.push(item);
    }
  }

  // Deduplicate and limit to top 4 recommendations to avoid overwhelming
  return matched.slice(0, 4);
}

export interface LabRadarItem {
  id: string;
  testCategory: 'hba1c' | 'renal' | 'lipid' | 'liver' | 'thyroid' | 'urine_acr' | 'cbc' | 'general';
  testNameAr: string;
  testNameEn: string;
  category: 'diabetes' | 'renal' | 'cardiac' | 'liver' | 'general' | 'thyroid';
  frequencyDays: number;
  frequencyLabelAr: string;
  frequencyLabelEn: string;
  lastDoneDate?: string;
  lastRecordedValue?: string;
  lastStatus?: 'normal' | 'borderline' | 'abnormal' | 'critical';
  daysSinceLast?: number;
  daysOverdue: number;
  status: 'overdue' | 'due_soon' | 'up_to_date';
  clinicalRationaleAr: string;
  clinicalRationaleEn: string;
  recommendedActionAr: string;
  recommendedActionEn: string;
  requiresFasting?: boolean;
  fastingNoteAr?: string;
  triggerDrugs?: string[];
  referenceTarget?: string;
}

/**
 * Evaluates periodic laboratory test surveillance for a patient
 */
export function getPatientLabRadar(patient: Patient): LabRadarItem[] {
  const radar: LabRadarItem[] = [];
  if (!patient || !patient.medications) return radar;

  const now = new Date();
  const medNames = (patient.medications || []).map(m => (m.name || '').toLowerCase()).join(' ');

  // Helper to find latest structured lab test of a specific category
  const findLatestLab = (category: string) => {
    if (!patient.labResults || patient.labResults.length === 0) return null;
    const matches = patient.labResults.filter(l => l.testCategory === category);
    if (matches.length === 0) return null;
    return matches.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
  };

  // 1. HbA1c surveillance for diabetic patients
  const isDiabetic =
    medNames.includes('glucophage') ||
    medNames.includes('metformin') ||
    medNames.includes('insulin') ||
    medNames.includes('diamicron') ||
    medNames.includes('amaryl') ||
    medNames.includes('januvia') ||
    medNames.includes('jardiance') ||
    medNames.includes('forxiga') ||
    medNames.includes('glimepiride') ||
    medNames.includes('gliclazide') ||
    medNames.includes('كلوكوفيج') ||
    medNames.includes('ميتفورمين') ||
    medNames.includes('انسولين') ||
    medNames.includes('أماريل') ||
    (patient.vitals || []).some(v => v.hba1c && v.hba1c.trim()) ||
    (patient.labResults || []).some(l => l.testCategory === 'hba1c');

  if (isDiabetic) {
    const latestStructured = findLatestLab('hba1c');
    let latestDate: string | undefined = latestStructured?.date;
    let latestVal: string | undefined = latestStructured
      ? `${latestStructured.numericValue ?? ''} ${latestStructured.unit || '%'}`.trim()
      : undefined;
    let latestStatus = latestStructured?.status;

    // Fallback to vitals if no structured lab entry
    if (!latestDate) {
      (patient.vitals || []).forEach(v => {
        if (v.hba1c && v.hba1c.trim() && (!latestDate || v.date > latestDate)) {
          latestDate = v.date;
          latestVal = v.hba1c;
        }
      });
    }

    const frequencyDays = 90; // Every 3 months
    let daysSince = 140; // Default assuming overdue if no record exists
    if (latestDate) {
      const diff = Math.floor((now.getTime() - new Date(latestDate).getTime()) / (1000 * 60 * 60 * 24));
      daysSince = Math.max(0, diff);
    }

    const daysOverdue = daysSince - frequencyDays;
    const status: LabRadarItem['status'] =
      daysOverdue > 10 ? 'overdue' : daysOverdue >= -15 ? 'due_soon' : 'up_to_date';

    radar.push({
      id: 'lab-hba1c',
      testCategory: 'hba1c',
      testNameAr: 'فحص السكر التراكمي (HbA1c)',
      testNameEn: 'Glycated Hemoglobin (HbA1c)',
      category: 'diabetes',
      frequencyDays,
      frequencyLabelAr: 'كل 3 أشهر (90 يوم)',
      frequencyLabelEn: 'Every 3 months',
      lastDoneDate: latestDate,
      lastRecordedValue: latestVal,
      lastStatus: latestStatus,
      daysSinceLast: latestDate ? daysSince : undefined,
      daysOverdue: Math.max(0, daysOverdue),
      status,
      clinicalRationaleAr: 'المعيار الذهبي لتقييم ضبط السكر لآخر 3 أشهر، والوقاية من اعتلال الشرايين والأعصاب.',
      clinicalRationaleEn: 'Gold-standard for assessing 3-month glycemic control and preventing macro/microvascular complications.',
      recommendedActionAr: 'تذكير المريض بإجراء التحليل في المختبر (لا يتطلب صيام)',
      recommendedActionEn: 'Advise patient to schedule HbA1c test (fasting not required)',
      requiresFasting: false,
      fastingNoteAr: 'لا يشترط الصيام، يمكن إجراؤه في أي وقت من اليوم',
      triggerDrugs: ['Glucophage', 'Januvia', 'Amaryl', 'Insulin', 'Jardiance/Forxiga'],
      referenceTarget: '< 7.0% (أو حسب الفئة العمرية)',
    });
  }

  // 2. Renal & Electrolytes (Creatinine, Urea, eGFR, K+)
  const isRenalTarget =
    medNames.includes('valsartan') ||
    medNames.includes('concor') ||
    medNames.includes('bisoprolol') ||
    medNames.includes('lisinopril') ||
    medNames.includes('enalapril') ||
    medNames.includes('captopril') ||
    medNames.includes('capoten') ||
    medNames.includes('losartan') ||
    medNames.includes('cozaar') ||
    medNames.includes('lasix') ||
    medNames.includes('furosemide') ||
    medNames.includes('aldactone') ||
    medNames.includes('spironolactone') ||
    medNames.includes('natrilix') ||
    medNames.includes('indapamide') ||
    medNames.includes('diovan') ||
    medNames.includes('exforge') ||
    medNames.includes('micardis') ||
    medNames.includes('telmisartan') ||
    medNames.includes('forxiga') ||
    medNames.includes('jardiance') ||
    medNames.includes('كنكور') ||
    medNames.includes('فالسارتان') ||
    medNames.includes('لازكس') ||
    medNames.includes('دايوفان') ||
    (patient.labResults || []).some(l => l.testCategory === 'renal');

  if (isRenalTarget) {
    const latestStructured = findLatestLab('renal');
    let latestDate: string | undefined = latestStructured?.date;
    let latestVal: string | undefined = latestStructured
      ? `${latestStructured.numericValue ?? ''} ${latestStructured.unit || 'mg/dL'}`.trim()
      : undefined;
    let latestStatus = latestStructured?.status;

    if (!latestDate) {
      const hasRenalScan = (patient.scans || []).some(
        s => (s.title || '').includes('كلى') || (s.title || '').toLowerCase().includes('renal') || (s.title || '').toLowerCase().includes('creatinine')
      );
      if (hasRenalScan) {
        latestDate = formatYMD(new Date(now.getTime() - 100 * 24 * 60 * 60 * 1000));
      }
    }

    const frequencyDays = 180; // Every 6 months
    let daysSince = 200;
    if (latestDate) {
      const diff = Math.floor((now.getTime() - new Date(latestDate).getTime()) / (1000 * 60 * 60 * 24));
      daysSince = Math.max(0, diff);
    }

    const daysOverdue = daysSince - frequencyDays;
    const status: LabRadarItem['status'] =
      daysOverdue > 15 ? 'overdue' : daysOverdue >= -20 ? 'due_soon' : 'up_to_date';

    radar.push({
      id: 'lab-renal',
      testCategory: 'renal',
      testNameAr: 'وظائف الكلى والأملاح (Creatinine / eGFR / K+)',
      testNameEn: 'Renal Function & Potassium (eGFR/Cr)',
      category: 'renal',
      frequencyDays,
      frequencyLabelAr: 'كل 6 أشهر (180 يوم)',
      frequencyLabelEn: 'Every 6 months',
      lastDoneDate: latestDate,
      lastRecordedValue: latestVal,
      lastStatus: latestStatus,
      daysSinceLast: latestDate ? daysSince : undefined,
      daysOverdue: Math.max(0, daysOverdue),
      status,
      clinicalRationaleAr: 'أدوية الضغط ومثبطات RAAS ومدرات البول تتطلب فحص دوري للكرياتينين والبوتاسيوم لمنع القصور الكلوي المفاجئ أو فرط البوتاسيوم.',
      clinicalRationaleEn: 'ACEi/ARBs & diuretics require semi-annual eGFR and K+ surveillance to prevent acute kidney injury or hyperkalemia.',
      recommendedActionAr: 'فحص مصل الكرياتينين، اليوريا، والبوتاسيوم',
      recommendedActionEn: 'Recommend baseline or follow-up serum creatinine & potassium test',
      requiresFasting: false,
      fastingNoteAr: 'لا يشترط الصيام، يفضل شرب الماء بشكل طبيعي قبل الفحص',
      triggerDrugs: ['Diovan/Valsartan', 'Exforge', 'Lasix', 'Aldactone', 'Forxiga/Jardiance'],
      referenceTarget: 'Creatinine: 0.7 - 1.2 mg/dL | K+: 3.5 - 5.0 mEq/L',
    });
  }

  // 3. Complete Lipid Profile (LDL-C, Triglycerides, Total Cholesterol)
  const isLipidTarget =
    medNames.includes('lipitor') ||
    medNames.includes('crestor') ||
    medNames.includes('atorvastatin') ||
    medNames.includes('rosuvastatin') ||
    medNames.includes('simvastatin') ||
    medNames.includes('sortiva') ||
    medNames.includes('torvacin') ||
    medNames.includes('ezetrol') ||
    medNames.includes('ezetimibe') ||
    medNames.includes('ليبيتور') ||
    medNames.includes('كريستور') ||
    medNames.includes('سورتيفا') ||
    (patient.labResults || []).some(l => l.testCategory === 'lipid');

  if (isLipidTarget) {
    const latestStructured = findLatestLab('lipid');
    let latestDate: string | undefined = latestStructured?.date;
    let latestVal: string | undefined = latestStructured
      ? `${latestStructured.numericValue ?? ''} ${latestStructured.unit || 'mg/dL'}`.trim()
      : undefined;
    let latestStatus = latestStructured?.status;

    const frequencyDays = 180; // Every 6 months
    let daysSince = 210;
    if (latestDate) {
      const diff = Math.floor((now.getTime() - new Date(latestDate).getTime()) / (1000 * 60 * 60 * 24));
      daysSince = Math.max(0, diff);
    }

    const daysOverdue = daysSince - frequencyDays;
    const status: LabRadarItem['status'] =
      daysOverdue > 15 ? 'overdue' : daysOverdue >= -20 ? 'due_soon' : 'up_to_date';

    radar.push({
      id: 'lab-lipid',
      testCategory: 'lipid',
      testNameAr: 'فحص الدهون الشامل (Lipid Profile: LDL / TG)',
      testNameEn: 'Complete Lipid Panel (LDL-C, TG, Total)',
      category: 'cardiac',
      frequencyDays,
      frequencyLabelAr: 'كل 6 أشهر (180 يوم)',
      frequencyLabelEn: 'Every 6-12 months',
      lastDoneDate: latestDate,
      lastRecordedValue: latestVal,
      lastStatus: latestStatus,
      daysSinceLast: latestDate ? daysSince : undefined,
      daysOverdue: Math.max(0, daysOverdue),
      status,
      clinicalRationaleAr: 'تقييم الوصول لمستويات الكولسترول الضار المستهدفة (LDL < 70 أو < 55 mg/dL) والوقاية من تصلب الشرايين.',
      clinicalRationaleEn: 'Confirms target LDL-C reduction (<70 or <55 mg/dL) to reduce acute coronary syndrome recurrence.',
      recommendedActionAr: 'إجراء فحص دهون صيامي مع الامتناع عن الأكل 10-12 ساعة',
      recommendedActionEn: 'Schedule a fasting lipid profile (10-12 hours fasting)',
      requiresFasting: true,
      fastingNoteAr: 'يشترط الصيام 10-12 ساعة (يُسمح بشرب الماء فقط)',
      triggerDrugs: ['Lipitor', 'Crestor', 'Sortiva', 'Atorvastatin'],
      referenceTarget: 'LDL-C: < 70 mg/dL (عالي الخطورة) | TG: < 150 mg/dL',
    });
  }

  // 4. Liver Enzymes (ALT / SGPT & AST) for Statins or Polypharmacy
  const isLiverTarget =
    isLipidTarget ||
    (patient.medications && patient.medications.length >= 4) ||
    (patient.labResults || []).some(l => l.testCategory === 'liver');

  if (isLiverTarget) {
    const latestStructured = findLatestLab('liver');
    let latestDate: string | undefined = latestStructured?.date;
    let latestVal: string | undefined = latestStructured
      ? `${latestStructured.numericValue ?? ''} ${latestStructured.unit || 'U/L'}`.trim()
      : undefined;
    let latestStatus = latestStructured?.status;

    const frequencyDays = 365; // Annually
    let daysSince = 300;
    if (latestDate) {
      const diff = Math.floor((now.getTime() - new Date(latestDate).getTime()) / (1000 * 60 * 60 * 24));
      daysSince = Math.max(0, diff);
    }

    const daysOverdue = daysSince - frequencyDays;
    const status: LabRadarItem['status'] =
      daysOverdue > 15 ? 'overdue' : daysOverdue >= -30 ? 'due_soon' : 'up_to_date';

    radar.push({
      id: 'lab-liver',
      testCategory: 'liver',
      testNameAr: 'إنزيمات الكبد (Liver Function: ALT / AST)',
      testNameEn: 'Liver Function Enzymes (ALT/AST)',
      category: 'liver',
      frequencyDays,
      frequencyLabelAr: 'كل سنة (365 يوم)',
      frequencyLabelEn: 'Every 12 months',
      lastDoneDate: latestDate,
      lastRecordedValue: latestVal,
      lastStatus: latestStatus,
      daysSinceLast: latestDate ? daysSince : undefined,
      daysOverdue: Math.max(0, daysOverdue),
      status,
      clinicalRationaleAr: 'التأكد من سلامة خلايا الكبد وتحمل الأدوية المزمنة ومخفضات الكوليسترول بدون التهاب أو سمية كبدية.',
      clinicalRationaleEn: 'Evaluates hepatic safety and drug tolerance during prolonged chronic polypharmacy.',
      recommendedActionAr: 'فحص أنزيم ALT (SGPT) الدوري',
      recommendedActionEn: 'Order periodic serum ALT/AST check',
      requiresFasting: false,
      fastingNoteAr: 'لا يشترط الصيام',
      triggerDrugs: ['Statins', 'Polypharmacy (>4 meds)'],
      referenceTarget: 'ALT: < 45 U/L | AST: < 40 U/L',
    });
  }

  // 5. Thyroid Function (TSH & Free T4)
  const isThyroidTarget =
    medNames.includes('eltroxin') ||
    medNames.includes('levothyroxine') ||
    medNames.includes('thyroxine') ||
    medNames.includes('التروكسين') ||
    medNames.includes('ثايروكسين') ||
    (patient.labResults || []).some(l => l.testCategory === 'thyroid');

  if (isThyroidTarget) {
    const latestStructured = findLatestLab('thyroid');
    let latestDate: string | undefined = latestStructured?.date;
    let latestVal: string | undefined = latestStructured
      ? `${latestStructured.numericValue ?? ''} ${latestStructured.unit || 'uIU/mL'}`.trim()
      : undefined;
    let latestStatus = latestStructured?.status;

    const frequencyDays = 180; // Every 6 months
    let daysSince = 190;
    if (latestDate) {
      const diff = Math.floor((now.getTime() - new Date(latestDate).getTime()) / (1000 * 60 * 60 * 24));
      daysSince = Math.max(0, diff);
    }

    const daysOverdue = daysSince - frequencyDays;
    const status: LabRadarItem['status'] =
      daysOverdue > 15 ? 'overdue' : daysOverdue >= -20 ? 'due_soon' : 'up_to_date';

    radar.push({
      id: 'lab-thyroid',
      testCategory: 'thyroid',
      testNameAr: 'هرمون الغدة الدرقية (TSH & Free T4)',
      testNameEn: 'Thyroid Stimulating Hormone (TSH / FT4)',
      category: 'thyroid',
      frequencyDays,
      frequencyLabelAr: 'كل 6 أشهر (180 يوم)',
      frequencyLabelEn: 'Every 6 months',
      lastDoneDate: latestDate,
      lastRecordedValue: latestVal,
      lastStatus: latestStatus,
      daysSinceLast: latestDate ? daysSince : undefined,
      daysOverdue: Math.max(0, daysOverdue),
      status,
      clinicalRationaleAr: 'ضبط جرعة ليفوثيروكسين لتفادي قصور الغدة أو فرط نشاطها غير المقصود وتسارع ضربات القلب.',
      clinicalRationaleEn: 'Ensures optimal Levothyroxine titration to maintain euthyroid state without cardiac palpitations.',
      recommendedActionAr: 'سحب عينة الدم صباحاً قبل أخذ حبة الثايروكسين',
      recommendedActionEn: 'Morning blood draw before taking daily thyroxine tablet',
      requiresFasting: true,
      fastingNoteAr: 'صيام صباحي وسحب الدم قبل تناول حبة الثايروكسين في ذلك اليوم',
      triggerDrugs: ['Eltroxin 50/100mcg', 'Levothyroxine'],
      referenceTarget: 'TSH: 0.4 - 4.0 uIU/mL (الهدف العلاجي 0.5 - 2.5)',
    });
  }

  // 6. Urine Albumin/Creatinine Ratio (ACR) for Diabetics & Hypertensives
  if (isDiabetic || isRenalTarget) {
    const latestStructured = findLatestLab('urine_acr');
    let latestDate: string | undefined = latestStructured?.date;
    let latestVal: string | undefined = latestStructured
      ? `${latestStructured.numericValue ?? ''} ${latestStructured.unit || 'mg/g'}`.trim()
      : undefined;
    let latestStatus = latestStructured?.status;

    const frequencyDays = 365; // Annually
    let daysSince = 340;
    if (latestDate) {
      const diff = Math.floor((now.getTime() - new Date(latestDate).getTime()) / (1000 * 60 * 60 * 24));
      daysSince = Math.max(0, diff);
    }

    const daysOverdue = daysSince - frequencyDays;
    const status: LabRadarItem['status'] =
      daysOverdue > 15 ? 'overdue' : daysOverdue >= -30 ? 'due_soon' : 'up_to_date';

    radar.push({
      id: 'lab-urine-acr',
      testCategory: 'urine_acr',
      testNameAr: 'فحص زلال البول الدقيق (Urine Microalbumin/Cr Ratio)',
      testNameEn: 'Urine Albumin-to-Creatinine Ratio (ACR)',
      category: 'renal',
      frequencyDays,
      frequencyLabelAr: 'سنوياً (كل 365 يوم)',
      frequencyLabelEn: 'Every 12 months',
      lastDoneDate: latestDate,
      lastRecordedValue: latestVal,
      lastStatus: latestStatus,
      daysSinceLast: latestDate ? daysSince : undefined,
      daysOverdue: Math.max(0, daysOverdue),
      status,
      clinicalRationaleAr: 'الكشف المبكر عن اعتلال الكلى السكري وارتشاح البروتين قبل حدوث أي عجز كلوي دائم.',
      clinicalRationaleEn: 'Early detection of diabetic nephropathy and microalbuminuria before irreversible renal decline.',
      recommendedActionAr: 'فحص عينة بول صباحية أولى',
      recommendedActionEn: 'First morning urine sample for microalbuminuria ACR',
      requiresFasting: false,
      fastingNoteAr: 'عينة صباحية أولى مفضلة، دون الحاجة لصيام عن الطعام',
      triggerDrugs: ['Diabetes or Hypertension'],
      referenceTarget: '< 30 mg/g (Normal) | 30-300 (Microalbuminuria)',
    });
  }

  return radar;
}

/**
 * Formats a 1-Click Interactive WhatsApp message for Refill & Delivery Booking
 */
export function generateOneClickWhatsAppRefill({
  patient,
  selectedMedications,
  pharmacyName,
  includeDelivery = true,
  pharmacyPhone = '',
}: {
  patient: Patient;
  selectedMedications: string[];
  pharmacyName: string;
  includeDelivery?: boolean;
  pharmacyPhone?: string;
}): { text: string; encodedUrl: string } {
  const cleanPhone = formatPhoneForWhatsApp(patient.phone || '');
  const medsListStr = selectedMedications.length > 0 ? selectedMedications.join(' + ') : 'أدويتكم المزمنة المقررة';

  const orderToken = `RF-${patient.id.replace('PT-', '')}-${Math.floor(Date.now() / 1000).toString().slice(-4)}`;

  let text = `مرحباً ${patient.name}، تحيات ${pharmacyName} 🏥\n\n`;
  text += `نود إعلامك بأن موعد تكرار علاجك مستحق:\n💊 *${medsListStr}*\n\n`;

  if (includeDelivery) {
    text += `🚀 *لحجز التجهيز الفوري أو طلب التوصيل المنزلي السريع:*\n`;
    text += `يمكنك الرد على هذه الرسالة بكلمة: *(توصيل)* أو *(استلام من الصيدلية)*\n`;
    text += `كود الحجز السريع: [${orderToken}]\n\n`;
    text += `حرصاً على استقرار ضغطك وسكرك، نتمنى لك دوام الصحة والعافية! ✨`;
  } else {
    text += `يرجى مراجعتنا في الصيدلية لاستلام أدويتك في موعدها لضمان استقرار خطتك العلاجية.\n`;
    text += `كود المتابعة: [${orderToken}]\n`;
    text += `صحتك أولويتنا دائماً! 🌿`;
  }

  const encodedUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`;
  return { text, encodedUrl };
}

/**
 * Formats a 1-Click Interactive WhatsApp message for Lab & Vitals Reminder
 */
export function generateLabTestWhatsAppReminder({
  patient,
  testNameAr,
  frequencyLabel,
  pharmacyName,
  fastingNote,
}: {
  patient: Patient;
  testNameAr: string;
  frequencyLabel: string;
  pharmacyName: string;
  fastingNote?: string;
}): { text: string; encodedUrl: string } {
  const cleanPhone = formatPhoneForWhatsApp(patient.phone || '');

  let text = `مرحباً ${patient.name}، معك دكتور الصيدلة السريرية من ${pharmacyName} 🩺\n\n`;
  text += `حرصاً على متابعة خطتك العلاجية واستقرار صحتك وسلامة أعضائك الحيوية:\n`;
  text += `نود تذكيرك بموعد إجراء التحليل الدوري لـ: *${testNameAr}* (${frequencyLabel}).\n\n`;
  
  if (fastingNote) {
    text += `📋 *تعليمات الفحص:* ${fastingNote}\n\n`;
  }
  
  text += `💡 *ملاحظة:* يفضل إجراء هذا التحليل وإحضار النتيجة معك عند مراجعتك القادمة للصيدلية أو لطبيبك المختص لتقييم فاعلية الجرعة والتأكد من ملاءمتها.\n\n`;
  text += `إذا كانت لديك أي استفسارات أو تحتاج ترشيح مختبر قريب معتمد، نحن بخدمتك دائماً! 🤍`;

  const encodedUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`;
  return { text, encodedUrl };
}
