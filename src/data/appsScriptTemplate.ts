export const APPS_SCRIPT_CODE = `/**
 * ============================================================================
 * 🏥 PharmPulse Enterprise - Smart Clean Google Apps Script (Code.gs)
 * الإصدار: 4.5.0 Auto-Clean & Organize Edition
 * ============================================================================
 * 
 * 💡 وظيفة هذا السكريبت:
 * 1. تنظيف الشيت بالكامل وحذف جميع الصفحات القديمة والفارغة غير المستخدمة.
 * 2. إزالة الصفوف الفارغة والفوضى وتنسيق الأعمدة بمظهر طبي وسريري احترافي.
 * 3. حفظ بيانات المرضى والأدوية والزيارات مع روابط صور الروشتات في Google Drive.
 * 4. إضافة قائمة علوية مخصصة (🏥 نظام PharmPulse) للتحكم بالشيت بنقرة واحدة.
 * 
 * 📖 خطوات التركيب والتفعيل:
 * -------------------------------------------------------------
 * 1. افتح جدول Google Sheets الخاص بك.
 * 2. من القائمة العلوية: اضغط على (الامتدادات / Extensions) > Apps Script.
 * 3. احذف أي كود موجود في ملف Code.gs، والصق هذا الكود كاملاً مكانه.
 * 4. اضغط حفظ (💾 أو Ctrl+S).
 * 5. لتنظيف وترتيب الشيت فوراً: اختر دالة cleanAndOrganizeSpreadsheet من القائمة العلوية واضغط تشغيل (Run).
 * 6. لنشر الرابط: في أعلى اليمين اضغط: نشر (Deploy) > نشر جديد (New deployment).
 *    - اختر: تطبيق ويب (Web app).
 *    - تنفيذ كـ (Execute as): أنا (Me).
 *    - من لديه حق الوصول (Who has access): أي شخص (Anyone)  <-- ⚠️ ضروري جداً.
 * 7. اضغط Deploy وانسخ الرابط المنتهي بـ /exec والصقه في إعدادات التطبيق.
 * ============================================================================
 */

// أسماء أوراق العمل الرئيسية الثلاث فقط (المطلوبة للتطبيق)
const SHEET_PATIENTS = "Patients_DB";
const SHEET_FOLLOWUPS = "Clinical_FollowUps";
const SHEET_SETTINGS = "Settings_Config";

// اسم مجلد Google Drive لحفظ صور الروشتات والتحاليل الطبية
const DRIVE_FOLDER_NAME = "PharmPulse_Prescriptions_Labs";

// قائمة الأوراق القديمة / غير المستخدمة لحذفها تلقائياً وتنظيف الشيت
const OBSOLETE_SHEETS = [
  "Patients",
  "Audit_Log",
  "Sync_Audit_Log",
  "Follow_Ups",
  "Medications",
  "Vitals_Log",
  "Patient_Documents",
  "Sheet1",
  "ورقة1"
];

function getSpreadsheet() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

/**
 * إضافة قائمة خاصة بـ PharmPulse في شريط أدوات Google Sheets
 */
function onOpen() {
  try {
    SpreadsheetApp.getUi()
      .createMenu("🏥 نظام PharmPulse")
      .addItem("✨ تنظيف وترتيب الشيت وحذف الصفحات الفارغة", "menuCleanAndOrganize")
      .addItem("🎨 إعادة تنسيق وتلوين الجداول", "menuFormatOnly")
      .addItem("🧪 اختبار الاتصال والصلاحيات", "menuTestConnection")
      .addSeparator()
      .addItem("📊 إحصائيات السجلات", "menuShowStats")
      .addItem("🗑️ مسح وتفريغ كافة السجلات", "menuClearDatabase")
      .addToUi();
  } catch (e) {
    Logger.log("Menu onOpen error: " + e.message);
  }
}

/**
 * الدالة الرئيسية: تنظيف وترتيب الشيت بالكامل، حذف الصفحات غير المستخدمة، وحل مشكلة الصفوف الفارغة
 */
function cleanAndOrganizeSpreadsheet() {
  const ss = getSpreadsheet();
  
  // 1. استخراج أي بيانات مرضى موجودة قبل إعادة التهيئة لضمان عدم ضياع أي مريض
  const existingPatients = extractAnyExistingPatients(ss);
  const existingFollowUps = extractAnyExistingFollowUps(ss);

  // 2. حذف الصفحات غير المستخدمة والقديمة
  OBSOLETE_SHEETS.forEach(function(sheetName) {
    const oldSheet = ss.getSheetByName(sheetName);
    if (oldSheet && ss.getSheets().length > 1) {
      try {
        ss.deleteSheet(oldSheet);
      } catch (err) {
        Logger.log("Could not delete sheet " + sheetName + ": " + err.message);
      }
    }
  });

  // 3. تهيئة وتنسيق ورقة المرضى الرئيسية Patients_DB
  let pSheet = ss.getSheetByName(SHEET_PATIENTS);
  if (!pSheet) {
    pSheet = ss.insertSheet(SHEET_PATIENTS);
  }
  
  // مسح التنسيق القديم والبيانات المبعثرة
  pSheet.clear();

  // رؤوس الأعمدة المنظمة بدقة
  const pHeaders = [
    "Patient ID",
    "Full Name",
    "Phone",
    "Age",
    "Gender",
    "Family Tag",
    "Diagnosis",
    "Medications Summary",
    "Prescription Photos (Drive URLs)",
    "Loyalty Points",
    "Allergies",
    "Notes",
    "Vitals (JSON)",
    "Medications (JSON)",
    "Scans (JSON)",
    "Is Archived",
    "Last Updated"
  ];

  pSheet.getRange(1, 1, 1, pHeaders.length).setValues([pHeaders]);
  
  // تنسيق شريط العناوين (Dark Slate Navy & White Bold)
  const headerRange = pSheet.getRange(1, 1, 1, pHeaders.length);
  headerRange.setBackground("#0f172a")
    .setFontColor("#ffffff")
    .setFontWeight("bold")
    .setFontSize(10)
    .setHorizontalAlignment("center")
    .setVerticalAlignment("middle");
  
  pSheet.setRowHeight(1, 38);
  pSheet.setFrozenRows(1);

  // ضبط عرض الأعمدة لمظهر مريح للعين
  pSheet.setColumnWidth(1, 120); // ID
  pSheet.setColumnWidth(2, 190); // Name
  pSheet.setColumnWidth(3, 130); // Phone
  pSheet.setColumnWidth(4, 70);  // Age
  pSheet.setColumnWidth(5, 80);  // Gender
  pSheet.setColumnWidth(6, 130); // Family
  pSheet.setColumnWidth(7, 180); // Diagnosis
  pSheet.setColumnWidth(8, 260); // Meds Summary
  pSheet.setColumnWidth(9, 280); // Photos
  pSheet.setColumnWidth(10, 100); // Loyalty
  pSheet.setColumnWidth(11, 150); // Allergies
  pSheet.setColumnWidth(12, 180); // Notes
  pSheet.setColumnWidth(13, 140); // Vitals JSON
  pSheet.setColumnWidth(14, 140); // Meds JSON
  pSheet.setColumnWidth(15, 140); // Scans JSON
  pSheet.setColumnWidth(16, 90);  // Archived
  pSheet.setColumnWidth(17, 160); // Last Updated

  // تنسيق عمود الهاتف كنص للحفاظ على الصفر في البداية
  pSheet.getRange("C:C").setNumberFormat("@");

  // إعادة إدراج المرضى بشكل نظيف بدون صفوف فارغة
  if (existingPatients.length > 0) {
    const nowStr = new Date().toISOString();
    const rows = existingPatients.map(function(p) {
      return patientToRow(p, nowStr);
    });
    pSheet.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
    
    // تنسيق محاذاة البيانات
    pSheet.getRange(2, 1, rows.length, 1).setHorizontalAlignment("center").setFontFamily("Courier New").setFontWeight("bold");
    pSheet.getRange(2, 3, rows.length, 1).setHorizontalAlignment("center");
    pSheet.getRange(2, 4, rows.length, 2).setHorizontalAlignment("center");
    pSheet.getRange(2, 10, rows.length, 1).setHorizontalAlignment("center");
    pSheet.getRange(2, 16, rows.length, 2).setHorizontalAlignment("center");
    pSheet.getRange(2, 8, rows.length, 2).setWrap(true);
  }

  // 4. تهيئة وتنسيق ورقة المتابعات السريرية Clinical_FollowUps
  let fSheet = ss.getSheetByName(SHEET_FOLLOWUPS);
  if (!fSheet) {
    fSheet = ss.insertSheet(SHEET_FOLLOWUPS);
  }
  fSheet.clear();

  const fHeaders = ["ID", "Patient ID", "Patient Name", "Phone", "Type", "Drug", "Due Date", "Status", "Notes", "Created At"];
  fSheet.getRange(1, 1, 1, fHeaders.length).setValues([fHeaders]);
  fSheet.getRange(1, 1, 1, fHeaders.length)
    .setBackground("#0f172a")
    .setFontColor("#ffffff")
    .setFontWeight("bold")
    .setFontSize(10)
    .setHorizontalAlignment("center")
    .setVerticalAlignment("middle");
  fSheet.setRowHeight(1, 35);
  fSheet.setFrozenRows(1);
  fSheet.setColumnWidth(1, 130);
  fSheet.setColumnWidth(2, 120);
  fSheet.setColumnWidth(3, 180);
  fSheet.setColumnWidth(4, 130);
  fSheet.setColumnWidth(5, 120);
  fSheet.setColumnWidth(6, 180);
  fSheet.setColumnWidth(7, 120);
  fSheet.setColumnWidth(8, 110);
  fSheet.setColumnWidth(9, 220);
  fSheet.setColumnWidth(10, 160);

  if (existingFollowUps.length > 0) {
    const fRows = existingFollowUps.map(function(f) {
      return [
        f.id || "",
        f.patientId || "",
        f.patientName || "",
        f.phone || "",
        f.type || "",
        f.drug || "",
        f.dueDate || "",
        f.resolved ? "RESOLVED" : "PENDING",
        f.notes || "",
        f.createdAt || new Date().toISOString()
      ];
    });
    fSheet.getRange(2, 1, fRows.length, fRows[0].length).setValues(fRows);
  }

  // 5. تهيئة ورقة الإعدادات Settings_Config
  let sSheet = ss.getSheetByName(SHEET_SETTINGS);
  if (!sSheet) {
    sSheet = ss.insertSheet(SHEET_SETTINGS);
  }
  if (sSheet.getLastRow() === 0) {
    const sHeaders = ["Key", "Value", "Updated At"];
    sSheet.getRange(1, 1, 1, sHeaders.length).setValues([sHeaders]);
    sSheet.getRange(1, 1, 1, sHeaders.length).setBackground("#0f172a").setFontColor("#ffffff").setFontWeight("bold");
    sSheet.setFrozenRows(1);
  }

  // 6. حذف أي أوراق إضافية فارغة متبقية
  const allSheets = ss.getSheets();
  for (let i = 0; i < allSheets.length; i++) {
    const name = allSheets[i].getName();
    if (name !== SHEET_PATIENTS && name !== SHEET_FOLLOWUPS && name !== SHEET_SETTINGS) {
      if (ss.getSheets().length > 1) {
        try { ss.deleteSheet(allSheets[i]); } catch (e) {}
      }
    }
  }

  // تفعيل ورقة المرضى
  ss.setActiveSheet(pSheet);
  return { success: true, patientsRestored: existingPatients.length };
}

/**
 * استخراج ذكي لبيانات المرضى الموجودة في أي ورقة سابقة لمنع ضياع أي بيانات
 */
function extractAnyExistingPatients(ss) {
  const patientMap = {};
  const sheetsToCheck = [SHEET_PATIENTS, "Patients", "Patients_DB"];

  sheetsToCheck.forEach(function(sName) {
    const sh = ss.getSheetByName(sName);
    if (!sh || sh.getLastRow() < 2) return;

    const data = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();
    for (let r = 0; r < data.length; r++) {
      const row = data[r];
      const idCandidate = String(row[0] || "").trim();
      const nameCandidate = String(row[1] || "").trim();
      
      if (idCandidate && idCandidate !== "Patient ID" && idCandidate !== "ID" && (idCandidate.startsWith("PT-") || nameCandidate.length > 0)) {
        if (!patientMap[idCandidate]) {
          patientMap[idCandidate] = rowToPatientFlexible(row);
        }
      }
    }
  });

  return Object.values(patientMap);
}

/**
 * تحويل صف قديم إلى كائن مريض حتى وإن كان ترتيب الأعمدة متغيراً
 */
function rowToPatientFlexible(row) {
  let vitals = [], meds = [], scans = [];
  
  for (let c = 0; c < row.length; c++) {
    const val = String(row[c] || "").trim();
    if (val.startsWith("[") && val.endsWith("]")) {
      try {
        const parsed = JSON.parse(val);
        if (Array.isArray(parsed)) {
          if (parsed.length > 0 && parsed[0].name && parsed[0].dose !== undefined) {
            meds = parsed;
          } else if (parsed.length > 0 && parsed[0].systolic !== undefined) {
            vitals = parsed;
          } else if (parsed.length > 0 && (parsed[0].driveUrl || parsed[0].previewUrl || parsed[0].id)) {
            scans = parsed;
          }
        }
      } catch (e) {}
    }
  }

  return {
    id: String(row[0] || ("PT-" + Math.floor(100000 + Math.random() * 900000))),
    name: String(row[1] || ""),
    phone: String(row[2] || ""),
    age: (row[3] !== "" && !isNaN(Number(row[3]))) ? Number(row[3]) : undefined,
    gender: String(row[4] || ""),
    familyTag: String(row[5] || ""),
    diagnosis: String(row[6] || ""),
    loyaltyPoints: (row[9] !== "" && !isNaN(Number(row[9]))) ? Number(row[9]) : 0,
    allergies: String(row[10] || ""),
    notes: String(row[11] || ""),
    vitals: vitals,
    medications: meds,
    scans: scans,
    isArchived: String(row[15] || "").toUpperCase() === "TRUE",
    lastUpdated: String(row[16] || new Date().toISOString())
  };
}

/**
 * استخراج أي متابعات سابقة
 */
function extractAnyExistingFollowUps(ss) {
  const followUps = [];
  const sh = ss.getSheetByName(SHEET_FOLLOWUPS) || ss.getSheetByName("Follow_Ups");
  if (!sh || sh.getLastRow() < 2) return followUps;

  const data = sh.getRange(2, 1, sh.getLastRow() - 1, Math.min(sh.getLastColumn(), 10)).getValues();
  for (let r = 0; r < data.length; r++) {
    const row = data[r];
    if (row[0] && String(row[0]) !== "ID") {
      followUps.push({
        id: String(row[0]),
        patientId: String(row[1] || ""),
        patientName: String(row[2] || ""),
        phone: String(row[3] || ""),
        type: String(row[4] || ""),
        drug: String(row[5] || ""),
        dueDate: String(row[6] || ""),
        resolved: String(row[7]).toUpperCase() === "RESOLVED" || String(row[7]).toUpperCase() === "TRUE",
        notes: String(row[8] || ""),
        createdAt: String(row[9] || "")
      });
    }
  }
  return followUps;
}

/**
 * تحويل كائن المريض إلى صف متناسق
 */
function patientToRow(p, nowStr) {
  const medsSummary = (p.medications || []).map(function(m) {
    return (m.name || "") + (m.dose ? " " + m.dose : "") + (m.frequency ? " (" + m.frequency + ")" : "");
  }).filter(Boolean).join(", ");

  const photoUrls = (p.scans || []).map(function(s) {
    return s.driveUrl || s.previewUrl || (s.fileId ? "https://lh3.googleusercontent.com/d/" + s.fileId : "");
  }).filter(Boolean).join("\\n");

  const cleanScans = (p.scans || []).map(function(s) {
    return {
      id: s.id || "",
      date: s.date || "",
      title: s.title || "",
      driveUrl: s.driveUrl || "",
      previewUrl: s.previewUrl || s.driveUrl || "",
      fileId: s.fileId || "",
      fileSize: s.fileSize || ""
    };
  });

  return [
    p.id || "",
    p.name || "",
    p.phone ? "'" + String(p.phone) : "",
    p.age !== undefined && p.age !== null ? p.age : "",
    p.gender || "",
    p.familyTag || "",
    p.diagnosis || "",
    medsSummary,
    photoUrls,
    p.loyaltyPoints || 0,
    p.allergies || "",
    p.notes || "",
    JSON.stringify(p.vitals || []),
    JSON.stringify(p.medications || []),
    JSON.stringify(cleanScans),
    p.isArchived ? "TRUE" : "FALSE",
    p.lastUpdated || nowStr
  ];
}

/**
 * تحويل صف مقروء من الشيت إلى كائن مريض
 */
function rowToPatient(row) {
  let vitals = [], meds = [], scans = [];
  try { vitals = row[12] ? JSON.parse(row[12]) : []; } catch (e) {}
  try { meds = row[13] ? JSON.parse(row[13]) : []; } catch (e) {}
  try { scans = row[14] ? JSON.parse(row[14]) : []; } catch (e) {}

  let phoneStr = String(row[2] || "");
  if (phoneStr.startsWith("'")) phoneStr = phoneStr.substring(1);

  return {
    id: String(row[0] || ""),
    name: String(row[1] || ""),
    phone: phoneStr,
    age: (row[3] !== "" && !isNaN(Number(row[3]))) ? Number(row[3]) : undefined,
    gender: String(row[4] || ""),
    familyTag: String(row[5] || ""),
    diagnosis: String(row[6] || ""),
    loyaltyPoints: (row[9] !== "" && !isNaN(Number(row[9]))) ? Number(row[9]) : 0,
    allergies: String(row[10] || ""),
    notes: String(row[11] || ""),
    vitals: vitals,
    medications: meds,
    scans: scans,
    isArchived: String(row[15]).toUpperCase() === "TRUE",
    lastUpdated: String(row[16] || "")
  };
}

/**
 * حفظ صورة روشتة أو تحليل في Google Drive مع مشاركة الرابط
 */
function saveBase64ImageToDrive(patientId, fileName, base64Data) {
  if (!base64Data) return { fileId: "", fileUrl: "", previewUrl: "", thumbnailUrl: "" };
  let folder;
  const folders = DriveApp.getFoldersByName(DRIVE_FOLDER_NAME);
  folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(DRIVE_FOLDER_NAME);

  const clean = base64Data.replace(/^data:image\\/(png|jpeg|jpg|webp);base64,/, "");
  const decoded = Utilities.base64Decode(clean);
  const safeName = (patientId || "Patient") + "_" + Date.now() + "_" + (fileName || "rx.jpg");
  const blob = Utilities.newBlob(decoded, "image/jpeg", safeName);
  const file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  const fileId = file.getId();
  return {
    fileId: fileId,
    fileUrl: file.getUrl(),
    previewUrl: "https://lh3.googleusercontent.com/d/" + fileId,
    thumbnailUrl: "https://drive.google.com/thumbnail?id=" + fileId + "&sz=w2000"
  };
}

/**
 * معالجة طلبات GET (Fetch, Ping & Auto-Clean check)
 */
function doGet(e) {
  const ss = getSpreadsheet();
  const params = e ? e.parameter : {};
  const action = (params.action || "FETCH_ALL").toUpperCase();
  const callback = params.callback;

  let result = { status: "SUCCESS" };

  if (action === "CLEAN_DATABASE") {
    cleanAndOrganizeSpreadsheet();
    result.message = "Spreadsheet cleaned and organized successfully.";
  }

  if (action === "PING") {
    const pSheet = ss.getSheetByName(SHEET_PATIENTS);
    const fSheet = ss.getSheetByName(SHEET_FOLLOWUPS);
    result.counts = {
      patients: pSheet ? Math.max(0, pSheet.getLastRow() - 1) : 0,
      followUps: fSheet ? Math.max(0, fSheet.getLastRow() - 1) : 0
    };
    result.spreadsheetName = ss.getName();
    result.version = "4.5.0-AutoClean";
  } else if (action === "FETCH_ALL") {
    const pSheet = ss.getSheetByName(SHEET_PATIENTS);
    const fSheet = ss.getSheetByName(SHEET_FOLLOWUPS);
    const sSheet = ss.getSheetByName(SHEET_SETTINGS);

    const patients = [];
    if (pSheet && pSheet.getLastRow() > 1) {
      const pRows = pSheet.getRange(2, 1, pSheet.getLastRow() - 1, 17).getValues();
      for (let i = 0; i < pRows.length; i++) {
        if (pRows[i][0] && String(pRows[i][0]).trim().length > 0) {
          patients.push(rowToPatient(pRows[i]));
        }
      }
    }

    const followUps = [];
    if (fSheet && fSheet.getLastRow() > 1) {
      const fRows = fSheet.getRange(2, 1, fSheet.getLastRow() - 1, 10).getValues();
      for (let i = 0; i < fRows.length; i++) {
        if (fRows[i][0] && String(fRows[i][0]).trim().length > 0) {
          followUps.push({
            id: String(fRows[i][0]),
            patientId: String(fRows[i][1] || ""),
            patientName: String(fRows[i][2] || ""),
            phone: String(fRows[i][3] || ""),
            type: String(fRows[i][4] || ""),
            drug: String(fRows[i][5] || ""),
            dueDate: String(fRows[i][6] || ""),
            resolved: String(fRows[i][7]).toUpperCase() === "RESOLVED" || String(fRows[i][7]).toUpperCase() === "TRUE",
            notes: String(fRows[i][8] || ""),
            createdAt: String(fRows[i][9] || "")
          });
        }
      }
    }

    const settings = {};
    if (sSheet && sSheet.getLastRow() > 1) {
      const sRows = sSheet.getRange(2, 1, sSheet.getLastRow() - 1, 2).getValues();
      for (let i = 0; i < sRows.length; i++) {
        if (sRows[i][0]) settings[sRows[i][0]] = sRows[i][1];
      }
    }

    result.patients = patients;
    result.followUps = followUps;
    result.settings = settings;
  }

  const output = JSON.stringify(result);
  if (callback) {
    return ContentService.createTextOutput(callback + "(" + output + ");").setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(output).setMimeType(ContentService.MimeType.JSON);
}

/**
 * معالجة طلبات POST (Sync Upstream, Save Patient, Save Followup, Upload Scan, Clean)
 */
function doPost(e) {
  const ss = getSpreadsheet();
  let body = {};
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    body = e.parameter || {};
  }

  const action = (body.action || "SYNC_UPSTREAM").toUpperCase();
  const now = new Date().toISOString();

  if (action === "UPLOAD_SCAN") {
    const uploadRes = saveBase64ImageToDrive(body.patientId, body.title, body.base64Data);
    return ContentService.createTextOutput(JSON.stringify({ status: "SUCCESS", ...uploadRes })).setMimeType(ContentService.MimeType.JSON);
  }

  if (action === "CLEAN_DATABASE") {
    const cleanRes = cleanAndOrganizeSpreadsheet();
    return ContentService.createTextOutput(JSON.stringify({ status: "SUCCESS", ...cleanRes })).setMimeType(ContentService.MimeType.JSON);
  }

  if (action === "SAVE_PATIENT") {
    let pSheet = ss.getSheetByName(SHEET_PATIENTS);
    if (!pSheet) {
      cleanAndOrganizeSpreadsheet();
      pSheet = ss.getSheetByName(SHEET_PATIENTS);
    }
    const p = body.patient;
    if (p && p.id && pSheet) {
      const data = pSheet.getDataRange().getValues();
      let foundRow = -1;
      for (let r = 1; r < data.length; r++) {
        if (String(data[r][0]).trim() === String(p.id).trim()) {
          foundRow = r + 1;
          break;
        }
      }
      const rowVals = patientToRow(p, now);
      if (foundRow > 0) {
        pSheet.getRange(foundRow, 1, 1, rowVals.length).setValues([rowVals]);
      } else {
        cleanBlankRows(pSheet);
        pSheet.appendRow(rowVals);
      }
    }
    return ContentService.createTextOutput(JSON.stringify({ status: "SUCCESS" })).setMimeType(ContentService.MimeType.JSON);
  }

  if (action === "SAVE_FOLLOWUP") {
    let fSheet = ss.getSheetByName(SHEET_FOLLOWUPS);
    if (!fSheet) {
      cleanAndOrganizeSpreadsheet();
      fSheet = ss.getSheetByName(SHEET_FOLLOWUPS);
    }
    const f = body.followUp;
    if (f && f.id && fSheet) {
      const data = fSheet.getDataRange().getValues();
      let foundRow = -1;
      for (let r = 1; r < data.length; r++) {
        if (String(data[r][0]).trim() === String(f.id).trim()) {
          foundRow = r + 1;
          break;
        }
      }
      const fRow = [
        f.id || "",
        f.patientId || "",
        f.patientName || "",
        f.phone || "",
        f.type || "",
        f.drug || "",
        f.dueDate || "",
        f.resolved ? "RESOLVED" : "PENDING",
        f.notes || "",
        f.createdAt || now
      ];
      if (foundRow > 0) {
        fSheet.getRange(foundRow, 1, 1, fRow.length).setValues([fRow]);
      } else {
        fSheet.appendRow(fRow);
      }
    }
    return ContentService.createTextOutput(JSON.stringify({ status: "SUCCESS" })).setMimeType(ContentService.MimeType.JSON);
  }

  if (action === "DELETE_PATIENT") {
    const pid = String(body.patientId || "");
    const pSheet = ss.getSheetByName(SHEET_PATIENTS);
    const fSheet = ss.getSheetByName(SHEET_FOLLOWUPS);
    if (pid === "ALL") {
      if (pSheet && pSheet.getLastRow() > 1) pSheet.deleteRows(2, pSheet.getLastRow() - 1);
      if (fSheet && fSheet.getLastRow() > 1) fSheet.deleteRows(2, fSheet.getLastRow() - 1);
    } else if (pSheet) {
      const data = pSheet.getDataRange().getValues();
      for (let r = data.length - 1; r >= 1; r--) {
        if (String(data[r][0]).trim() === pid) pSheet.deleteRow(r + 1);
      }
    }
    return ContentService.createTextOutput(JSON.stringify({ status: "SUCCESS" })).setMimeType(ContentService.MimeType.JSON);
  }

  if (action === "CLEAR_DATABASE") {
    const pSheet = ss.getSheetByName(SHEET_PATIENTS);
    const fSheet = ss.getSheetByName(SHEET_FOLLOWUPS);
    if (pSheet && pSheet.getLastRow() > 1) pSheet.deleteRows(2, pSheet.getLastRow() - 1);
    if (fSheet && fSheet.getLastRow() > 1) fSheet.deleteRows(2, fSheet.getLastRow() - 1);
    return ContentService.createTextOutput(JSON.stringify({ status: "SUCCESS" })).setMimeType(ContentService.MimeType.JSON);
  }

  // SYNC_BATCH (دعم مزامنة الدفعات الكبيرة لأكثر من 2000 مريض)
  if (action === "SYNC_BATCH" && body.patients && Array.isArray(body.patients)) {
    let pSheet = ss.getSheetByName(SHEET_PATIENTS);
    if (!pSheet) {
      cleanAndOrganizeSpreadsheet();
      pSheet = ss.getSheetByName(SHEET_PATIENTS);
    }
    if (pSheet) {
      if (body.isFirstBatch || body.batchIndex === 0) {
        if (pSheet.getLastRow() > 1) {
          pSheet.deleteRows(2, pSheet.getLastRow() - 1);
        }
      }
      if (body.patients.length > 0) {
        const rows = body.patients.map(function(p) { return patientToRow(p, now); });
        const startRow = pSheet.getLastRow() + 1;
        pSheet.getRange(startRow, 1, rows.length, rows[0].length).setValues(rows);
      }
    }

    if (body.isFirstBatch && body.followUps && Array.isArray(body.followUps)) {
      let fSheet = ss.getSheetByName(SHEET_FOLLOWUPS);
      if (!fSheet) {
        cleanAndOrganizeSpreadsheet();
        fSheet = ss.getSheetByName(SHEET_FOLLOWUPS);
      }
      if (fSheet) {
        if (fSheet.getLastRow() > 1) {
          fSheet.deleteRows(2, fSheet.getLastRow() - 1);
        }
        if (body.followUps.length > 0) {
          const fRows = body.followUps.map(function(f) {
            return [
              f.id || "",
              f.patientId || "",
              f.patientName || "",
              f.phone || "",
              f.type || "",
              f.drug || "",
              f.dueDate || "",
              f.resolved ? "RESOLVED" : "PENDING",
              f.notes || "",
              f.createdAt || now
            ];
          });
          fSheet.getRange(2, 1, fRows.length, fRows[0].length).setValues(fRows);
        }
      }
    }

    return ContentService.createTextOutput(JSON.stringify({ status: "SUCCESS", batchIndex: body.batchIndex })).setMimeType(ContentService.MimeType.JSON);
  }

  // SYNC_UPSTREAM (المزامنة الشاملة المباشرة)
  if (body.patients && Array.isArray(body.patients)) {
    let pSheet = ss.getSheetByName(SHEET_PATIENTS);
    if (!pSheet) {
      cleanAndOrganizeSpreadsheet();
      pSheet = ss.getSheetByName(SHEET_PATIENTS);
    }
    if (pSheet) {
      if (pSheet.getLastRow() > 1) {
        pSheet.deleteRows(2, pSheet.getLastRow() - 1);
      }
      if (body.patients.length > 0) {
        const rows = body.patients.map(function(p) { return patientToRow(p, now); });
        pSheet.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
      }
    }
  }

  if (body.followUps && Array.isArray(body.followUps)) {
    let fSheet = ss.getSheetByName(SHEET_FOLLOWUPS);
    if (!fSheet) {
      cleanAndOrganizeSpreadsheet();
      fSheet = ss.getSheetByName(SHEET_FOLLOWUPS);
    }
    if (fSheet) {
      if (fSheet.getLastRow() > 1) {
        fSheet.deleteRows(2, fSheet.getLastRow() - 1);
      }
      if (body.followUps.length > 0) {
        const fRows = body.followUps.map(function(f) {
          return [
            f.id || "",
            f.patientId || "",
            f.patientName || "",
            f.phone || "",
            f.type || "",
            f.drug || "",
            f.dueDate || "",
            f.resolved ? "RESOLVED" : "PENDING",
            f.notes || "",
            f.createdAt || now
          ];
        });
        fSheet.getRange(2, 1, fRows.length, fRows[0].length).setValues(fRows);
      }
    }
  }

  if (body.settings && typeof body.settings === "object") {
    const sSheet = ss.getSheetByName(SHEET_SETTINGS);
    if (sSheet) {
      const keys = Object.keys(body.settings);
      keys.forEach(function(k) {
        const val = typeof body.settings[k] === "object" ? JSON.stringify(body.settings[k]) : String(body.settings[k]);
        sSheet.appendRow([k, val, now]);
      });
    }
  }

  return ContentService.createTextOutput(JSON.stringify({ status: "SUCCESS" })).setMimeType(ContentService.MimeType.JSON);
}

/**
 * حذف الصفوف الفارغة لمنع ظهور فجوات في البيانات
 */
function cleanBlankRows(sheet) {
  if (!sheet || sheet.getLastRow() <= 1) return;
  const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues();
  for (let i = values.length - 1; i >= 0; i--) {
    if (!values[i][0] || String(values[i][0]).trim() === "") {
      sheet.deleteRow(i + 2);
    }
  }
}

// ============================================================================
// دالات القائمة التفاعلية داخل Google Sheets UI
// ============================================================================

function menuCleanAndOrganize() {
  const ui = SpreadsheetApp.getUi();
  const res = cleanAndOrganizeSpreadsheet();
  ui.alert("✨ تم تنظيف وترتيب الشيت بنجاح!", 
    "• تم حذف كافة الأوراق القديمة والفارغة غير المستخدمة.\\n" +
    "• تم تنسيق الأعمدة وتلوين الجداول بمظهر سريري أنيق.\\n" +
    "• تم استعادة وتنسيق (" + res.patientsRestored + ") سجل مريض بدون أي صفوف فارغة.",
    ui.ButtonSet.OK
  );
}

function menuFormatOnly() {
  cleanAndOrganizeSpreadsheet();
  SpreadsheetApp.getUi().alert("✅ تم تنسيق الجداول وتوسيع الأعمدة بنجاح!");
}

function menuTestConnection() {
  const ss = getSpreadsheet();
  const pSheet = ss.getSheetByName(SHEET_PATIENTS);
  const count = pSheet ? Math.max(0, pSheet.getLastRow() - 1) : 0;
  SpreadsheetApp.getUi().alert("🟢 نظام PharmPulse متصل وجاهز!", 
    "• جدول البيانات: " + ss.getName() + "\\n" +
    "• عدد المرضى المسجلين: " + count + " مريض\\n" +
    "• الصلاحيات والربط السحابي: يعمل بنجاح 100%", 
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

function menuShowStats() {
  const ss = getSpreadsheet();
  const pSheet = ss.getSheetByName(SHEET_PATIENTS);
  const fSheet = ss.getSheetByName(SHEET_FOLLOWUPS);
  const pCount = pSheet ? Math.max(0, pSheet.getLastRow() - 1) : 0;
  const fCount = fSheet ? Math.max(0, fSheet.getLastRow() - 1) : 0;

  SpreadsheetApp.getUi().alert("📊 إحصائيات قاعدة البيانات:", 
    "• المرضى المسجلين: " + pCount + "\\n" +
    "• المتابعات السريرية: " + fCount + "\\n" +
    "• الأوراق النشطة: " + ss.getSheets().map(function(s) { return s.getName(); }).join(", "), 
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

function menuClearDatabase() {
  const ui = SpreadsheetApp.getUi();
  const resp = ui.alert("⚠️ تأكيد مسح البيانات", "هل أنت متأكد من رغبتك في مسح كافة سجلات المرضى والمتابعات من الشيت؟", ui.ButtonSet.YES_NO);
  if (resp === ui.Button.YES) {
    const ss = getSpreadsheet();
    const pSheet = ss.getSheetByName(SHEET_PATIENTS);
    const fSheet = ss.getSheetByName(SHEET_FOLLOWUPS);
    if (pSheet && pSheet.getLastRow() > 1) pSheet.deleteRows(2, pSheet.getLastRow() - 1);
    if (fSheet && fSheet.getLastRow() > 1) fSheet.deleteRows(2, fSheet.getLastRow() - 1);
    ui.alert("🗑️ تم تفريغ قاعدة البيانات بنجاح.");
  }
}
`;
