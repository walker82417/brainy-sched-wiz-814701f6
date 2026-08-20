/**
 * Officer Rohan's Unified Command Center Backend
 * 1. Webhook (doPost) for Google Sheets Logging
 * 2. Autonomous Firebase Email Insight Engine (runs itself daily)
 */

// --- CONFIGURATION CONSTANTS ---
const FIREBASE_PROJECT_ID = "officer-joy";
const USER_UID = "BeeP2QK682f5yF5a1ihIyINMf6H3";
const REPORT_RECIPIENTS = ["rohandoiphode1@gmail.com", "rohand11072004@gmail.com"];
const TIMEZONE = "Asia/Kolkata";
const SHARED_SECRET = "rohan-secure-2026";
const DAILY_EMAIL_HOUR = 23; // 11 PM
const DAILY_EMAIL_MINUTE = 30;

/* =====================================================================
    PART 0: ONE-TIME SETUP — run installDailyTrigger() ONCE manually
   ===================================================================== */
function installDailyTrigger() {
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(function (t) {
    const fn = t.getHandlerFunction();
    if (fn === "sendDailyReport" || fn === "triggerDailyEmail") {
      ScriptApp.deleteTrigger(t);
    }
  });

  ScriptApp.newTrigger("sendDailyReport")
    .timeBased()
    .atHour(DAILY_EMAIL_HOUR)
    .nearMinute(DAILY_EMAIL_MINUTE)
    .everyDays(1)
    .inTimezone(TIMEZONE)
    .create();

  Logger.log(
    "Daily trigger installed for " + DAILY_EMAIL_HOUR + ":" + DAILY_EMAIL_MINUTE + " " + TIMEZONE,
  );
}

/* =====================================================================
    PART 1: GOOGLE SHEETS WEBHOOK INGESTION
   ===================================================================== */
function doGet() {
  return ContentService.createTextOutput(
    JSON.stringify({
      ok: true,
      service: "Officer Joy Apps Script automation",
      message: "Web app is deployed. Ready to catch POST automation.",
    }),
  ).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const raw = e && e.postData && e.postData.contents ? e.postData.contents : "{}";
    const event = JSON.parse(raw);

    if (event.secret !== SHARED_SECRET) {
      throw new Error("Unauthorized automation request.");
    }

    delete event.secret;
    appendEvent_(event);

    return ContentService.createTextOutput(JSON.stringify({ ok: true })).setMimeType(
      ContentService.MimeType.JSON,
    );
  } catch (error) {
    appendEmailLog_("ingest_error", String(error));
    return ContentService.createTextOutput(
      JSON.stringify({ ok: false, error: String(error) }),
    ).setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

function appendEvent_(event) {
  const sheet = getSheet_("Events", [
    "receivedAt",
    "eventDate",
    "type",
    "sentAt",
    "activity",
    "category",
    "status",
    "minutes",
    "comment",
    "payloadJson",
  ]);
  const payload = event.payload || {};
  const row = payload.row || {};
  sheet.appendRow([
    new Date(),
    event.date || "",
    event.type || "unknown",
    event.sentAt || "",
    row.act || payload.activity || "",
    row.cat || payload.category || "",
    payload.status || "",
    payload.minutes || row.dur || "",
    payload.comment || "",
    JSON.stringify(payload),
  ]);
}

function appendEmailLog_(status, message) {
  const sheet = getSheet_("EmailLog", ["createdAt", "status", "message"]);
  sheet.appendRow([new Date(), status, message]);
}

function getSheet_(name, headers) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(name) || ss.insertSheet(name);
  if (sheet.getLastRow() === 0) sheet.appendRow(headers);
  return sheet;
}

/* =====================================================================
    PART 2: AUTONOMOUS DAILY INSIGHT EMAIL ENGINE
   ===================================================================== */

