import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Endpoint: High-speed proxy for Google Apps Script to eliminate browser CORS latency and handle 302 redirects server-to-server
app.post('/api/gas/proxy', async (req, res) => {
  try {
    const { gasUrl, method = 'POST', payload, params } = req.body;
    if (!gasUrl || typeof gasUrl !== 'string') {
      return res.status(400).json({ success: false, error: 'Missing or invalid gasUrl' });
    }

    let targetUrl = gasUrl.trim();
    if (params && typeof params === 'object') {
      const q = new URLSearchParams(params).toString();
      targetUrl += (targetUrl.includes('?') ? '&' : '?') + q;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 35000);

    if (method === 'GET') {
      const resp = await fetch(targetUrl, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        redirect: 'follow',
        signal: controller.signal,
      });
      clearTimeout(timeout);

      const contentType = resp.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const json = await resp.json();
        return res.json(json);
      }
      const text = await resp.text();
      try {
        const json = JSON.parse(text);
        return res.json(json);
      } catch {
        return res.json({ status: 'SUCCESS', raw: text });
      }
    } else {
      const resp = await fetch(targetUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: typeof payload === 'string' ? payload : JSON.stringify(payload || {}),
        redirect: 'follow',
        signal: controller.signal,
      });
      clearTimeout(timeout);

      const contentType = resp.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const json = await resp.json();
        return res.json(json);
      }
      const text = await resp.text();
      try {
        const json = JSON.parse(text);
        return res.json(json);
      } catch {
        return res.json({ status: 'SUCCESS', raw: text });
      }
    }
  } catch (err: any) {
    console.warn('Server GAS proxy error:', err.message);
    return res.status(502).json({ success: false, error: err.message });
  }
});

// Helper: Convert Eastern Arabic numerals (٠-٩) to standard English numerals (0-9)
function normalizeArabicNumerals(str: string): string {
  const arabicNumerals = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  return (str || '').replace(/[٠-٩]/g, d => String(arabicNumerals.indexOf(d)));
}

// Helper: Calculate next refill date from YYYY-MM-DD + days
function addDaysYMD(ymd: string, days: number): string {
  try {
    const d = new Date(ymd);
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
  } catch {
    const now = new Date();
    now.setDate(now.getDate() + days);
    return now.toISOString().split('T')[0];
  }
}