const FOCUS_NAMES = {
  4: "ELECTRICAL ENGINEERING (THEORY)",
  6: "ELECTRICAL ENGINEERING (NUMERICALS)",
  8: "PYQs & MCQs PRACTICE",
  10: "QUANTITATIVE APTITUDE",
  11: "REASONING ABILITY",
  12: "GENERAL STUDIES & CURRENT AFFAIRS",
  14: "ENGLISH",
  15: "REVISION & MOCK ANALYSIS",
};
const FOCUS_DEFAULT_MINS = { 4: 150, 6: 150, 8: 120, 10: 60, 11: 60, 12: 60, 14: 60, 15: 45 };

function sendDailyReport() {
  const today = Utilities.formatDate(new Date(), TIMEZONE, "yyyy-MM-dd");
  const scriptProperties = PropertiesService.getScriptProperties();
  const lastSentDate = scriptProperties.getProperty("LAST_SENT_DATE");

  if (lastSentDate === today) {
    Logger.log("Failsafe check: Report already delivered today. Shutting down.");
    return;
  }

  try {
    const todayData = fetchDailyDoc_(today);
    const history = fetchRecentHistory_(today, 30);

    buildAndSendReport(todayData || {}, history, today);
    scriptProperties.setProperty("LAST_SENT_DATE", today);
  } catch (error) {
    Logger.log("Autonomous email pipeline error: " + error.toString());
    appendEmailLog_("email_error", String(error));
  }
}

function fetchDailyDoc_(dateStr) {
  const url =
    "https://firestore.googleapis.com/v1/projects/" +
    FIREBASE_PROJECT_ID +
    "/databases/(default)/documents/users/" +
    USER_UID +
    "/daily/" +
    dateStr;
  const response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  const code = response.getResponseCode();
  if (code === 404) return null;
  if (code !== 200) {
    appendEmailLog_(
      "firebase_error",
      "daily/" + dateStr + " -> Code: " + code + " - " + response.getContentText(),
    );
    return null;
  }
  return flattenFirestore(JSON.parse(response.getContentText()));
}

function fetchRecentHistory_(todayStr, nDays) {
  const results = [];
  const base = new Date(todayStr + "T00:00:00");
  for (let i = 0; i < nDays; i++) {
    const d = new Date(base);
    d.setDate(d.getDate() - i);
    const key = Utilities.formatDate(d, TIMEZONE, "yyyy-MM-dd");
    const data = fetchDailyDoc_(key);
    const totalMinutes = sumCompletedMinutes_(data);
    results.push({ date: key, minutes: totalMinutes, hasData: !!data });
  }
  return results;
}

// Dynamically retrieve session display name supporting custom web app fields.
function getSessionName_(id, session) {
  if (session && (session.subject || session.name || session.topic)) {
    return (session.subject || session.name) + (session.topic ? " (" + session.topic + ")" : "");
  }
  return FOCUS_NAMES[id] || "Task #" + id;
}

function getActiveRowIds_(dailyData) {
  if (dailyData && dailyData.sessions) {
    const keys = Object.keys(dailyData.sessions);
    if (keys.length > 0) {
      return keys;
    }
  }
  return ["4", "6", "8", "10", "11", "12", "14", "15"];
}

function partialMinutesForSession_(session, allocatedMin) {
  if (!session || (session.status !== "running" && session.status !== "paused")) return 0;
  const allocatedSec = (allocatedMin || 0) * 60;
  let remainingSec = typeof session.remaining === "number" ? session.remaining : allocatedSec;
  if (session.status === "running" && session.endTs) {
    remainingSec = Math.max(0, Math.round((session.endTs - Date.now()) / 1000));
  }
  const elapsedSec = Math.max(0, allocatedSec - remainingSec);
  return Math.round(elapsedSec / 60);
}

function deductedMinutesByTarget_(extensionLog) {
  const totals = {};
  (extensionLog || []).forEach(function (entry) {
    if (entry.deductedFromRowId === null || entry.deductedFromRowId === undefined || entry.deductedFromRowId === "none") {
      return;
    }
    const key = String(entry.deductedFromRowId);
    totals[key] = (totals[key] || 0) + (Number(entry.minutes) || 0);
  });
  return totals;
}

function effectiveAllocatedMinutes_(id, session, deductedByTarget) {
  const defaultMins = FOCUS_DEFAULT_MINS[id] || (session && session.durationAllocated) || 60;
  const rawAlloc =
    session && session.durationAllocated !== undefined ? Number(session.durationAllocated) : defaultMins;
  return Math.max(0, rawAlloc - (deductedByTarget[String(id)] || 0));
}

function sumCompletedMinutes_(dailyData) {
  if (!dailyData) return 0;
  const sessions = dailyData.sessions || {};
  const completedLog = dailyData.completedLog || [];
  const deductedByTarget = deductedMinutesByTarget_(dailyData.extensionLog || []);
  const activeRowIds = getActiveRowIds_(dailyData);
  const seen = [];
  let total = 0;

  completedLog.forEach(function (log) {
    const id = String(log.rowId);
    const session = sessions[id] || {};
    const effectiveAlloc = effectiveAllocatedMinutes_(id, session, deductedByTarget);
    total += Math.min(Number(log.durMin) || 0, effectiveAlloc);
    if (seen.indexOf(id) === -1) seen.push(id);
  });

  activeRowIds.forEach(function (id) {
    const session = sessions[id] || {};
    const alloc = effectiveAllocatedMinutes_(id, session, deductedByTarget);
    if (alloc === 0) return; // Fully traded/deducted away.

    if (seen.indexOf(String(id)) === -1) {
      if (session.status === "completed") {
        total += alloc;
      } else {
        total += partialMinutesForSession_(session, alloc);
      }
    }
  });

  return total;
}