// Fallback local rule-based extractor for Iraqi pharmacy notes
function fallbackLocalRxParse(rawText: string = '', todayDate: string) {
  const normText = normalizeArabicNumerals(rawText || '');

  // Phone extraction: Iraqi format (077/078/079/075) 11 digits
  let phone: string | null = null;
  const phoneMatch = normText.match(/(?:\+?964|0)?(7[5789]\d{8})/);
  if (phoneMatch && phoneMatch[1]) {
    phone = '0' + phoneMatch[1];
  }

  // Name extraction
  let name = 'مريض غير مسجل';
  const nameMatch = rawText.match(/(?:المريض|مريض|السيد|السيدة|اسم[:\s]+)\s*([^\d\n,،.]+)/i);
  if (nameMatch && nameMatch[1].trim()) {
    name = nameMatch[1].trim().replace(/^(الاسم|هو|هي)\s*/, '');
  } else {
    const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length > 0) {
      const firstLine = lines[0].replace(/[0-9٠-٩]/g, '').trim();
      const words = firstLine.split(/\s+/).filter(w => w.length > 1);
      if (words.length >= 2 && words.length <= 4 && !/علاج|دواء|صرف|روشتة|عمر|سنة/.test(words[0])) {
        name = words.join(' ');
      }
    }
  }

  // Age extraction
  let age: number | null = null;
  const ageMatch = normText.match(/(?:عمره|عمرها|العمر|عمر|سن|سنة[:\s]+)\s*(\d{1,3})/i);
  if (ageMatch && ageMatch[1]) {
    const num = parseInt(ageMatch[1], 10);
    if (num > 0 && num < 125) age = num;
  }

  // Days supply
  let durationDays = 30;
  const daysMatch = normText.match(/(?:لمدة|كورس|مدة|أيام|يوم[:\s]+)\s*(\d{1,3})\s*(?:يوم|يومياً)?/i);
  if (daysMatch && daysMatch[1]) {
    durationDays = parseInt(daysMatch[1], 10) || 30;
  }

  // Expanded Drug dictionary for Iraqi community pharmacy (Comprehensive Fallback Engine)
  const iraqiDrugMap: { regex: RegExp; standard: string }[] = [
    // Antihypertensives & Cardiovascular
    { regex: /كنكور\s*(?:5|٥)|concor\s*5/i, standard: 'Concor 5mg' },
    { regex: /كنكور\s*(?:10|١٠)|concor\s*10/i, standard: 'Concor 10mg' },
    { regex: /كنكور\s*(?:2.5|٢.٥)|concor\s*2.5/i, standard: 'Concor 2.5mg' },
    { regex: /كنكور|كونكور|concor/i, standard: 'Concor 5mg' },
    { regex: /اكسفورج\s*(?:10\/160|١٠\/١٦٠)|exforge\s*10\/160/i, standard: 'Exforge 10/160mg' },
    { regex: /اكسفورج\s*(?:5\/160|٥\/١٦٠)|exforge\s*5\/160/i, standard: 'Exforge 5/160mg' },
    { regex: /اكسفورج|أكسفورج|exforge/i, standard: 'Exforge 5/160mg' },
    { regex: /فالسارتان|valsartan|ديوفان|diovan/i, standard: 'Diovan 160mg' },
    { regex: /نورفاسك|norvasc|املوديبين|amlodipine/i, standard: 'Norvasc 5mg' },
    { regex: /كوفيرام|coveram/i, standard: 'Coveram 5/5mg' },
    { regex: /زيستريل|zestril|الينوبريل|lisinopril/i, standard: 'Zestril 10mg' },
    { regex: /لازكس|lasix|فوروسيميد|furosemide/i, standard: 'Lasix 40mg' },
    { regex: /ناتريليكس|natrilix/i, standard: 'Natrilix SR 1.5mg' },
    { regex: /اندرال|inderal|بروبرانولول|propranolol/i, standard: 'Inderal 40mg' },

    // Diabetes Management
    { regex: /كلوكوفيج\s*(?:الف|1000|١٠٠٠)|glucophage\s*1000/i, standard: 'Glucophage 1000mg' },
    { regex: /كلوكوفيج\s*(?:500|٥٠٠)|glucophage\_500/i, standard: 'Glucophage 500mg' },
    { regex: /كلوكوفيج\s*(?:850|٨٥٠)|glucophage\_850/i, standard: 'Glucophage 850mg' },
    { regex: /كلوكوفيج|glucophage|ميتفورمين|metformin/i, standard: 'Glucophage 850mg' },
    { regex: /جانوفيا|januvia/i, standard: 'Januvia 100mg' },
    { regex: /جانومايت|janumet/i, standard: 'Janumet 50/1000mg' },
    { regex: /غالفس\s*ميت|galvus\s*met/i, standard: 'Galvus Met 50/1000mg' },
    { regex: /غالفس|galvus/i, standard: 'Galvus 50mg' },
    { regex: /تراجينتا|trajenta/i, standard: 'Trajenta 5mg' },
    { regex: /اماريل\s*(?:2|٢)|amaryl\s*2/i, standard: 'Amaryl 2mg' },
    { regex: /اماريل\s*(?:1|١)|amaryl\s*1/i, standard: 'Amaryl 1mg' },
    { regex: /اماريل\s*(?:3|٣)|amaryl\s*3/i, standard: 'Amaryl 3mg' },
    { regex: /اماريل|أماريل|amaryl/i, standard: 'Amaryl 2mg' },
    { regex: /دايمكرون|diamicron/i, standard: 'Diamicron MR 60mg' },
    { regex: /فوركسيجا|forxiga|dapagliflozin/i, standard: 'Forxiga 10mg' },
    { regex: /جارديانس|jardiance|empagliflozin/i, standard: 'Jardiance 25mg' },
    { regex: /اوزمبيك|ozempic/i, standard: 'Ozempic 1mg' },
    { regex: /فيكتوزا|victoza/i, standard: 'Victoza 1.8mg' },
    { regex: /انسولين|انسيولين|insulin/i, standard: 'Insulin Mixtard 30 FlexPen' },

    // Lipid Lowering
    { regex: /كريستور\s*(?:20|٢٠)|crestor\s*20/i, standard: 'Crestor 20mg' },
    { regex: /كريستور\s*(?:10|١٠)|crestor\s*10/i, standard: 'Crestor 10mg' },
    { regex: /كريستور|crestor/i, standard: 'Crestor 10mg' },
    { regex: /ليبيتور|lipitor|اتورفاستاتين|atorvastatin/i, standard: 'Lipitor 20mg' },

    // Blood Thinners & Cardiac
    { regex: /اسبرين|أسبرين|aspirin/i, standard: 'Aspirin Protect 100mg' },
    { regex: /بلافيكس|plavix|كلوبيدوجريل|clopidogrel/i, standard: 'Plavix 75mg' },
    { regex: /بريلينتا|brilinta/i, standard: 'Brilinta 90mg' },
    { regex: /زاريلتو|xarelto/i, standard: 'Xarelto 15mg' },
    { regex: /اليكويس|eliquis/i, standard: 'Eliquis 5mg' },

    // Gastro & Thyroid
    { regex: /نيكسيوم|nexium|ايسوميبرازول|esomeprazole/i, standard: 'Nexium 40mg' },
    { regex: /كونترولوك|controloc|بانتوبرازول|pantoprazole/i, standard: 'Controloc 40mg' },
    { regex: /ايوثيروكس|euthyrox|ليفوثيروكسين|levothyroxine/i, standard: 'Euthyrox 50mcg' },

    // Respiratory & Neuro
    { regex: /سيمبيكورت|symbicort/i, standard: 'Symbicort 160/4.5 Turbuhaler' },
    { regex: /فنتولين|ventolin/i, standard: 'Ventolin Inhaler 100mcg' },
    { regex: /ليريكا|lyrica|بريجابالين|pregabalin/i, standard: 'Lyrica 75mg' },
    { regex: /نيوربيون|neurobion/i, standard: 'Neurobion Tablets' },
  ];

  const matchedMeds: { name: string; daysSupply: number }[] = [];
  const foundStandards = new Set<string>();

  for (const item of iraqiDrugMap) {
    const match = normText.match(item.regex);
    if (match && !foundStandards.has(item.standard)) {
      foundStandards.add(item.standard);
      let medDays = durationDays;
      const matchIdx = match.index ?? -1;
      if (matchIdx >= 0) {
        const snippet = normText.slice(matchIdx, matchIdx + 60);
        const specificDaysMatch = snippet.match(/(?:لمدة|كورس|مدة|أيام|يوم[:\s]+|\s+)(\d{1,3})\s*(?:يوم|يومياً|d|day|days)?/i);
        if (specificDaysMatch && specificDaysMatch[1]) {
          const val = parseInt(specificDaysMatch[1], 10);
          if (val > 0 && val <= 365 && !snippet.includes(`${val}mg`) && !snippet.includes(`${val}ملغ`)) {
            medDays = val;
          }
        }
      }
      matchedMeds.push({ name: item.standard, daysSupply: medDays });
    }
  }

  if (matchedMeds.length === 0) {
    matchedMeds.push({ name: 'علاج مزمن مقرر', daysSupply: durationDays });
  }

  const nextRefillDate = addDaysYMD(todayDate, durationDays);

  return {
    patientName: name,
    phoneNumber: phone,
    age,
    medications: matchedMeds,
    medicationNames: matchedMeds.map(m => m.name),
    durationDays,
    nextRefillDate,
    clinicalNotes: 'تم الاستخراج وتدقيق الأدوية عبر المحرك الصيدلاني المحلي الفائق (Offline Standardizer)',
  };
}