function buildAndSendReport(dailyData, history, dateStr) {
  const sessions = dailyData.sessions || {};
  const completedLog = dailyData.completedLog || [];
  const extLog = dailyData.extensionLog || [];
  const deductedByTarget = deductedMinutesByTarget_(extLog);
  const activeRowIds = getActiveRowIds_(dailyData);
  const totalTargetCount = activeRowIds.length;

  let completedCount = 0;
  let totalMinutes = 0;
  let partialMinutes = 0;
  const pendingSubjects = [];
  const completedIds = [];
  const minutesBySubject = {};

  completedLog.forEach(function (log) {
    const id = String(log.rowId);
    const session = sessions[id] || {};
    const effectiveAlloc = effectiveAllocatedMinutes_(id, session, deductedByTarget);
    const loggedMinutes = Math.min(Number(log.durMin) || 0, effectiveAlloc);
    totalMinutes += loggedMinutes;
    minutesBySubject[id] = (minutesBySubject[id] || 0) + loggedMinutes;
    if (completedIds.indexOf(id) === -1) {
      completedIds.push(id);
      completedCount++;
    }
  });

  activeRowIds.forEach(function (id) {
    const session = sessions[id] || {};
    const alloc = effectiveAllocatedMinutes_(id, session, deductedByTarget);

    // If a session's duration was reduced to 0 via time deduction, it was traded away.
    if (alloc === 0 && session.status !== "completed") {
      return;
    }

    if (completedIds.indexOf(String(id)) === -1 && session.status !== "completed") {
      const displayName = getSessionName_(id, session);
      pendingSubjects.push(displayName + " (" + alloc + "m)");

      const partial = partialMinutesForSession_(session, alloc);
      if (partial > 0) {
        partialMinutes += partial;
        minutesBySubject[id] = (minutesBySubject[id] || 0) + partial;
      }
    } else if (completedIds.indexOf(String(id)) === -1 && session.status === "completed") {
      completedCount++;
      completedIds.push(String(id));
      totalMinutes += alloc;
      minutesBySubject[id] = (minutesBySubject[id] || 0) + alloc;
    }
  });

  totalMinutes += partialMinutes;

  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;

  let streak = 0;
  for (let i = 0; i < history.length; i++) {
    if (history[i].minutes > 0) streak++;
    else break;
  }

  const weekSlice = history.slice(0, 7);
  const weeklyMinutes = weekSlice.reduce(function (sum, d) {
    return sum + d.minutes;
  }, 0);
  const daysWithData = weekSlice.filter(function (d) {
    return d.hasData;
  }).length || 1;
  const weeklyAvg = Math.round(weeklyMinutes / daysWithData);
  const yesterdayMinutes = history.length > 1 ? history[1].minutes : null;

  let trendLine;
  if (yesterdayMinutes === null) {
    trendLine = "First day of tracked data — baseline set.";
  } else if (totalMinutes > yesterdayMinutes) {
    trendLine = "Up " + (totalMinutes - yesterdayMinutes) + " min vs yesterday. Momentum building.";
  } else if (totalMinutes < yesterdayMinutes) {
    trendLine =
      "Down " + (yesterdayMinutes - totalMinutes) + " min vs yesterday. Worth a stronger push tomorrow.";
  } else {
    trendLine = "Exactly matched yesterday's output.";
  }

  let bestSubjectId = null;
  Object.keys(minutesBySubject).forEach(function (id) {
    if (bestSubjectId === null || minutesBySubject[id] > minutesBySubject[bestSubjectId]) {
      bestSubjectId = id;
    }
  });

  const bestSessionObj = bestSubjectId ? sessions[bestSubjectId] : null;
  const bestSubjectLine = bestSubjectId
    ? getSessionName_(bestSubjectId, bestSessionObj) + " (" + minutesBySubject[bestSubjectId] + "m)"
    : "No sessions logged yet today.";

  const p = dateStr.split("-");
  const formattedDisplayDate = parseInt(p[2], 10) + "/" + parseInt(p[1], 10) + "/" + p[0];

  const subject = "🎯 Officer Rohan | Daily Insight Report • " + formattedDisplayDate;
  const pct = totalTargetCount > 0 ? Math.round((completedCount / totalTargetCount) * 100) : 0;
  const motivation = pickMotivationalLine_(completedCount, streak, pendingSubjects.length);

  const plainBody =
    "Dear Officer Rohan,\n\nStudy Hours: " +
    hours +
    "h " +
    mins +
    "m\n" +
    "Sessions Completed: " +
    completedCount +
    " / " +
    totalTargetCount +
    "\nStreak: " +
    streak +
    " day(s)\n" +
    trendLine +
    "\n\n(View this email in HTML for the full styled report.)";

  const htmlBody = buildHtmlReport_({
    dateLabel: formattedDisplayDate,
    hours: hours,
    mins: mins,
    completedCount: completedCount,
    totalTargetCount: totalTargetCount,
    pct: pct,
    streak: streak,
    bestSubjectLine: bestSubjectLine,
    weeklyMinutes: weeklyMinutes,
    weeklyAvg: weeklyAvg,
    trendLine: trendLine,
    pendingSubjects: pendingSubjects,
    extLog: extLog,
    motivation: motivation,
  });

  REPORT_RECIPIENTS.forEach(function (recipient) {
    MailApp.sendEmail({ to: recipient, subject: subject, body: plainBody, htmlBody: htmlBody });
  });

  appendEmailLog_(
    "email_sent",
    "Autonomous insight report sent: " + hours + "h " + mins + "m logged, streak " + streak + "d.",
  );
}

function pickMotivationalLine_(completedCount, streak, pendingCount) {
  if (completedCount > 0 && pendingCount === 0) {
    return "🏆 Perfect day. All targets cleared — this is exactly what consistency looks like.";
  }
  if (streak >= 5) {
    return "🔥 " + streak + "-day streak going strong. Officers who show up daily are the ones who clear the exam.";
  }
  if (completedCount === 0) {
    return "⚠️ Zero sessions logged today. Tomorrow is a clean slate — start with just one, momentum will follow.";
  }
  if (pendingCount <= 2) {
    return "💪 Almost there today — just " + pendingCount + " left. Finish strong before Sleep.";
  }
  return "📘 Steady progress. Every session logged today is a session your future self will thank you for.";
}

function buildHtmlReport_(d) {
  const pendingHtml = d.pendingSubjects.length
    ? "<ul style='margin:0;padding-left:18px;color:#374151;font-size:14px;line-height:1.8;'>" +
      d.pendingSubjects
        .map(function (s) {
          return "<li>" + escapeHtml_(s) + "</li>";
        })
        .join("") +
      "</ul>"
    : "<p style='color:#16a34a;font-weight:700;font-size:14px;margin:0;'>✅ All targets cleared. Board is fully green.</p>";

  // --- ANIMATED CSS & HTML FOR TIME DEDUCTIONS / COMMENTS ---
  const extHtml = d.extLog.length
    ? "<style>" +
      "@keyframes fadeInSlide { 0% { opacity: 0; transform: translateY(6px); } 100% { opacity: 1; transform: translateY(0); } }" +
      "@keyframes pulseGlow { 0% { border-left-color: #2b6fd6; } 50% { border-left-color: #f2c14e; } 100% { border-left-color: #2b6fd6; } }" +
      ".animated-ext-item { animation: fadeInSlide 0.5s ease-out forwards; }" +
      ".animated-comment-box { animation: fadeInSlide 0.6s ease-out forwards, pulseGlow 3s infinite; }" +
      "</style>" +
      "<ul style='margin:0;padding-left:18px;color:#374151;font-size:13px;line-height:1.8;'>" +
      d.extLog
        .map(function (ext) {
          const addedSubj = ext.activity || FOCUS_NAMES[ext.rowId] || "Unknown Subject";
          const deductText =
            ext.deductedFromRowId === null || ext.deductedFromRowId === undefined || ext.deductedFromRowId === "none"
              ? "no deduction"
              : "from " + (ext.deductedFrom || FOCUS_NAMES[ext.deductedFromRowId] || "another session");

          const commentHtml = ext.comment
            ? "<div class='animated-comment-box' style='color:#374151;font-style:italic;font-size:12px;background:#f8fafc;border-left:3px solid #2b6fd6;padding:6px 10px;margin:6px 0 8px 0;border-radius:0 6px 6px 0;box-shadow: 0 2px 4px rgba(0,0,0,0.03);'>&ldquo;" +
              escapeHtml_(ext.comment) +
              "&rdquo;</div>"
            : "";
          return (
            "<li class='animated-ext-item' style='margin-bottom: 8px;'>Extended <b>" +
            escapeHtml_(addedSubj) +
            "</b> <span style='color:#0284c7; font-weight:600;'>+" +
            ext.minutes +
            "m</span> (<span style='color:#64748b;'>" +
            escapeHtml_(deductText) +
            "</span>)" +
            commentHtml +
            "</li>"
          );
        })
        .join("") +
      "</ul>"
    : "";

  return (
    "" +
    "<div style='font-family:Segoe UI,Roboto,Arial,sans-serif;max-width:600px;margin:0 auto;background:#f4f6fb;padding:24px;'>" +
    "<div style='background:linear-gradient(145deg,#151b4d,#1f2870);border-radius:16px 16px 0 0;padding:24px 28px;color:#fff;'>" +
    "<div style='font-size:12px;letter-spacing:1.5px;color:#f2c14e;font-weight:700;text-transform:uppercase;'>Mission Control • " +
    d.dateLabel +
    "</div>" +
    "<div style='font-size:22px;font-weight:800;margin-top:4px;'>Officer Rohan's Daily Report</div>" +
    "</div>" +
    "<div style='background:#fff;padding:24px 28px;'>" +
    "<div style='background:#fffbea;border:1px solid #fde68a;border-radius:10px;padding:14px 16px;font-size:14px;color:#78350f;font-weight:600;margin-bottom:22px;'>" +
    d.motivation +
    "</div>" +
    "<div style='display:table;width:100%;margin-bottom:22px;'>" +
    statCell_(d.hours + "h " + d.mins + "m", "Studied Today") +
    statCell_(d.completedCount + " / " + d.totalTargetCount, "Sessions Done") +
    statCell_(d.streak + "d 🔥", "Current Streak") +
    "</div>" +
    "<div style='margin-bottom:22px;'>" +
    "<div style='font-size:12px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;'>Today's Progress — " +
    d.pct +
    "%</div>" +
    "<div style='background:#e5e7eb;border-radius:20px;height:14px;overflow:hidden;'>" +
    "<div style='background:linear-gradient(90deg,#f2c14e,#2b6fd6,#2a9d5c);height:100%;width:" +
    d.pct +
    "%;transition:width 1s ease-in-out;'></div>" +
    "</div>" +
    "</div>" +
    "<div style='margin-bottom:20px;'>" +
    "<div style='font-size:12px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;'>Top Subject Today</div>" +
    "<div style='font-size:15px;color:#151b4d;font-weight:700;'>" +
    escapeHtml_(d.bestSubjectLine) +
    "</div>" +
    "</div>" +
    "<div style='margin-bottom:20px;padding:14px 16px;background:#f0f4ff;border-radius:10px;'>" +
    "<div style='font-size:12px;font-weight:700;color:#4b5563;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;'>Weekly Trend</div>" +
    "<div style='font-size:14px;color:#1f2937;line-height:1.6;'>" +
    "Weekly total: <b>" +
    Math.floor(d.weeklyMinutes / 60) +
    "h " +
    (d.weeklyMinutes % 60) +
    "m</b><br>" +
    "Daily average: <b>" +
    Math.floor(d.weeklyAvg / 60) +
    "h " +
    (d.weeklyAvg % 60) +
    "m</b><br>" +
    escapeHtml_(d.trendLine) +
    "</div>" +
    "</div>" +
    "<div style='margin-bottom:20px;'>" +
    "<div style='font-size:12px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px;'>Pending Today</div>" +
    pendingHtml +
    "</div>" +
    (extHtml
      ? "<div style='margin-bottom:6px;'>" +
        "<div style='font-size:12px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px;'>Time Adjustments &amp; Notes</div>" +
        extHtml +
        "</div>"
      : "") +
    "</div>" +
    "<div style='background:#151b4d;border-radius:0 0 16px 16px;padding:16px 28px;text-align:center;'>" +
    "<div style='color:#f2c14e;font-size:12px;font-style:italic;'>&quot;The harder you work for something, the greater you'll feel when you achieve it.&quot;</div>" +
    "<div style='color:#9ca3af;font-size:10px;margin-top:6px;'>Mission Control Server • Autonomous</div>" +
    "</div>" +
    "</div>"
  );
}