// Endpoint: AI Rx Extraction & Iraqi Chronic Regimen Standardizer
app.post('/api/ai/extract-rx', async (req, res) => {
  const { text, imageBase64, mimeType = 'image/jpeg', todayDate } = req.body || {};
  const effectiveToday = todayDate || new Date().toISOString().split('T')[0];

  const systemInstruction = `أنت مساعد صيدلاني ذكي وخبير في الأدوية المتوفرة في السوق العراقي (الأسماء التجارية والعلمية والشركات الرصينة المتداولة).
مهمتك استلام مدخلات من الصيدلي (سواء كانت نصاً مكتوباً أو صورة لملاحظة/روشتة بخط اليد) واستخراج بيانات مريض الأمراض المزمنة بدقة عالية.

تعليماتك الصارمة:
1. استخراج الاسم (patientName):
   - استخرج اسم المريض الثلاثي أو الثنائي كما هو مكتوب.
   - إذا لم يُذكر الاسم صراحةً، أرجع "مريض غير مسجل".

2. استخراج وتنسيق رقم الهاتف (phoneNumber):
   - استخرج رقم الهاتف العراقي وحوّل الأرقام العربية الشرقية (٠١٢٣٤٥٦٧٨٩) إلى أرقام إنجليزية قياسية (0123456789).
   - احذف أي مسافات أو رموز أو مفتاح دولة (+964) ليكون التنسيق الموحد من 11 رقماً يبدأ بـ (077, 078, 079, 075) كـ String (مثال: "07701234567").
   - إذا لم يكن الرقم موجوداً أو كان غير مكتمل، أرجع null.

3. استخراج العمر (age):
   - إذا ذُكر العمر أو سنة الولادة، استخرجه كعدد صحيح (مثال: 54). إذا لم يُذكر، أرجع null.

4. قراءة وتصحيح الأدوية (medications):
   - اقرأ أسماء الأدوية سواء كُتبت بالعربية لفظياً أو بالإنجليزية أو بخط يد غير واضح، وصحح إملائها إلى الاسم التجاري أو العلمي القياسي في سوق الدواء العراقي مع التركيز (Strength).
   - أمثلة للتصحيح: ("كنكور 5" ← "Concor 5mg"، "كلوكوفيج الف" ← "Glucophage 1000mg"، "كريستور ٢٠" ← "Crestor 20mg"، "أماريل ٢" ← "Amaryl 2mg").
   - لكل دواء، استخرج اسم الدواء القياسي، وعدد أيام الصرف (daysSupply). إذا لم يُذكر عدد أيام دواء معين، استخدم durationDays الافتراضي (30).
   - ضع الأدوية في مصفوفة كائنات:
     "medications": [
       {"name": "Concor 5mg", "daysSupply": 30},
       {"name": "Glucophage 1000mg", "daysSupply": 30}
     ]
     بالإضافة إلى مصفوفة نصوص لأسماء الأدوية: "medicationNames": ["Concor 5mg", "Glucophage 1000mg"]

5. حساب المدة وتاريخ الاستحقاق (durationDays & nextRefillDate):
   - تاريخ اليوم المعطى لك هو "${effectiveToday}".
   - استخرج عدد أيام الكورس العلاجي كرقم صحيح (Integer). إذا لم يُذكر عدد الأيام صراحةً، افترض القيمة الافتراضية 30 يوماً.
   - قم بحساب (nextRefillDate) بإضافة (durationDays) بدقة إلى "${effectiveToday}" وأرجع النتيجة بصيغة (YYYY-MM-DD).

6. صيغة المخرجات (Output Format):
   - أرجع النتيجة حصراً بصيغة JSON مطابقة للهيكل المطلوب دون أي علامات Markdown مثل \`\`\`json.
{
  "patientName": "اسم المريض",
  "phoneNumber": "07701234567",
  "age": 55,
  "medications": [
    {"name": "Concor 5mg", "daysSupply": 30},
    {"name": "Glucophage 1000mg", "daysSupply": 30}
  ],
  "medicationNames": ["Concor 5mg", "Glucophage 1000mg"],
  "durationDays": 30,
  "nextRefillDate": "${addDaysYMD(effectiveToday, 30)}",
  "clinicalNotes": "ملاحظة صيدلانية إرشادية"
}`;

  if (!process.env.GEMINI_API_KEY) {
    const fallbackResult = fallbackLocalRxParse(text, effectiveToday);
    return res.json({
      success: true,
      data: fallbackResult,
      isFallback: true,
    });
  }

  let contents: any;
  if (imageBase64) {
    const cleanData = imageBase64.replace(/^data:image\/[a-zA-Z0-9.+]+;base64,/, '');
    contents = {
      parts: [
        {
          inlineData: {
            mimeType: mimeType || 'image/jpeg',
            data: cleanData,
          },
        },
        {
          text: text && text.trim() ? `ملاحظات الصيدلي:\n${text}` : 'يرجى قراءة هذه الروشتة/الملاحظة بدقة واستخراج بيانات المريض والأدوية حسب التعليمات.',
        },
      ],
    };
  } else {
    contents = text || 'لا يوجد نص';
  }

  // Multi-Model Fallback Chain for High Load & Rate-Limit Resilience
  const candidateModels = ['gemini-3.8-flash', 'gemini-2.5-flash', 'gemini-1.5-flash'];
  let lastError: Error | null = null;

  for (const modelName of candidateModels) {
    try {
      const response = await ai.models.generateContent({
        model: modelName,
        contents,
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
        },
      });

      const raw = (response.text || '{}').trim();
      let parsedData: any = {};
      try {
        parsedData = JSON.parse(raw);
      } catch {
        const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
        parsedData = JSON.parse(cleaned);
      }

      if (!parsedData.nextRefillDate && parsedData.durationDays) {
        parsedData.nextRefillDate = addDaysYMD(effectiveToday, parsedData.durationDays);
      }

      return res.json({
        success: true,
        data: parsedData,
        modelUsed: modelName,
      });
    } catch (err: any) {
      console.warn(`Model ${modelName} encountered issue under load:`, err.message);
      lastError = err;
      // Continue loop to try next model in fallback chain
    }
  }

  // If all Gemini AI models are under heavy load or fail, seamlessly use the enhanced local rule engine
  console.warn('All Gemini candidate models under heavy load. Gracefully executing local engine fallback.');
  const fallback = fallbackLocalRxParse(text, effectiveToday);
  return res.json({
    success: true,
    data: fallback,
    isFallback: true,
    warning: lastError?.message || 'High server load; used offline clinical engine',
  });
});

// Endpoint: Download Google Apps Script backend code (Code.gs)
app.get('/download/Code.gs', (_req, res) => {
  const gsPath = path.resolve(__dirname, 'google-apps-script.js');
  res.download(gsPath, 'Code.gs');
});

// Vite middleware in dev or static files in production
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  const port = Number(PORT) || 3000;
  app.listen(port, '0.0.0.0', () => {
    console.log(`PharmPulse Server running on http://0.0.0.0:${port}`);
  });
}

startServer();