function statCell_(value, label) {
  return (
    "<div style='display:table-cell;width:33%;text-align:center;'>" +
    "<div style='font-size:20px;font-weight:800;color:#151b4d;'>" +
    value +
    "</div>" +
    "<div style='font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:.5px;'>" +
    label +
    "</div>" +
    "</div>"
  );
}

function escapeHtml_(str) {
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function flattenFirestore(obj) {
  if (!obj) return null;
  if (obj.fields) {
    const res = {};
    for (const key in obj.fields) {
      res[key] = flattenFirestore(obj.fields[key]);
    }
    return res;
  }
  if (obj.mapValue) return flattenFirestore(obj.mapValue);
  if (obj.arrayValue) {
    const list = obj.arrayValue.values || [];
    return list.map(flattenFirestore);
  }
  if (Object.prototype.hasOwnProperty.call(obj, "stringValue")) return obj.stringValue;
  if (Object.prototype.hasOwnProperty.call(obj, "integerValue")) return parseInt(obj.integerValue, 10);
  if (Object.prototype.hasOwnProperty.call(obj, "doubleValue")) return parseFloat(obj.doubleValue);
  if (Object.prototype.hasOwnProperty.call(obj, "booleanValue")) return obj.booleanValue;
  if (Object.prototype.hasOwnProperty.call(obj, "nullValue")) return null;
  return obj;
}

// END OF FILE - paste through this line into Apps Script.
