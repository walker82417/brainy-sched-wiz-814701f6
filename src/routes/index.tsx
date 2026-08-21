import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { doc, onSnapshot, setDoc, getDoc } from "firebase/firestore";
import { onAuthStateChanged, signInWithPopup, User, signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";
import { db, auth, googleProvider } from "../firebaseConfig";
import StudyLoader from "../components/StudyLoader";
import TimerRingMagic from "../components/TimerRingMagic";


// === GOOGLE SHEETS SYNC CONFIG ===
const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbyFbz6Gf4hcGZfDv0aXKS9wZVm9HobFagMVK6ieL2Y0Iy_NB0vTmztA06_0nmNb0hGl/exec";
const SHARED_SECRET = "rohan-secure-2026";

export const Route = createFileRoute("/")({
  component: AppWrapper,
});

/* =============================================================
   DATA
   ============================================================= */
type Row = {
  id: number;
  time: string;
  startMin: number;
  dur: number;
  act: string;
  focus: string;
  cat: "life" | "technical" | "break" | "aptitude" | "gs";
  icon: string;
};

const ROWS: Row[] = [
  { id: 0, time: "6:00 – 6:15 AM", startMin: 360, dur: 15, act: "WAKE UP", focus: "Gratitude & Plan Your Day", cat: "life", icon: "☀️" },
  { id: 1, time: "6:15 – 6:45 AM", startMin: 375, dur: 30, act: "EXERCISE / YOGA / WALK", focus: "Stay Fit, Stay Sharp", cat: "life", icon: "🏃" },
  { id: 2, time: "6:45 – 7:15 AM", startMin: 405, dur: 30, act: "FRESHEN UP", focus: "Personal Care", cat: "life", icon: "🚿" },
  { id: 3, time: "7:15 – 7:45 AM", startMin: 435, dur: 30, act: "BREAKFAST", focus: "Eat Healthy, Think Better", cat: "life", icon: "🥣" },
  { id: 4, time: "7:45 – 10:15 AM", startMin: 465, dur: 150, act: "ELECTRICAL ENGINEERING (THEORY)", focus: "Core Subject – ESE / MPSC / SSC JE / RRB JE", cat: "technical", icon: "📖" },
  { id: 5, time: "10:15 – 10:30 AM", startMin: 615, dur: 15, act: "SHORT BREAK", focus: "Tea / Break", cat: "break", icon: "☕" },
  { id: 6, time: "10:30 – 1:00 PM", startMin: 630, dur: 150, act: "ELECTRICAL ENGINEERING (NUMERICALS)", focus: "Numericals + Problem Solving", cat: "technical", icon: "🧮" },
  { id: 7, time: "1:00 – 2:00 PM", startMin: 780, dur: 60, act: "LUNCH & REST", focus: "Good Food, Good Mood", cat: "life", icon: "🍽️" },
  { id: 8, time: "2:00 – 4:00 PM", startMin: 840, dur: 120, act: "PYQs & MCQs PRACTICE", focus: "ESE / SSC JE / RRB JE", cat: "technical", icon: "🎯" },
  { id: 9, time: "4:00 – 4:30 PM", startMin: 960, dur: 30, act: "TEA BREAK", focus: "Short Break, Fresh Mind", cat: "break", icon: "☕" },
  { id: 10, time: "4:30 – 5:30 PM", startMin: 990, dur: 60, act: "QUANTITATIVE APTITUDE", focus: "SSC / Railways / CGL", cat: "aptitude", icon: "Σ" },
  { id: 11, time: "5:30 – 6:30 PM", startMin: 1050, dur: 60, act: "REASONING ABILITY", focus: "SSC / Railways / CGL", cat: "aptitude", icon: "🧠" },
  { id: 12, time: "6:30 – 7:30 PM", startMin: 1110, dur: 60, act: "GENERAL STUDIES & CURRENT AFFAIRS", focus: "Polity, History, Geography, Economy, Science, CA", cat: "gs", icon: "🌐" },
  { id: 13, time: "7:30 – 8:15 PM", startMin: 1170, dur: 45, act: "DINNER & FAMILY TIME", focus: "Take a Break, Stay Connected", cat: "life", icon: "👨‍👩‍👧" },
  { id: 14, time: "8:15 – 9:15 PM", startMin: 1215, dur: 60, act: "ENGLISH", focus: "Grammar, Vocabulary, RC", cat: "gs", icon: "🔤" },
  { id: 15, time: "9:15 – 10:00 PM", startMin: 1275, dur: 45, act: "REVISION & MOCK ANALYSIS", focus: "Mock Test / Error Analysis / Short Notes", cat: "technical", icon: "🔍" },
  { id: 16, time: "10:00 PM", startMin: 1320, dur: 0, act: "SLEEP", focus: "Good Sleep, Better Tomorrow", cat: "life", icon: "🌙" },
];

const isFocusRow = (r: Row) => r.cat === "technical" || r.cat === "aptitude" || r.cat === "gs";

const ROTATION: [string, string][] = [
  ["Mon", "Network Theory + Engineering Maths"],
  ["Tue", "Electrical Machines"],
  ["Wed", "Power Systems"],
  ["Thu", "Control Systems"],
  ["Fri", "Power Electronics"],
  ["Sat", "Electronics (Analog + Digital)"],
  ["Sun", "Full Length Mock Test + Revision"],
];

const CHECKLIST_ITEMS = ["Wake Up", "Exercise", "Breakfast", "Theory Completed", "Numericals Completed", "PYQs", "Aptitude", "Revision", "Sleep Before 10 PM"];

const ROW_CHECKLIST_MAP: Partial<Record<number, string>> = {
  0: "Wake Up", 1: "Exercise", 3: "Breakfast", 4: "Theory Completed", 6: "Numericals Completed", 8: "PYQs", 10: "Aptitude", 15: "Revision", 16: "Sleep Before 10 PM",
};

const QUOTES = [
  "The harder you work for something, the greater you'll feel when you achieve it.",
  "Don't stop when you're tired. Stop when you're done.",
  "Discipline today, success tomorrow.",
  "Small daily improvements are the key to stunning results.",
  "Your future is created by what you do today, not tomorrow.",
  "One day or day one. You decide.",
  "Consistency beats intensity.",
  "Every hour you put in is an hour your competition didn't.",
  "The exam doesn't care how you feel today. Show up anyway.",
  "Officers aren't made on good days. They're made on days like this.",
  "You don't need motivation. You need a system, and you already have one.",
  "The version of you that clears this exam is being built right now.",
  "No one sees the 5 AM sessions. Everyone sees the result.",
  "Tough books don't stay tough forever. Keep turning pages.",
  "Success is boring in the moment and unforgettable in hindsight.",
];

// Quotes that acknowledge you're already deep in strong momentum —
// used when your live progress or streak is genuinely high, so the
// message actually matches reality instead of generic filler.
const HIGH_PERFORMANCE_QUOTES = [
  "This is what discipline looks like from the outside. Keep going.",
  "You're not chasing the exam anymore — you're ahead of it.",
  "This streak isn't luck. It's who you're becoming.",
  "Most people quit right before this kind of momentum shows up.",
  "The board is green because you decided it would be. Don't stop now.",
];

const LOW_PROGRESS_QUOTES = [
  "Slow start is still a start. Pick one session and begin.",
  "You don't have to feel ready. You just have to begin.",
  "One session today rebuilds the whole day's momentum.",
  "The hardest part is the first 10 minutes. Start there.",
];

type ExamKey = "ssc" | "gate" | "ese";
const EXAMS_DEFAULT: Record<ExamKey, { label: string; date: string }> = {
  ssc: { label: "SSC JE 2027", date: "2027-06-01" },
  gate: { label: "GATE 2028", date: "2028-02-04" },
  ese: { label: "UPSC ESE 2028", date: "2028-02-25" },
};

type SessionStatus = "notstarted" | "running" | "paused" | "completed";
type SessionRec = { status: SessionStatus; remaining: number; endTs: number | null; warned: boolean; durationAllocated?: number; topic?: string; };
type CompletedLog = { date: string; rowId: number; cat: Row["cat"]; durMin: number; ts: number };
type ExtensionLogEntry = { date: string; rowId: number; activity: string; minutes: number; deductedFromRowId: number | null; deductedFrom: string | null; comment?: string; reopened: boolean; ts: number };
type ChecklistState = Record<string, boolean>;

/* =============================================================
   HELPERS
   ============================================================= */
/* Single source of truth for day keys — always LOCAL date.
   (toISOString() is UTC and shifts the day by hours in IST.) */
const localDateKey = (date: Date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const todayKey = () => localDateKey();


function fmtTime(sec: number) {
  sec = Math.max(0, sec);
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
}

function minsToClock(mins: number) {
  mins = ((mins % 1440) + 1440) % 1440;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const ap = h >= 12 ? "PM" : "AM";
  let h12 = h % 12;
  if (h12 === 0) h12 = 12;
  return `${h12}:${String(m).padStart(2, "0")} ${ap}`;
}

function countdownParts(dateStr: string) {
  const target = new Date(dateStr + "T00:00:00");
  const now = new Date();
  let diff = target.getTime() - now.getTime();
  if (diff < 0) diff = 0;
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  return { d, h, m, s };
}

function initSessions(rows: Row[] = ROWS): Record<number, SessionRec> {
  const out: Record<number, SessionRec> = {};
  rows.forEach((r) => { out[r.id] = { status: "notstarted", remaining: r.dur * 60, endTs: null, warned: false, durationAllocated: r.dur }; });
  return out;
}

function initChecklist(): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  CHECKLIST_ITEMS.forEach((it) => (out[it] = false));
  return out;
}

function markChecklistItemDone(checklistState: ChecklistState, rowId: number): ChecklistState {
  const checklistItem = ROW_CHECKLIST_MAP[rowId];
  return checklistItem ? { ...checklistState, [checklistItem]: true } : checklistState;
}

/* =============================================================
   SUNDAY CUSTOM DAY
   ============================================================= */
type SundayEntry = { subject: string; cat: Row["cat"]; icon: string; focus: string; startMin: number; dur: number };

const SUNDAY_ID_BASE = 100;

const SUBJECT_PRESETS = ROWS.filter(isFocusRow).map((r) => ({ act: r.act, cat: r.cat, icon: r.icon, focus: r.focus }));

function buildSundayRows(entries: SundayEntry[]): Row[] {
  return [...entries]
    .sort((a, b) => a.startMin - b.startMin)
    .map((e, i) => ({
      id: SUNDAY_ID_BASE + i,
      time: `${minsToClock(e.startMin)} – ${minsToClock(e.startMin + e.dur)}`,
      startMin: e.startMin,
      dur: e.dur,
      act: e.subject,
      focus: e.focus || "Sunday custom mission",
      cat: e.cat,
      icon: e.icon,
    }));
}

function clockToMins(v: string) {
  const [h, m] = v.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

function minsToInput(mins: number) {
  return `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;
}

function sundayOverlaps(entries: SundayEntry[]) {
  const sorted = [...entries].sort((a, b) => a.startMin - b.startMin);
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].startMin < sorted[i - 1].startMin + sorted[i - 1].dur) return true;
  }
  return false;
}


/* =============================================================
   AUTHENTICATION WRAPPER
   ============================================================= */
function AppWrapper() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [booting, setBooting] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");

  useEffect(() => {
    return onAuthStateChanged(auth, (currentUser) => {
      setUser((prev) => {
        if (currentUser && !prev) setBooting(true);
        return currentUser;
      });
      setLoading(false);
    });
  }, []);

  // Study-oriented boot sequence: driven by real data readiness, with a
  // ~1.8s floor (so it never flickers) and a 5s ceiling (so it never blocks).
  useEffect(() => {
    if (!booting) return;
    let ready = false;
    let floorDone = false;
    const finish = () => { if (ready && floorDone) setLeaving(true); };
    const onReady = () => { ready = true; finish(); };
    window.addEventListener("tt-data-ready", onReady);
    const floor = setTimeout(() => { floorDone = true; finish(); }, 1800);
    const ceiling = setTimeout(() => setLeaving(true), 5000);
    return () => {
      window.removeEventListener("tt-data-ready", onReady);
      clearTimeout(floor);
      clearTimeout(ceiling);
    };
  }, [booting]);

  // Smooth handoff: fade the loader out before unmounting it.
  useEffect(() => {
    if (!leaving) return;
    const t = setTimeout(() => { setBooting(false); setLeaving(false); }, 620);
    return () => clearTimeout(t);
  }, [leaving]);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#f4f6f8', color: '#1f2870', fontFamily: 'sans-serif' }}>
        <h2>Connecting to Command Center...</h2>
      </div>
    );
  }


  if (!user) {
    return (
      <div className="tt-loginRoot">
        <div className="tt-loginOrb o1" />
        <div className="tt-loginOrb o2" />
        <div className="tt-loginOrb o3" />
        <div className="tt-loginGrid" />

        <div className="tt-loginCard">
          <h1 className="tt-loginTitle">Officer Rohan's Timetable</h1>
          <p className="tt-loginSub">Firebase Secured Architecture</p>

          {/* EMAIL & PASSWORD LOGIN BOX */}
          <div className="tt-loginForm">
            <input
              className="tt-loginInput"
              type="email" placeholder="Email Address" value={email} onChange={e => setEmail(e.target.value)}
            />
            <input
              className="tt-loginInput"
              type="password" placeholder="Password (min 6 chars)" value={pass} onChange={e => setPass(e.target.value)}
            />
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                className="tt-loginBtn login"
                onClick={() => signInWithEmailAndPassword(auth, email, pass).catch(e => alert("LOGIN ERROR: " + e.message))}>
                Login
              </button>
              <button
                className="tt-loginBtn signup"
                onClick={() => createUserWithEmailAndPassword(auth, email, pass).catch(e => alert("SIGNUP ERROR: " + e.message))}>
                Sign Up
              </button>
            </div>
          </div>

          <div className="tt-loginDivider">— OR —</div>

          {/* GOOGLE LOGIN FALLBACK */}
          <button
            className="tt-loginGoogleBtn"
            onClick={() => {
              signInWithPopup(auth, googleProvider).catch((error) => {
                alert("GOOGLE LOGIN ERROR: " + error.message);
              });
            }}>
            Verify with Google
          </button>
        </div>

        <style>{`
          .tt-loginRoot {
            position: relative; display: flex; flex-direction: column; justify-content: center; align-items: center;
            height: 100vh; overflow: hidden; font-family: 'Segoe UI', Roboto, sans-serif;
            background: radial-gradient(ellipse at top, #1f2870 0%, #10133f 60%, #0a0c2b 100%);
          }
          .tt-loginGrid {
            position: absolute; inset: 0;
            background-image: linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px),
                               linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px);
            background-size: 42px 42px;
            mask-image: radial-gradient(ellipse at center, rgba(0,0,0,0.9) 0%, transparent 75%);
          }
          .tt-loginOrb {
            position: absolute; border-radius: 50%; filter: blur(60px); opacity: 0.35;
            animation: ttOrbFloat 16s ease-in-out infinite;
          }
          .tt-loginOrb.o1 { width: 320px; height: 320px; background: #f2c14e; top: -80px; left: -60px; animation-duration: 18s; }
          .tt-loginOrb.o2 { width: 260px; height: 260px; background: #2b6fd6; bottom: -60px; right: -40px; animation-duration: 22s; animation-delay: -4s; }
          .tt-loginOrb.o3 { width: 200px; height: 200px; background: #2a9d5c; top: 40%; right: 15%; animation-duration: 14s; animation-delay: -8s; }
          @keyframes ttOrbFloat {
            0%, 100% { transform: translate(0, 0) scale(1); }
            33% { transform: translate(30px, -20px) scale(1.1); }
            66% { transform: translate(-20px, 25px) scale(0.95); }
          }

          .tt-loginCard {
            position: relative; z-index: 2; width: 360px; padding: 40px 36px;
            background: rgba(255,255,255,0.06);
            border: 1px solid rgba(255,255,255,0.14);
            border-radius: 24px;
            backdrop-filter: blur(18px) saturate(140%);
            box-shadow: 0 24px 60px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.12);
            text-align: center; color: white;
            animation: ttCardIn .6s cubic-bezier(.2,.9,.3,1.1);
          }
          @keyframes ttCardIn { from { opacity: 0; transform: translateY(18px) scale(.97); } to { opacity: 1; transform: translateY(0) scale(1); } }

          .tt-loginTitle { font-size: 26px; margin: 0 0 6px 0; font-weight: 800; letter-spacing: .3px; }
          .tt-loginSub { font-size: 13px; opacity: 0.65; margin: 0 0 26px 0; letter-spacing: .5px; }

          .tt-loginForm { display: flex; flex-direction: column; gap: 12px; margin-bottom: 18px; }
          .tt-loginInput {
            padding: 13px 14px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.16);
            background: rgba(255,255,255,0.08); color: white; font-size: 15px; outline: none;
            transition: border-color .2s, background .2s;
          }
          .tt-loginInput::placeholder { color: rgba(255,255,255,0.45); }
          .tt-loginInput:focus { border-color: #f2c14e; background: rgba(255,255,255,0.13); }

          .tt-loginBtn {
            flex: 1; padding: 12px; border: none; border-radius: 12px; cursor: pointer;
            font-weight: 700; font-size: 15px; color: white; transition: transform .15s, box-shadow .15s;
          }
          .tt-loginBtn:hover { transform: translateY(-1px); }
          .tt-loginBtn.login { background: linear-gradient(145deg, #22c55e, #16a34a); box-shadow: 0 6px 16px rgba(34,197,94,0.35); }
          .tt-loginBtn.signup { background: linear-gradient(145deg, #3b82f6, #2563eb); box-shadow: 0 6px 16px rgba(59,130,246,0.35); }

          .tt-loginDivider { font-size: 12px; opacity: 0.4; margin: 6px 0 16px 0; letter-spacing: 1px; }

          .tt-loginGoogleBtn {
            padding: 13px 32px; background: linear-gradient(145deg, #f2c14e, #e8a92e); color: #151b4d;
            border: none; border-radius: 12px; font-size: 15px; font-weight: 800; cursor: pointer;
            box-shadow: 0 8px 20px rgba(242,193,78,0.3); transition: transform .15s;
          }
          .tt-loginGoogleBtn:hover { transform: translateY(-1px); }
        `}</style>
      </div>
    );
  }

  return (
    <>
      <StudyTimetable user={user} />
      {booting && <StudyLoader name={user.displayName || user.email} leaving={leaving} />}
    </>
  );
}

/* =============================================================
   MAIN COMPONENT (FIREBASE POWERED)
   ============================================================= */
function StudyTimetable({ user }: { user: User }) {
  const [mounted, setMounted] = useState(false);
  const [nowTick, setNowTick] = useState(0);
  // Local calendar day the board is bound to. Updated only on a REAL date change.
  const [dayKey, setDayKey] = useState(() => todayKey());


  // State
  const [examDates, setExamDates] = useState(EXAMS_DEFAULT);
  const [sessions, setSessions] = useState<Record<number, SessionRec>>(initSessions);
  const [checklist, setChecklist] = useState<Record<string, boolean>>(initChecklist);
  const [pending, setPending] = useState<number[]>([]);
  // Session count and actual study minutes are stored separately so the heatmap
  // remains useful after the daily document (completedLog) rolls over.
  const [heatmapLog, setHeatmapLog] = useState<Record<string, number>>({});
  const [studyMinutesLog, setStudyMinutesLog] = useState<Record<string, number>>({});
  const [completedLog, setCompletedLog] = useState<CompletedLog[]>([]);
  const [extensionLog, setExtensionLog] = useState<ExtensionLogEntry[]>([]);
  const [timeShift, setTimeShift] = useState(0);

  // UI State
  const [editingExam, setEditingExam] = useState<ExamKey | null>(null);
  const [monthOffset, setMonthOffset] = useState(0);
  const [heatmapDay, setHeatmapDay] = useState<{ date: string; logs: CompletedLog[]; extensions: ExtensionLogEntry[]; loading: boolean } | null>(null);
  const [extendModal, setExtendModal] = useState<{ id: number } | null>(null);
  const [extendMins, setExtendMins] = useState<number>(15);
  const [deductId, setDeductId] = useState<number | 'none'>('none');
  const [extendComment, setExtendComment] = useState<string>('');
  const [timerMinimized, setTimerMinimized] = useState(false);
  const [startPrompt, setStartPrompt] = useState<{ id: number } | null>(null);
  const [topicInput, setTopicInput] = useState<string>('');
  const [sessionTopics, setSessionTopics] = useState<Record<number, string>>({});
  const [startTopic, setStartTopic] = useState<string>('');

  // Sunday custom-day planner
  const [sundayPlan, setSundayPlan] = useState<SundayEntry[] | null>(null);
  const [sundayModal, setSundayModal] = useState(false);
  const [sundayDismissed, setSundayDismissed] = useState(false);
  const [sundayDraft, setSundayDraft] = useState<SundayEntry[]>([]);
  const [sdSubject, setSdSubject] = useState<string>(SUBJECT_PRESETS[0]?.act || "");
  const [sdCustom, setSdCustom] = useState<string>("");
  const [sdStart, setSdStart] = useState<string>("07:00");
  const [sdDur, setSdDur] = useState<number>(60);

  const isSunday = mounted && new Date().getDay() === 0;
  const activeRows = useMemo(
    () => (isSunday ? (sundayPlan && sundayPlan.length ? buildSundayRows(sundayPlan) : []) : ROWS),
    [isSunday, sundayPlan],
  );



  const ringRef = useRef<HTMLCanvasElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  // Firestore References — dayKey is state so a real date change re-points the doc
  const userRef = doc(db, "users", user.uid);
  const todayRef = doc(db, "users", user.uid, "daily", dayKey);

  /* -- GOOGLE SHEETS SYNC -- */
  const postToSheet = useCallback(async (payload: any, type: string) => {
    try {
      await fetch(WEB_APP_URL, {
        method: 'POST',
        mode: 'no-cors', // Essential for Apps Script - response is opaque, don't try to read it
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          secret: SHARED_SECRET,
          type: type,
          date: todayKey(),
          user: user.email,
          payload: payload,
        }),
      });
    } catch (e) {
      console.error("Sheet sync failed", e);
    }
  }, [user.email]);

  /* -- DATE ROLLOVER WATCHER --
     The board used to bind to the day it was opened on. Now we poll the local
     date every 30s and only re-point Firestore when the calendar day actually
     changes, so an open tab never silently drifts onto the wrong document. */
  useEffect(() => {
    const id = window.setInterval(() => {
      const k = todayKey();
      setDayKey((cur) => (cur === k ? cur : k));
    }, 30000);
    return () => window.clearInterval(id);
  }, []);

  /* -- FIREBASE REAL-TIME SYNC -- */
  useEffect(() => {
    // 1. Listen to Global User Data (Exams, Heatmap)
    const unsubUser = onSnapshot(userRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data.examDates) setExamDates(data.examDates);
        if (data.heatmapLog) setHeatmapLog(data.heatmapLog);
        if (data.studyMinutesLog) setStudyMinutesLog(data.studyMinutesLog);
      }
    });

    // 2. Listen to Today's Data (Sessions, Checklist, Timers)
    const unsubToday = onSnapshot(todayRef, { includeMetadataChanges: true }, (snap) => {
      const fromCache = snap.metadata.fromCache;
      if (snap.exists()) {
        const data = snap.data();
        if (data.sessions) {
          // Never let an incoming payload silently drop a session we already
          // finished locally but that hasn't round-tripped to the server yet.
          setSessions((prev) => {
            const next: Record<number, SessionRec> = { ...data.sessions };
            Object.entries(prev).forEach(([k, local]) => {
              const id = Number(k);
              const incoming = next[id];
              if (local?.status === "completed" && (!incoming || incoming.status === "notstarted") && snap.metadata.hasPendingWrites) {
                next[id] = local;
              }
            });
            return next;
          });
        }
        if (data.checklist) setChecklist(data.checklist);
        if (data.pending) setPending(data.pending);
        if (data.completedLog) setCompletedLog(data.completedLog);
        if (data.extensionLog) setExtensionLog(data.extensionLog);
        if (data.timeShift !== undefined) setTimeShift(data.timeShift);
        if (data.sessionTopics) setSessionTopics(data.sessionTopics);
        if (data.sundayPlan) setSundayPlan(data.sundayPlan);
      } else if (!fromCache) {
        // Only create a fresh day when the SERVER confirms there is none.
        // A cache-only "missing" snapshot (offline blip, reconnect, sleep/wake)
        // used to blank the day and flip finished tasks back to pending.
        setDoc(todayRef, { sessions: initSessions(), checklist: initChecklist(), pending: [], completedLog: [], timeShift: 0 }, { merge: true });
      }
      setMounted(true);
      window.dispatchEvent(new Event("tt-data-ready"));
    });

    return () => { unsubUser(); unsubToday(); };
  }, [user.uid, dayKey]);


  /* -- DEFENSIVE RESYNC (fixes stale data in WebView2 / live-wallpaper embeds) --
     Some embedded WebView2 contexts silently drop Firestore's realtime
     WebSocket connection without reconnecting, especially when the window
     never gets normal browser focus (e.g. running as a desktop wallpaper).
     onSnapshot can then go quiet forever while looking "connected". As a
     safety net, we force a plain one-time read whenever the tab regains
     visibility/focus/network, and again every 45s regardless, so a phone
     edit always shows up on the laptop viewer within that window. */
  useEffect(() => {
    const forceResync = async () => {
      try {
        const [userSnap, todaySnap] = await Promise.all([getDoc(userRef), getDoc(todayRef)]);
        if (userSnap.exists()) {
          const data = userSnap.data();
          if (data.examDates) setExamDates(data.examDates);
          if (data.heatmapLog) setHeatmapLog(data.heatmapLog);
          if (data.studyMinutesLog) setStudyMinutesLog(data.studyMinutesLog);
        }
        if (todaySnap.exists()) {
          const data = todaySnap.data();
          if (data.sessions) setSessions(data.sessions);
          if (data.checklist) setChecklist(data.checklist);
          if (data.pending) setPending(data.pending);
          if (data.completedLog) setCompletedLog(data.completedLog);
          if (data.extensionLog) setExtensionLog(data.extensionLog);
          if (data.timeShift !== undefined) setTimeShift(data.timeShift);
          if (data.sessionTopics) setSessionTopics(data.sessionTopics);
          if (data.sundayPlan) setSundayPlan(data.sundayPlan);

        }
      } catch (e) {
        console.error("Forced resync failed", e);
      }
    };

    const onVisible = () => { if (document.visibilityState === "visible") forceResync(); };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", forceResync);
    window.addEventListener("online", forceResync);
    const pollId = window.setInterval(forceResync, 45000);

    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", forceResync);
      window.removeEventListener("online", forceResync);
      window.clearInterval(pollId);
    };
  }, [user.uid, dayKey]);

  // Push updates to Firebase
  const updateToday = (updates: Partial<any>) => setDoc(todayRef, updates, { merge: true });
  const updateUserStats = (updates: Partial<any>) => setDoc(userRef, updates, { merge: true });

  /* -- sound -- */
  const playTone = useCallback((freq: number, duration: number, vol: number) => {
    try {
      if (!audioCtxRef.current) {
        const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        audioCtxRef.current = new AC();
      }
      const ctx = audioCtxRef.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine"; osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(vol, ctx.currentTime + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(); osc.stop(ctx.currentTime + duration + 0.02);
    } catch {}
  }, []);

  const playStartChime = useCallback(() => { playTone(523, 0.18, 0.12); setTimeout(() => playTone(659, 0.22, 0.12), 120); }, [playTone]);
  const playCompleteChime = useCallback(() => { playTone(659, 0.16, 0.12); setTimeout(() => playTone(880, 0.28, 0.12), 140); }, [playTone]);

  /* -- 1-second tick for local timers -- */
  useEffect(() => {
    const id = window.setInterval(() => setNowTick((x) => x + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const now = Date.now();
    let changed = false;
    const nextSessions = { ...sessions };
    const toComplete: number[] = [];
    activeRows.forEach((r) => {
      if (!isFocusRow(r)) return;
      const st = nextSessions[r.id];
      if (st && st.status === "running" && st.endTs) {
        const remaining = Math.round((st.endTs - now) / 1000);
        if (remaining <= 0) toComplete.push(r.id);
        else if (remaining !== st.remaining) { nextSessions[r.id] = { ...st, remaining }; changed = true; }
      }
    });
    if (changed) setSessions(nextSessions);
    toComplete.forEach((id) => completeSession(id));
  }, [nowTick, mounted]);

  useEffect(() => {
    if (!mounted) return;
    const check = () => {
      const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
      const nextPending = [...pending];
      let pendingChanged = false;
      activeRows.forEach((r) => {
        if (!isFocusRow(r)) return;
        const st = sessions[r.id];
        const endMin = r.startMin + r.dur + timeShift;
        if (st && st.status === "notstarted" && nowMin > endMin && !nextPending.includes(r.id)) {
          nextPending.push(r.id);
          pendingChanged = true;
        }
      });
      if (pendingChanged) {
        setPending(nextPending);
        updateToday({ pending: nextPending });
      }
    };
    check();
    const id = window.setInterval(check, 60000);
    return () => window.clearInterval(id);
  }, [sessions, timeShift, mounted, pending]);

  const totalFocus = useMemo(() => activeRows.filter(isFocusRow).length, [activeRows]);

  // Ask for the Sunday plan once the day's data is loaded and nothing is planned yet.
  useEffect(() => {
    if (!mounted || !isSunday || sundayDismissed) return;
    if (!sundayPlan || sundayPlan.length === 0) setSundayModal(true);
  }, [mounted, isSunday, sundayPlan, sundayDismissed]);

  const openSundayPlanner = () => {
    setSundayDraft(sundayPlan ? [...sundayPlan] : []);
    setSundayModal(true);
  };

  const addSundayEntry = () => {
    const custom = sdCustom.trim();
    const preset = SUBJECT_PRESETS.find((p) => p.act === sdSubject);
    const entry: SundayEntry = {
      subject: custom || preset?.act || "STUDY SESSION",
      cat: custom ? "technical" : preset?.cat || "technical",
      icon: custom ? "📚" : preset?.icon || "📚",
      focus: custom ? "Sunday custom mission" : preset?.focus || "Sunday custom mission",
      startMin: clockToMins(sdStart),
      dur: Math.max(5, Number(sdDur) || 0),
    };
    setSundayDraft((d) => [...d, entry].sort((a, b) => a.startMin - b.startMin));
    setSdCustom("");
    setSdStart(minsToInput(Math.min(1439, entry.startMin + entry.dur)));
  };

  const saveSundayPlan = () => {
    const plan = [...sundayDraft].sort((a, b) => a.startMin - b.startMin);
    const rows = buildSundayRows(plan);
    const nextSessions = initSessions(rows);
    // keep any progress already made on a row that still exists in the new plan
    rows.forEach((r) => { if (sessions[r.id]) nextSessions[r.id] = sessions[r.id]; });
    setSundayPlan(plan);
    setSessions(nextSessions);
    setSundayModal(false);
    updateToday({ sundayPlan: plan, sessions: nextSessions });
  };

  const doneToday = useMemo(() => completedLog.filter((l) => l.date === todayKey()), [completedLog]);
  const streak = useMemo(() => {
    let s = 0; const d = new Date();
    while (true) {
      const key = localDateKey(d);
      if (heatmapLog[key] && heatmapLog[key] > 0) { s++; d.setDate(d.getDate() - 1); } else break;
    }
    return s;
  }, [heatmapLog]);

  // Live gradual progress: total allocated minutes vs. actual studied minutes
  // (completed sessions + elapsed portion of the currently running/paused session).
  const liveProgress = useMemo(() => {
    let allocated = 0;
    let studied = 0;
    activeRows.forEach((r) => {
      if (!isFocusRow(r)) return;
      const st = sessions[r.id];
      const alloc = st?.durationAllocated ?? r.dur;
      allocated += alloc;
      if (st?.status === "completed") {
        studied += alloc;
      } else if (st && (st.status === "running" || st.status === "paused")) {
        const elapsedSec = Math.max(0, alloc * 60 - Math.max(0, st.remaining));
        studied += elapsedSec / 60;
      }
    });
    return { allocated, studied, pct: allocated ? Math.min(1, studied / allocated) : 0 };
    // nowTick keeps this recomputing every second while a session runs
  }, [sessions, nowTick]);

  // Smoothly animated ring: eases toward the live target and never ticks
  // backwards (avoids the visible "snap back" when a session pauses/reopens).
  const ringDrawRef = useRef(0);
  const ringPeakRef = useRef(0);
  const ringTargetRef = useRef(0);
  ringPeakRef.current = Math.max(ringPeakRef.current, liveProgress.pct);
  ringTargetRef.current = ringPeakRef.current;

  useEffect(() => {
    const cvs = ringRef.current;
    if (!cvs) return;
    const ctx = cvs.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const size = 84;
    cvs.width = size * dpr; cvs.height = size * dpr;
    cvs.style.width = size + "px"; cvs.style.height = size + "px";
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);

    const cx = size / 2, cy = size / 2, r = 34, lw = 12;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    // little sparks that orbit + twinkle inside the ring
    const sparks = Array.from({ length: 7 }, (_, i) => ({
      a: (i / 7) * Math.PI * 2,
      rad: 8 + ((i * 5) % 17),
      sp: 0.0004 + (i % 3) * 0.00018,
      ph: i * 1.1,
    }));

    let raf = 0;
    const draw = (t: number) => {
      const target = ringTargetRef.current;
      // critically-damped-ish easing toward target
      ringDrawRef.current += (target - ringDrawRef.current) * (reduce ? 1 : 0.08);
      if (Math.abs(target - ringDrawRef.current) < 0.0005) ringDrawRef.current = target;
      const pct = ringDrawRef.current;

      ctx.clearRect(0, 0, size, size);

      // track
      ctx.lineWidth = lw; ctx.lineCap = "round";
      ctx.strokeStyle = "#e6e8f0";
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();

      // inner sparkles
      if (!reduce && pct > 0.001) {
        sparks.forEach((s) => {
          const a = s.a + t * s.sp;
          const tw = 0.35 + 0.65 * Math.abs(Math.sin(t * 0.0016 + s.ph));
          const x = cx + Math.cos(a) * s.rad;
          const y = cy + Math.sin(a) * s.rad;
          ctx.globalAlpha = tw * 0.55 * Math.min(1, pct * 2.2);
          ctx.fillStyle = "#f2c14e";
          ctx.beginPath(); ctx.arc(x, y, 1.1 + tw, 0, Math.PI * 2); ctx.fill();
          ctx.globalAlpha = 1;
        });
      }

      if (pct > 0) {
        const grad = ctx.createLinearGradient(0, 0, size, size);
        grad.addColorStop(0, "#f2c14e");
        grad.addColorStop(0.5, "#2b6fd6");
        grad.addColorStop(1, "#2a9d5c");
        const end = -Math.PI / 2 + Math.PI * 2 * pct;
        ctx.save();
        ctx.shadowColor = "rgba(43,111,214,.45)";
        ctx.shadowBlur = reduce ? 0 : 6 + 3 * Math.sin(t * 0.002);
        ctx.strokeStyle = grad;
        ctx.beginPath();
        ctx.arc(cx, cy, r, -Math.PI / 2, end);
        ctx.stroke();
        ctx.restore();
        // leading comet head
        if (!reduce) {
          const hx = cx + Math.cos(end) * r, hy = cy + Math.sin(end) * r;
          const pulse = 2.6 + 0.9 * Math.sin(t * 0.005);
          ctx.globalAlpha = 0.9;
          ctx.fillStyle = "#fff7e0";
          ctx.beginPath(); ctx.arc(hx, hy, pulse, 0, Math.PI * 2); ctx.fill();
          ctx.globalAlpha = 1;
        }
      }

      ctx.fillStyle = "#1f2870"; ctx.font = "700 16px Oswald, sans-serif";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(Math.round(pct * 100) + "%", cx, cy);

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);


  /* =========================================================
     ACTIONS (Pushing to Firebase)
     ========================================================= */
  const startSession = (id: number, topic: string = '') => {
    const st = sessions[id];
    if (!st || st.status === "completed") return;

    const nextSessions = { ...sessions };
    // Pause any running session
    Object.keys(nextSessions).forEach(key => {
       if (nextSessions[Number(key)].status === 'running') {
         nextSessions[Number(key)].status = 'paused';
         nextSessions[Number(key)].endTs = null;
       }
    });

    nextSessions[id] = { ...st, status: "running", endTs: Date.now() + st.remaining * 1000, warned: false };

    const trimmedTopic = topic.trim();
    const newSessionTopics = trimmedTopic ? { ...sessionTopics, [id]: trimmedTopic } : sessionTopics;

    playStartChime();
    setSessions(nextSessions);
    if (trimmedTopic) setSessionTopics(newSessionTopics);
    updateToday({ sessions: nextSessions, pending: pending.filter((x) => x !== id), sessionTopics: newSessionTopics });

    // Sync to Google Sheets
    const row = activeRows.find((r) => r.id === id);
    if (row) postToSheet({ row: row.act, cat: row.cat, topic: trimmedTopic }, "session_started");
  };

  const pauseSession = (id: number) => {
    const st = sessions[id];
    if (!st || st.status !== "running" || !st.endTs) return;

    const remaining = Math.round((st.endTs - Date.now()) / 1000);
    const nextSessions = { ...sessions, [id]: { ...st, status: "paused" as const, remaining, endTs: null } };

    setSessions(nextSessions);
    updateToday({ sessions: nextSessions });
  };

  const completeSession = (id: number) => {
    const row = activeRows.find((r) => r.id === id);
    if (!row) return;

    const nextSessions = { ...sessions, [id]: { ...sessions[id], status: "completed", remaining: 0, endTs: null } as SessionRec };
    const finalDur = sessions[id]?.durationAllocated ?? row.dur;

    // Check if already completed to prevent duplicates
    let newLog = completedLog;
    if (!completedLog.some((l) => l.rowId === id && l.date === todayKey())) {
      newLog = [...completedLog, { date: todayKey(), rowId: id, cat: row.cat, durMin: finalDur, ts: Date.now() }];
    }

    const newChecklist = markChecklistItemDone(checklist, id);

    playCompleteChime();
    setSessions(nextSessions);
    const todaysCount = newLog.filter((l) => l.date === todayKey()).length;
    updateToday({
      sessions: nextSessions,
      completedLog: newLog,
      checklist: newChecklist,
      pending: pending.filter((x) => x !== id),
      sessionsCompleted: todaysCount,
      minutesCompleted: newLog.filter((l) => l.date === todayKey()).reduce((a, l) => a + l.durMin, 0),
    });
    // NOTE: must be a nested map, not a "heatmapLog.<date>" dotted key — setDoc()
    // treats dotted strings as literal field names, which is why the email engine
    // was reading 0 sessions.
    const key = todayKey();
    const nextHeat = { ...heatmapLog, [key]: (heatmapLog[key] || 0) + 1 };
    const nextMinutes = { ...studyMinutesLog, [key]: (studyMinutesLog[key] || 0) + finalDur };
    setHeatmapLog(nextHeat);
    setStudyMinutesLog(nextMinutes);
    updateUserStats({
      heatmapLog: { [key]: nextHeat[key] },
      studyMinutesLog: { [key]: nextMinutes[key] },
    });

    // Sync this event to Google Sheets
    postToSheet({ row: row.act, cat: row.cat, minutes: finalDur, status: "completed" }, "session_completed");

    setTimerMinimized(false);
  };

  const extendSession = (id: number, minutes: number, targetDeductId: number | 'none', comment: string = '') => {
    if (minutes <= 0) return;
    const st = sessions[id];
    const reopened = st.status === "completed";

    // Guard: never allow a session to deduct time from itself (this was the bug
    // causing extensions to silently cancel out when the trade dropdown had a
    // stale selection left over from a previous extend on a different row).
    if (targetDeductId === id) targetDeductId = 'none';

    const nextSessions = { ...sessions };
    const remaining = (reopened ? 0 : st.remaining) + minutes * 60;
    const status = reopened ? "running" : st.status;
    const endTs = status === "running" ? Date.now() + remaining * 1000 : null;
    const oldAllocated = st.durationAllocated ?? (activeRows.find(r => r.id === id)?.dur || 0);

    nextSessions[id] = { ...st, status: status as SessionStatus, remaining, endTs, durationAllocated: oldAllocated + minutes, warned: false };
    let newShift = timeShift;

    if (targetDeductId !== 'none' && nextSessions[targetDeductId]) {
      const dst = nextSessions[targetDeductId];
      const dstRow = activeRows.find((r) => r.id === targetDeductId);
      const dstAllocated = dst.durationAllocated ?? dstRow?.dur ?? 0;
      const nextAllocated = Math.max(0, dstAllocated - minutes);
      const nextRemaining = Math.min(nextAllocated * 60, Math.max(0, dst.remaining - minutes * 60));
      nextSessions[targetDeductId] = {
        ...dst,
        remaining: nextRemaining,
        endTs: dst.status === "running" && nextRemaining > 0 ? Date.now() + nextRemaining * 1000 : null,
        durationAllocated: nextAllocated,
        status: nextAllocated === 0 ? "completed" : dst.status,
      };
    } else {
      newShift += minutes;
    }

    let newLog = completedLog;
    let newChecklist = checklist;

    if (reopened) {
       newLog = completedLog.filter(log => !(log.date === todayKey() && log.rowId === id));
       const key = todayKey();
       const completedEntry = completedLog.find((log) => log.date === key && log.rowId === id);
       const loggedMinutes = completedEntry?.durMin ?? oldAllocated;
       const decHeat = { ...heatmapLog, [key]: Math.max((heatmapLog[key] || 1) - 1, 0) };
       const decMinutes = { ...studyMinutesLog, [key]: Math.max((studyMinutesLog[key] || 0) - loggedMinutes, 0) };
       setHeatmapLog(decHeat);
       setStudyMinutesLog(decMinutes);
       updateUserStats({
         heatmapLog: { [key]: decHeat[key] },
         studyMinutesLog: { [key]: decMinutes[key] },
       });

       const checklistItem = ROW_CHECKLIST_MAP[id];
       if (checklistItem) {
         newChecklist = { ...checklist, [checklistItem]: false };
       }
    }

    if (targetDeductId !== 'none') {
      const deductedSession = nextSessions[targetDeductId];
      const deductedRow = activeRows.find((r) => r.id === targetDeductId);
      const alreadyLogged = completedLog.some((log) => log.date === todayKey() && log.rowId === targetDeductId);
      if (deductedSession?.durationAllocated === 0 && deductedRow && !alreadyLogged) {
        newLog = [
          ...newLog,
          { date: todayKey(), rowId: targetDeductId, cat: deductedRow.cat, durMin: 0, ts: Date.now() },
        ];
        newChecklist = markChecklistItemDone(newChecklist, targetDeductId);
      }
    }

    const completedByDeduction =
      targetDeductId !== 'none' && nextSessions[targetDeductId]?.durationAllocated === 0
        ? targetDeductId
        : null;
    const newPending =
      completedByDeduction === null
        ? pending
        : pending.filter((pendingId) => pendingId !== completedByDeduction);

    // Silently log this extension to Firebase for the email engine.
    const deductedFrom =
      targetDeductId !== 'none'
        ? activeRows.find((r) => r.id === targetDeductId)?.act || String(targetDeductId)
        : null;
    const extensionEntry = {
      date: todayKey(),
      rowId: id,
      activity: activeRows.find((r) => r.id === id)?.act || String(id),
      minutes,
      deductedFromRowId: targetDeductId === 'none' ? null : targetDeductId,
      deductedFrom,
      comment: comment.trim(),
      reopened,
      ts: Date.now(),
    };

    setSessions(nextSessions);
    updateToday({
      sessions: nextSessions,
      timeShift: newShift,
      completedLog: newLog,
      checklist: newChecklist,
      pending: newPending,
      extensionLog: [...extensionLog, extensionEntry],
      sessionsCompleted: newLog.filter((l) => l.date === todayKey()).length,
      minutesCompleted: newLog.filter((l) => l.date === todayKey()).reduce((a, l) => a + l.durMin, 0),
    });

    // Sync to Google Sheets
    postToSheet(extensionEntry, reopened ? "session_reopened_extended" : "session_extended");
  };

  const openHeatmapDay = async (date: string) => {
    setHeatmapDay({ date, logs: [], extensions: [], loading: true });
    try {
      const snapshot = await getDoc(doc(db, "users", user.uid, "daily", date));
      const data = snapshot.exists() ? snapshot.data() : null;
      const logs = data && Array.isArray(data.completedLog)
        ? data.completedLog as CompletedLog[]
        : [];
      const extensions = data && Array.isArray(data.extensionLog)
        ? data.extensionLog as ExtensionLogEntry[]
        : [];
      setHeatmapDay({ date, logs, extensions, loading: false });
    } catch (error) {
      console.error("Could not load heatmap day", error);
      setHeatmapDay({ date, logs: [], extensions: [], loading: false });
    }
  };

  const saveExamDate = (key: ExamKey, val: string) => {
    if (!val) return;
    const newExams = { ...examDates, [key]: { ...examDates[key], date: val } };
    setExamDates(newExams);
    setEditingExam(null);
    updateUserStats({ examDates: newExams });
  };

  const toggleCheck = (item: string, val: boolean) => {
    const newChecklist = { ...checklist, [item]: val };
    setChecklist(newChecklist);
    updateToday({ checklist: newChecklist });
  };

  /* =========================================================
     DERIVED VIEW STATE
     ========================================================= */
  const now = new Date();
  const hh = now.getHours();
  const greet = hh < 12 ? "Good Morning" : hh < 17 ? "Good Afternoon" : "Good Evening";
  const greetLine = mounted ? `${greet}, Officer Rohan — ${now.toLocaleDateString("en-IN", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}` : "Good Morning, Officer Rohan";
  const clockLine = mounted ? now.toLocaleTimeString("en-IN", { hour12: true }) : "--:--:--";
  const dayOfYear = Math.floor((now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86400000);
  // Pick from a tier that actually matches how the day is going, instead of a
  // pure day-of-year rotation that might congratulate you on a slow day or
  // undersell a genuinely strong one.
  const dailyQuote = useMemo(() => {
    if (streak >= 3 || liveProgress.pct >= 0.6) {
      return HIGH_PERFORMANCE_QUOTES[dayOfYear % HIGH_PERFORMANCE_QUOTES.length];
    }
    if (liveProgress.pct === 0 && doneToday.length === 0) {
      return LOW_PROGRESS_QUOTES[dayOfYear % LOW_PROGRESS_QUOTES.length];
    }
    return QUOTES[dayOfYear % QUOTES.length];
  }, [dayOfYear, streak, liveProgress.pct, doneToday.length]);

  const displayedStart = (row: Row) => {
    if (!mounted) return row.time.split("–")[0].trim();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    if (row.startMin > nowMin) return minsToClock(row.startMin + timeShift);
    return row.time.split("–")[0].trim();
  };

  const runningRow = activeRows.find((r) => isFocusRow(r) && sessions[r.id]?.status === "running") || null;
  const todayIdx = (now.getDay() + 6) % 7;

  /* ---- MONTHLY HEATMAP + MONTH-OVER-MONTH COMPARISON ---- */
  // New entries are exact. Older session-only history is shown with a clearly
  // consistent one-hour-per-session fallback until a user completes new sessions.
  const studyMinutesForDate = useCallback((key: string) => {
    const storedMinutes = studyMinutesLog[key];
    const localMinutes = completedLog
      .filter((entry) => entry.date === key)
      .reduce((total, entry) => total + entry.durMin, 0);

    // The current session is not complete yet, so it is not in Firebase's
    // completed-minute log. Include its live elapsed time immediately instead
    // of making today's heatmap wait until the session is completed.
    if (key === todayKey()) return Math.max(storedMinutes || 0, localMinutes, liveProgress.studied);
    if (storedMinutes !== undefined) return storedMinutes;
    return localMinutes || (heatmapLog[key] || 0) * 60;
  }, [studyMinutesLog, completedLog, heatmapLog, liveProgress.studied]);

  const monthStatsFor = useCallback((y: number, m: number) => {
    const days = new Date(y, m + 1, 0).getDate();
    let sessions = 0, activeDays = 0, best = { key: "—", count: 0 };
    for (let d = 1; d <= days; d++) {
      const key = localDateKey(new Date(y, m, d));
      const c = heatmapLog[key] || 0;
      if (c > 0) { sessions += c; activeDays++; }
      if (c > best.count) best = { key, count: c };
    }
    const minutes = Array.from({ length: days }, (_, index) =>
      studyMinutesForDate(localDateKey(new Date(y, m, index + 1))),
    ).reduce((sum, value) => sum + value, 0);
    return { sessions, activeDays, minutes, best, days };
  }, [heatmapLog, studyMinutesLog, studyMinutesForDate]);

  const monthView = useMemo(() => {
    const base = new Date();
    const d = new Date(base.getFullYear(), base.getMonth() + monthOffset, 1);
    const y = d.getFullYear(), m = d.getMonth();
    const total = new Date(y, m + 1, 0).getDate();
    const lead = (new Date(y, m, 1).getDay() + 6) % 7; // Monday-first
    const rawDays = Array.from({ length: total }, (_, index) => {
      const day = index + 1;
      const key = localDateKey(new Date(y, m, day));
      const storedSessions = heatmapLog[key] || 0;
      // Keep today's cell live as sessions are completed locally, before the
      // Firestore round trip arrives on another device.
      const count = key === todayKey() ? Math.max(storedSessions, doneToday.length) : storedSessions;
      const minutes = studyMinutesForDate(key);
      return { key, count, minutes, day };
    });
    const monthMaxHours = Math.max(12, ...rawDays.map((cell) => cell.minutes / 60));
    const monthMaxSessions = Math.max(1, ...rawDays.map((cell) => cell.count));
    const cells: ({ key: string; count: number; minutes: number; intensity: number; day: number } | null)[] = [];
    for (let i = 0; i < lead; i++) cells.push(null);
    rawDays.forEach((cell) => {
      // Full glow is calibrated to the best recorded day in the month, but the
      // hour scale never tops out below 12h so an 11.6–11.8h planned day does
      // not look "complete" unless the user truly crosses the 12h target.
      const hourScore = (cell.minutes / 60) / monthMaxHours;
      const sessionScore = cell.count / monthMaxSessions;
      const intensity = Math.ceil(Math.max(hourScore, sessionScore) * 4);
      cells.push({ ...cell, intensity });
    });
    const cur = monthStatsFor(y, m);
    const pd = new Date(y, m - 1, 1);
    const prev = monthStatsFor(pd.getFullYear(), pd.getMonth());
    const spark = Array.from({ length: 6 }, (_, i) => {
      const sd = new Date(y, m - (5 - i), 1);
      const st = monthStatsFor(sd.getFullYear(), sd.getMonth());
      return { label: sd.toLocaleString(undefined, { month: "short" })[0], hours: st.minutes / 60, sessions: st.sessions };
    });
    const sparkMax = Math.max(1, ...spark.map((s) => s.hours));
    return {
      label: d.toLocaleString(undefined, { month: "long", year: "numeric" }),
      cells, cur, prev, spark, sparkMax,
      isCurrentMonth: monthOffset === 0,
    };
  }, [monthOffset, heatmapLog, studyMinutesLog, studyMinutesForDate, monthStatsFor, doneToday.length]);


  const analytics = useMemo(() => {
    const nowD = new Date();
    const weekAgo = new Date(nowD); weekAgo.setDate(nowD.getDate() - 6);
    const monthAgo = new Date(nowD); monthAgo.setDate(nowD.getDate() - 29);
    const inRange = (dstr: string, from: Date) => dstr >= localDateKey(from);
    const todayLogs = completedLog.filter((l) => l.date === todayKey());
    const sum = (arr: CompletedLog[]) => arr.reduce((a, b) => a + b.durMin, 0);
    const sumMinutesSince = (from: Date) =>
      Object.keys(heatmapLog)
        .filter((date) => inRange(date, from))
        .reduce((total, date) => total + studyMinutesForDate(date), 0);
    const allSessions = Object.values(heatmapLog).reduce((total, value) => total + value, 0);
    const allMinutes = Object.keys(heatmapLog).reduce((total, date) => total + studyMinutesForDate(date), 0);
    const avgSession = allSessions ? Math.round(allMinutes / allSessions) : 0;
    const longest = completedLog.length ? Math.max(...completedLog.map((l) => l.durMin)) : 0;
    const bySubject: Record<string, number> = {};
    completedLog.forEach((l) => { const r = activeRows.find((x) => x.id === l.rowId); if (r) bySubject[r.act] = (bySubject[r.act] || 0) + l.durMin; });
    const mostStudied = Object.keys(bySubject).sort((a, b) => bySubject[b] - bySubject[a])[0] || "—";
    const byDay: Record<string, number> = { ...heatmapLog };
    const bestDay = Object.keys(byDay).sort((a, b) => byDay[b] - byDay[a])[0] || "—";
    const weakDay = Object.entries(byDay).filter(([, v]) => v > 0).sort((a, b) => a[1] - b[1])[0]?.[0] || "—";

    // Partial credit: time spent on a session you started but haven't hit
    // "Complete" on yet shouldn't be lost from your totals. liveProgress.studied
    // already includes elapsed time on running/paused sessions, so it's the
    // true "today" figure. Today falls inside both the week and month windows
    // too, so we carry the same partial-time bonus into those totals.
    const todayCompletedMin = sum(todayLogs);
    const partialBonus = Math.max(0, liveProgress.studied - todayCompletedMin);

    return {
      cells: [
        ["TODAY", (liveProgress.studied / 60).toFixed(1) + "h"],
        ["THIS WEEK", ((sumMinutesSince(weekAgo) + partialBonus) / 60).toFixed(1) + "h"],
        ["THIS MONTH", ((sumMinutesSince(monthAgo) + partialBonus) / 60).toFixed(1) + "h"],
        ["COMPLETED SESSIONS", String(allSessions)],
        ["AVG SESSION", avgSession + "m"],
        ["MOST STUDIED", mostStudied],
        ["LONGEST SESSION", longest + "m"],
        ["CURRENT STREAK", streak + "d"],
        ["BEST DAY", bestDay],
        ["WEAK DAY", weakDay],
      ] as [string, string][],
    };
  }, [completedLog, heatmapLog, studyMinutesLog, studyMinutesForDate, streak, liveProgress]);

  /* =========================================================
     AUTO-FIT — measure the real board and scale it so it fits
     any desktop/laptop resolution and OS/browser zoom level.
     ========================================================= */
  const rootRef = useRef<HTMLDivElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const appRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const MIN_SCALE = 0.62;
    let raf = 0;
    let measuring = false;

    const measure = () => {
      const root = rootRef.current;
      const wrap = wrapRef.current;
      const app = appRef.current;
      if (!root || !wrap || !app) return;

      // visualViewport reflects browser zoom + OS display scaling correctly.
      const vv = window.visualViewport;
      const vw = Math.round(vv?.width ?? window.innerWidth);
      const vh = Math.round(vv?.height ?? window.innerHeight);

      // Below laptop width we reflow instead of scaling.
      if (vw < 1024) {
        root.style.setProperty("--tt-fit-scale", "1");
        root.classList.remove("tt-fit-overflow");
        return;
      }

      measuring = true;
      const prevTransform = wrap.style.transform;
      wrap.style.transform = "none";

      let s = 1;
      for (let i = 0; i < 4; i++) {
        app.style.width = `${vw / s}px`;
        app.style.height = "auto";
        const contentH = app.scrollHeight;
        if (!contentH) break;
        const next = Math.min(1, vh / contentH);
        const clamped = Math.max(MIN_SCALE, next);
        const settled = Math.abs(clamped - s) < 0.004;
        s = clamped;
        if (settled) break;
      }

      // restore layout-driven sizing
      app.style.width = "";
      app.style.height = "";
      wrap.style.transform = prevTransform;

      root.style.setProperty("--tt-fit-scale", String(Math.round(s * 1000) / 1000));
      root.classList.toggle("tt-fit-overflow", s <= MIN_SCALE + 0.001);
      requestAnimationFrame(() => { measuring = false; });
    };

    const schedule = () => {
      if (measuring) return;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(measure);
    };

    function onDpr() {
      watchDpr();
      schedule();
    }

    let dprQuery: MediaQueryList | null = null;
    const watchDpr = () => {
      dprQuery?.removeEventListener("change", onDpr);
      dprQuery = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
      dprQuery.addEventListener("change", onDpr);
    };

    schedule();
    watchDpr();

    window.addEventListener("resize", schedule);
    window.visualViewport?.addEventListener("resize", schedule);
    window.visualViewport?.addEventListener("scroll", schedule);

    const ro = new ResizeObserver(() => schedule());
    if (appRef.current) ro.observe(appRef.current);

    const fonts = (document as Document & { fonts?: { ready?: Promise<unknown> } }).fonts;
    fonts?.ready?.then(() => schedule());

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", schedule);
      window.visualViewport?.removeEventListener("resize", schedule);
      window.visualViewport?.removeEventListener("scroll", schedule);
      dprQuery?.removeEventListener("change", onDpr);
      ro.disconnect();
    };
  }, []);


  /* =========================================================
     RENDER
     ========================================================= */
  return (
    <div className="tt-root" ref={rootRef}>
      <div className="tt-scaleWrap" ref={wrapRef}>
        <div className="tt-app" ref={appRef}>
          {/* EXAM STRIP */}
          <div className="tt-examStrip">
            {(["ssc", "gate", "ese"] as ExamKey[]).map((key) => {
              const e = examDates[key];
              const c = mounted ? countdownParts(e.date) : { d: 0, h: 0, m: 0, s: 0 };
              return (
                <div key={key} className={`tt-examBox ${key}`} onClick={() => setEditingExam((cur) => (cur === key ? null : key))}>
                  <div className="tt-num">
                    {mounted ? `${c.d}d : ${String(c.h).padStart(2, "0")}h : ${String(c.m).padStart(2, "0")}m : ${String(c.s).padStart(2, "0")}s` : "-- : -- : -- : --"}
                  </div>
                  <div className="tt-lbl">TO {e.label}</div>
                  <div className="tt-sub">target: {e.date} (tap to edit)</div>
                  {editingExam === key && (
                    <div className="tt-examEdit" onClick={(ev) => ev.stopPropagation()}>
                      <input type="date" defaultValue={e.date} onKeyDown={(ev) => { if (ev.key === "Enter") saveExamDate(key, (ev.target as HTMLInputElement).value); }} id={`edit_${key}`} />
                      <button onClick={() => { const el = document.getElementById(`edit_${key}`) as HTMLInputElement | null; if (el) saveExamDate(key, el.value); }}>Save</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* HEADER */}
          <div className="tt-header">
            <div className="tt-headerTop">
              <div style={{ width: 150 }}>
                <div className="tt-brandIcon">💡</div>
                <div className="tt-rulesList">
                  <div><span>✔</span>Plan Your Work</div>
                  <div><span>✔</span>Work Your Plan</div>
                  <div><span>✔</span>Stay Consistent</div>
                  <div><span>✔</span>Success is Inevitable</div>
                </div>
              </div>
              <div className="tt-titleBlock">
                <h1>UNIVERSAL STUDY TIMETABLE</h1>
                <div className="tt-examTags">
                  <b className="blue">UPSC ESE (ELECTRICAL)</b> | <b className="red">MPSC</b> | <b className="green">SSC JE</b> | <b className="purple">RRB JE</b> | <b className="orange">SSC CGL</b> | <b className="blue">RAILWAYS</b>
                </div>
                <div className="tt-motto">★ ★ &nbsp; ONE DAY OR DAY ONE. YOU DECIDE. &nbsp; ★ ★</div>
              </div>
              <div style={{ width: 150 }}>
                <div className="tt-targetBlock">
                  🎯<br /><span className="t1">FOCUS</span><br /><span className="t2">DISCIPLINE</span><br /><span className="t3">SUCCESS</span>
                </div>
              </div>
            </div>

            <div className="tt-liveRow">
              <div className="tt-greet">{greetLine}</div>
              <div className="tt-clock">{clockLine}</div>
            </div>
            <div className="tt-quoteBar" key={dailyQuote}>&ldquo;{dailyQuote}&rdquo;</div>
            <div className="tt-syncIndicator" style={{ background: '#dcfce7', color: '#166534', border: '1px solid #bbf7d0', padding: '6px 12px', borderRadius: '20px', display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 'bold' }}>
              <span className="tt-syncDot" aria-hidden="true" style={{ background: '#22c55e', width: '8px', height: '8px', borderRadius: '50%', display: 'inline-block' }} />
              <span>Firebase Database Synced ⚡ ({user.email})</span>
            </div>
            {isSunday && (
              <button className="tt-sundayBtn" onClick={openSundayPlanner}>
                🗓 {sundayPlan && sundayPlan.length ? "Re-plan Sunday" : "Plan your Sunday"}
              </button>
            )}

          </div>

          {/* MAIN GRID */}
          <div className="tt-mainGrid">
            <div className="tt-leftCol">
              <table className="tt-table">
                <thead>
                  <tr>
                    <th style={{ width: "4%" }}></th><th style={{ width: "9%" }}>TIME</th><th style={{ width: "29%" }}>ACTIVITY</th><th style={{ width: "29%" }}>FOCUS / SUBJECT</th><th style={{ width: "8%" }}>STATUS</th><th style={{ width: "9%" }}>TIMER</th><th style={{ width: "12%" }}>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {isSunday && (!sundayPlan || sundayPlan.length === 0) && (
                    <tr className="tt-rowLIFE">
                      <td className="tt-rowIcon">🗓</td>
                      <td colSpan={6} style={{ textAlign: "center", padding: "18px" }}>
                        <b>Sunday is yours to design.</b>{" "}
                        <button className="tt-sundayBtn" onClick={openSundayPlanner}>Plan your Sunday</button>
                      </td>
                    </tr>
                  )}
                  {activeRows.map((r) => {

                    if (!isFocusRow(r)) {
                      return (
                        <tr key={r.id} className="tt-rowLIFE">
                          <td className="tt-rowIcon">{r.icon}</td><td>{displayedStart(r)}</td><td><b>{r.act}</b></td><td>{r.focus}</td><td colSpan={3} style={{ textAlign: "center", color: "#bbb" }}>— not a focus session —</td>
                        </tr>
                      );
                    }
                    const st = sessions[r.id];
                    const rowClass = st.status === "running" ? "tt-rowRUN" : st.status === "paused" ? "tt-rowPAUSE" : st.status === "completed" ? "tt-rowDONE" : "tt-rowNS";
                    const pillClass = "tt-st-" + st.status;
                    const pillLabel = st.status === "notstarted" ? "NOT STARTED" : st.status.toUpperCase();
                    const critical = st.status === "running" && st.remaining <= 5;
                    const anotherSessionRunning = Boolean(runningRow && runningRow.id !== r.id);
                    const disableStart = st.status === "running" || st.status === "completed" || anotherSessionRunning;
                    const disablePause = st.status !== "running";
                    const disableDone = st.status === "completed" || st.status === "notstarted" || st.remaining > 10 * 60;
                    const canExtend = st.status === "completed" || st.remaining <= 600;
                    const rowAllocSec = (st.durationAllocated ?? r.dur) * 60;
                    const rowPct = st.status === "running" && rowAllocSec > 0
                      ? Math.min(100, Math.max(0, Math.round(((rowAllocSec - Math.max(0, st.remaining)) / rowAllocSec) * 100)))
                      : 0;
                    const rowStyle = st.status === "running" ? ({ '--pct': `${rowPct}%` } as React.CSSProperties) : undefined;

                    return (
                      <tr key={r.id} className={rowClass} style={rowStyle}>
                        <td className="tt-rowIcon">{r.icon}</td>
                        <td>{displayedStart(r)}</td>
                        <td><b>{r.act}</b></td>
                        <td>
                          {r.focus}
                          {st.status === "running" && sessionTopics[r.id] && (
                            <div className="tt-rowTopic">📌 {sessionTopics[r.id]}</div>
                          )}
                        </td>
                        <td><span className={`tt-statusPill ${pillClass}`}>{pillLabel}</span></td>
                        <td className={`tt-rowTimer ${critical ? "critical" : ""}`}>{fmtTime(st.remaining)}</td>
                        <td className="tt-actBtns">
                          <button className="tt-b-start" disabled={disableStart} onClick={() => { if (st.status === 'notstarted') { setTopicInput(''); setStartPrompt({ id: r.id }); } else { startSession(r.id); } }}>▶</button>
                          <button className="tt-b-pause" disabled={disablePause} onClick={() => pauseSession(r.id)}>⏸</button>
                          <button className="tt-b-ext" disabled={!canExtend} onClick={() => { setDeductId('none'); setExtendComment(''); setExtendModal({ id: r.id }); }}>➕</button>
                          <button className="tt-b-done" disabled={disableDone} onClick={() => completeSession(r.id)}>✓</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* PENDING */}
              <div className="tt-pendingBox">
                <h3>⚠ PENDING MISSIONS</h3>
                <div className="tt-pendingList">
                  {pending.length === 0 ? (
                    <span className="tt-pendingEmpty">Nothing pending. Great job, Officer.</span>
                  ) : (
                    pending.map((id) => {
                      const r = activeRows.find((x) => x.id === id);
                      if (!r) return null;
                      return (
                        <div key={id} className="tt-pendingItem">
                          {r.icon} {r.act} <span style={{ color: "#999" }}>({r.dur}m)</span>
                          <button onClick={() => { setTopicInput(''); setStartPrompt({ id }); }}>Reschedule Now</button>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* BOTTOM GRID */}
              <div className="tt-bottomGrid">
                <div className="tt-col">
                  <div className="tt-card">
                    <h3>SUBJECT FOCUS (WEEKLY ROTATION)</h3>
                    <div className="tt-cardBody">
                      <table className="tt-rotationTable">
                        <tbody>
                          {ROTATION.map(([day, subj], i) => (
                            <tr key={day} className={i === todayIdx ? "today" : ""}><td><b>{day}</b></td><td>{subj}</td></tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  <div className="tt-card tt-analyticsCard">
                    <h3>ANALYTICS OVERVIEW</h3>
                    <div className="tt-analyticsGrid">
                      {analytics.cells.map(([l, v]) => (
                        <div key={l}><b>{v}</b>{l}</div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="tt-col">
                  <div className="tt-card">
                    <h3>EXAM COVERAGE</h3>
                    <div className="tt-cardBody">
                      <ul className="tt-examCoverage">
                        <li>UPSC ESE (Electrical)</li><li>MPSC Engineering Services</li><li>SSC JE</li><li>RRB JE / SSE</li><li>SSC CGL / CHSL / MTS</li><li>SSC GD</li><li>Railways NTPC / Group D</li>
                      </ul>
                    </div>
                  </div>
                  <div className="tt-card">
                    <h3>TODAY&apos;S PROGRESS</h3>
                    <div className="tt-ringWrap">
                      <canvas ref={ringRef} className="tt-ringCanvas" />
                      <div className="tt-statList">
                        <div>Studied: <b>{(liveProgress.studied / 60).toFixed(1)}h</b> / {(liveProgress.allocated / 60).toFixed(1)}h</div>
                        <div>Completed: <b>{doneToday.length}</b></div>
                        <div>Remaining: <b>{Math.max(totalFocus - doneToday.length, 0)}</b></div>
                        <div>Streak: <b>{streak}</b>d 🔥</div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="tt-col">
                  <div className="tt-card">
                    <h3>GOLDEN RULES</h3>
                    <div className="tt-cardBody">
                      <ul className="tt-goldenRules">
                        <li>Be Consistent</li><li>Follow the Plan</li><li>Avoid Distractions</li><li>Revise Regularly</li><li>Take Mock Tests</li><li>Analyze &amp; Improve</li><li>Believe in Yourself</li>
                      </ul>
                    </div>
                  </div>
                  <div className="tt-card tt-emailCard">
                    <h3>FIREBASE ENGINE SECURED 🛡️</h3>
                    <p>Google Auth + Email Password is enabled. Data is locked to your account and streams instantly in real-time across all your devices.</p>
                  </div>
                </div>

                <div className="tt-col tt-motivPanel">
                  <div className="tt-card" style={{ flex: "0 0 auto" }}>
                    <div className="tt-monthHead">
                      <h3>CONSISTENCY — {monthView.label}</h3>
                      <div className="tt-monthNav">
                        <button onClick={() => setMonthOffset((o) => o - 1)} aria-label="Previous month">‹</button>
                        <button onClick={() => setMonthOffset(0)} disabled={monthView.isCurrentMonth} aria-label="This month">•</button>
                        <button onClick={() => setMonthOffset((o) => Math.min(0, o + 1))} disabled={monthView.isCurrentMonth} aria-label="Next month">›</button>
                      </div>
                    </div>
                    <div className="tt-heatmapWrap">
                      <div className="tt-monthBody">
                        <div className="tt-monthGridWrap">
                          <div className="tt-monthDow">
                            {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => <span key={i}>{d}</span>)}
                          </div>
                          <div className="tt-monthGrid">
                            {monthView.cells.map((c, i) => {
                              if (!c) return <div key={`e${i}`} className="tt-hcell empty" />;
                              let cls = "tt-hcell";
                              if (c.intensity === 1) cls += " l1";
                              else if (c.intensity === 2) cls += " l2";
                              else if (c.intensity === 3) cls += " l3";
                              else if (c.intensity >= 4) cls += " l4";
                              if (c.key === todayKey()) cls += " today";
                              return <button key={c.key} type="button" className={cls} onMouseEnter={() => openHeatmapDay(c.key)} onFocus={() => openHeatmapDay(c.key)} onClick={() => openHeatmapDay(c.key)} title={`${c.key}: ${c.count} session${c.count === 1 ? "" : "s"} · ${(c.minutes / 60).toFixed(1)}h studied`}><i>{c.day}</i></button>;
                            })}
                          </div>
                          <div className="tt-heatmapLegend">
                            Less <span className="tt-hcell" /> <span className="tt-hcell l1" /> <span className="tt-hcell l2" /> <span className="tt-hcell l3" /> <span className="tt-hcell l4" /> More <span className="tt-heatmapMetric">Intensity: best monthly sessions + hours (12h full-glow floor)</span>
                          </div>
                        </div>

                        <div className="tt-monthCompare">
                          <div className="tt-mcTitle">vs last month</div>
                          {([
                            ["Sessions", monthView.cur.sessions, monthView.prev.sessions, (v: number) => String(v)],
                            ["Hours", monthView.cur.minutes / 60, monthView.prev.minutes / 60, (v: number) => v.toFixed(1) + "h"],
                            ["Active days", monthView.cur.activeDays, monthView.prev.activeDays, (v: number) => String(v)],
                          ] as [string, number, number, (v: number) => string][]).map(([label, cur, prev, fmt]) => {
                            const delta = cur - prev;
                            const dir = delta > 0.05 ? "up" : delta < -0.05 ? "down" : "flat";
                            return (
                              <div className="tt-mcRow" key={label}>
                                <span className="tt-mcLabel">{label}</span>
                                <span className="tt-mcVal">{fmt(cur)}</span>
                                <span className={`tt-mcDelta ${dir}`}>
                                  {dir === "up" ? "▲" : dir === "down" ? "▼" : "—"} {fmt(Math.abs(delta))}
                                </span>
                              </div>
                            );
                          })}
                          <div className="tt-mcRow">
                            <span className="tt-mcLabel">Best day</span>
                            <span className="tt-mcVal">{monthView.cur.best.count ? monthView.cur.best.key.slice(8) : "—"}</span>
                            <span className="tt-mcDelta flat">{monthView.cur.best.count || 0}×</span>
                          </div>
                          <div className="tt-mcRow">
                            <span className="tt-mcLabel">Streak</span>
                            <span className="tt-mcVal">{streak}d</span>
                            <span className="tt-mcDelta flat">now</span>
                          </div>

                          <div className="tt-spark">
                            {monthView.spark.map((s, i) => (
                              <div className="tt-sparkCol" key={i} title={`${s.sessions} sessions · ${s.hours.toFixed(1)}h`}>
                                <div className="tt-sparkBar" style={{ height: `${Math.max(6, (s.hours / monthView.sparkMax) * 100)}%` }} />
                                <span>{s.label}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="tt-card" style={{ flex: "0 0 auto" }}>
                    <h3>TODAY&apos;S CHECKLIST</h3>
                    <div className="tt-checklist">
                      {CHECKLIST_ITEMS.map((it) => (
                        <label key={it}><input type="checkbox" checked={!!checklist[it]} onChange={(e) => toggleCheck(it, e.target.checked)} />{it}</label>
                      ))}
                    </div>
                  </div>
                  <div className="tt-rememberBox">REMEMBER<br />CONSISTENCY + DISCIPLINE + PATIENCE<br />=<br />🏆 SUCCESS</div>
                </div>
              </div>
            </div>
          </div>
          <div className="tt-footerQuote">FOCUS ON YOUR GOAL. DON&apos;T LOOK IN ANY DIRECTION BUT AHEAD. &nbsp;|&nbsp; YOUR HARD WORK WILL DEFINITELY PAY OFF. ★ ★ ★</div>
        </div>
      </div>

      {heatmapDay && (
        <div className="tt-glassOverlay" onClick={() => setHeatmapDay(null)}>
          <div className="tt-glassBox tt-heatmapDetails" onClick={(event) => event.stopPropagation()}>
            <div className="tt-glassHead">
              <div className="tt-glassIcon">📅</div>
              <div><div className="tt-glassEyebrow">Study history</div><div className="tt-glassTitle">{heatmapDay.date}</div></div>
              <button className="tt-glassClose" onClick={() => setHeatmapDay(null)} aria-label="Close">×</button>
            </div>
            {heatmapDay.loading ? <div className="tt-glassHint">Loading completed sessions…</div> : (heatmapDay.logs.length || heatmapDay.extensions.length) ? (
              <div className="tt-heatmapDetailList">
                {heatmapDay.logs.map((log) => {
                  const row = ROWS.find((item) => item.id === log.rowId);
                  const extensionsForSession = heatmapDay.extensions.filter((entry) => entry.rowId === log.rowId);
                  const extensionMinutes = extensionsForSession.reduce((total, entry) => total + entry.minutes, 0);
                  return <div key={`${log.rowId}-${log.ts}`} className="tt-heatmapDetailItem"><span>{row?.icon || "📚"} {row?.act || "Study session"}{extensionMinutes > 0 && <em>Extended +{extensionMinutes}m</em>}</span><b>{log.durMin}m</b></div>;
                })}
                {heatmapDay.extensions.map((entry) => (
                  <div key={`ext-${entry.rowId}-${entry.ts}`} className="tt-heatmapDetailItem tt-heatmapExtension"><span>⏱️ {entry.activity}<em>{entry.deductedFrom ? `+${entry.minutes}m, traded from ${entry.deductedFrom}` : `+${entry.minutes}m, day extended`}{entry.reopened ? " · reopened" : ""}{entry.comment ? ` · ${entry.comment}` : ""}</em></span><b>+{entry.minutes}m</b></div>
                ))}
              </div>
            ) : <div className="tt-glassHint">No detailed session log is available for this older date. Its heatmap total is shown above.</div>}
          </div>
        </div>
      )}

      {/* SUNDAY PLANNER — build the whole day yourself */}
      {sundayModal && (
        <div className="tt-glassOverlay" onClick={() => { setSundayModal(false); setSundayDismissed(true); }}>
          <div className="tt-glassBox tt-sundayBox" onClick={(e) => e.stopPropagation()}>
            <div className="tt-glassHead">
              <div className="tt-glassIcon">🗓</div>
              <div>
                <div className="tt-glassEyebrow">Sunday Mission Plan</div>
                <div className="tt-glassTitle">What are you studying today?</div>
              </div>
              <button className="tt-glassClose" onClick={() => { setSundayModal(false); setSundayDismissed(true); }} aria-label="Close">×</button>
            </div>

            <div className="tt-glassSection">
              <div className="tt-glassLabel">Add a subject block</div>
              <div className="tt-sundayForm">
                <select className="tt-glassSelect" value={sdSubject} onChange={(e) => setSdSubject(e.target.value)}>
                  {SUBJECT_PRESETS.map((p) => (
                    <option key={p.act} value={p.act}>{p.icon} {p.act}</option>
                  ))}
                </select>
                <input className="tt-glassSelect" type="text" value={sdCustom} onChange={(e) => setSdCustom(e.target.value)} placeholder="…or type a custom subject" maxLength={60} />
                <div className="tt-sundayRowInputs">
                  <label>Start<input className="tt-glassSelect" type="time" value={sdStart} onChange={(e) => setSdStart(e.target.value)} /></label>
                  <label>Minutes<input className="tt-glassSelect" type="number" min={5} step={5} value={sdDur} onChange={(e) => setSdDur(Number(e.target.value))} /></label>
                  <button className="tt-glassBtn primary" onClick={addSundayEntry}>+ Add</button>
                </div>
              </div>
            </div>

            <div className="tt-glassSection">
              <div className="tt-glassLabel">Today&apos;s blocks ({sundayDraft.length})</div>
              {sundayDraft.length === 0 ? (
                <div className="tt-glassHint">Nothing added yet — pick a subject, a start time and a duration.</div>
              ) : (
                <div className="tt-sundayList">
                  {[...sundayDraft].sort((a, b) => a.startMin - b.startMin).map((e, i) => (
                    <div className="tt-sundayItem" key={`${e.subject}-${e.startMin}-${i}`}>
                      <span className="tt-sundayItemIcon">{e.icon}</span>
                      <span className="tt-sundayItemName">{e.subject}</span>
                      <span className="tt-sundayItemTime">{minsToClock(e.startMin)} – {minsToClock(e.startMin + e.dur)} · {e.dur}m</span>
                      <button onClick={() => setSundayDraft((d) => d.filter((x) => x !== e))} aria-label="Remove">×</button>
                    </div>
                  ))}
                </div>
              )}
              {sundayOverlaps(sundayDraft) && (
                <div className="tt-sundayWarn">⚠ Some blocks overlap. You can still save, but the timings will clash.</div>
              )}
              <div className="tt-glassHint">
                Total planned: {(sundayDraft.reduce((a, b) => a + b.dur, 0) / 60).toFixed(1)}h
              </div>
            </div>

            <div className="tt-glassActions">
              <button className="tt-glassBtn ghost" onClick={() => { setSundayModal(false); setSundayDismissed(true); }}>Later</button>
              <button className="tt-glassBtn primary" disabled={sundayDraft.length === 0} onClick={saveSundayPlan}>
                Lock in Sunday
              </button>
            </div>
          </div>
        </div>
      )}


      {/* START TOPIC PROMPT — asks what you're focusing on before the timer begins */}
      {startPrompt && (() => {
        const row = activeRows.find(r => r.id === startPrompt.id);
        return (
          <div className="tt-glassOverlay" onClick={() => setStartPrompt(null)}>
            <div className="tt-glassBox" onClick={(e) => e.stopPropagation()}>
              <div className="tt-glassHead">
                <div className="tt-glassIcon">{row?.icon || "▶"}</div>
                <div>
                  <div className="tt-glassEyebrow">Starting Session</div>
                  <div className="tt-glassTitle">{row?.act}</div>
                </div>
                <button className="tt-glassClose" onClick={() => setStartPrompt(null)} aria-label="Close">×</button>
              </div>

              <div className="tt-glassSection">
                <div className="tt-glassLabel">What are you focusing on? <span className="tt-glassOptional">(optional)</span></div>
                <textarea
                  className="tt-glassTextarea"
                  value={topicInput}
                  onChange={(e) => setTopicInput(e.target.value)}
                  placeholder="e.g. Relay coordination + overcurrent protection numericals"
                  rows={2}
                  maxLength={150}
                  autoFocus
                />
                <div className="tt-glassHint">Shows up on the live timer and in your daily email.</div>
              </div>

              <div className="tt-glassActions">
                <button className="tt-glassBtn ghost" onClick={() => { setStartPrompt(null); startSession(startPrompt.id); }}>Skip</button>
                <button className="tt-glassBtn primary" onClick={() => { const id = startPrompt.id; const topic = topicInput; setStartPrompt(null); startSession(id, topic); }}>
                  ▶ Start Session
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* EXTENSION MODAL — glass-morphism */}
      {extendModal && (() => {
        const row = activeRows.find(r => r.id === extendModal.id);
        const trades = activeRows.filter(r => isFocusRow(r) && r.id !== extendModal.id && sessions[r.id]?.status !== "completed" && sessions[r.id]?.remaining >= extendMins * 60);
        return (
          <div className="tt-glassOverlay" onClick={() => setExtendModal(null)}>
            <div className="tt-glassBox" onClick={(e) => e.stopPropagation()}>
              <div className="tt-glassHead">
                <div className="tt-glassIcon">{row?.icon || "⏱"}</div>
                <div>
                  <div className="tt-glassEyebrow">Extend Session</div>
                  <div className="tt-glassTitle">{row?.act}</div>
                </div>
                <button className="tt-glassClose" onClick={() => setExtendModal(null)} aria-label="Close">×</button>
              </div>

              <div className="tt-glassSection">
                <div className="tt-glassLabel">Add extra minutes</div>
                <div className="tt-glassChips">
                  {[15, 30, 45, 60].map(m => (
                    <button key={m} className={`tt-glassChip ${extendMins === m ? "active" : ""}`} onClick={() => setExtendMins(m)}>+{m}m</button>
                  ))}
                </div>
                <div className="tt-glassStepper">
                  <button onClick={() => setExtendMins(Math.max(1, extendMins - 5))} aria-label="Decrease">−</button>
                  <div className="tt-glassStepperValue"><span>{extendMins}</span><small>min</small></div>
                  <button onClick={() => setExtendMins(extendMins + 5)} aria-label="Increase">+</button>
                </div>
              </div>

              <div className="tt-glassSection">
                <div className="tt-glassLabel">Trade time from another session <span className="tt-glassOptional">(optional)</span></div>
                <select className="tt-glassSelect" value={deductId} onChange={(e) => setDeductId(e.target.value === "none" ? "none" : Number(e.target.value))}>
                  <option value="none">— Add on top (no trade) —</option>
                  {trades.map(r => (
                    <option key={r.id} value={r.id}>{r.icon} {r.act} ({Math.floor(sessions[r.id].remaining / 60)}m available)</option>
                  ))}
                </select>
                <div className="tt-glassHint">
                  {deductId === 'none'
                    ? "This will push your schedule forward by " + extendMins + " min."
                    : "Time will be traded silently — logged for the mission report."}
                </div>
              </div>

              <div className="tt-glassSection">
                <div className="tt-glassLabel">Comment <span className="tt-glassOptional">(optional, shows in your daily email)</span></div>
                <textarea
                  className="tt-glassTextarea"
                  value={extendComment}
                  onChange={(e) => setExtendComment(e.target.value)}
                  placeholder="e.g. Got stuck on relay coordination numericals"
                  rows={2}
                  maxLength={200}
                />
              </div>

              <div className="tt-glassActions">
                <button className="tt-glassBtn ghost" onClick={() => setExtendModal(null)}>Cancel</button>
                <button className="tt-glassBtn primary" onClick={() => { extendSession(extendModal.id, extendMins, deductId, extendComment); setExtendModal(null); setDeductId('none'); setExtendComment(''); }}>
                  Confirm +{extendMins}m
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* TIMER LOGIC */}
      {(() => {
        const active = runningRow || activeRows.find((r) => isFocusRow(r) && sessions[r.id]?.status === "paused" && sessions[r.id]?.remaining < r.dur * 60);
        if (!active) return null;

        const st = sessions[active.id];
        const done = st.remaining <= 0;
        const critical = st.status === "running" && st.remaining <= 10 && st.remaining > 0;
        const canExtend = st.status === "completed" || st.remaining <= 600;

        if (timerMinimized) {
          return (
            <div className="tt-timerMini" onClick={() => setTimerMinimized(false)} title="Click to open full timer">
              <span className="tt-tmIcon">{active.icon}</span>
              <span className="tt-tmSubj">{active.act}</span>
              <div className="tt-tmBigSolid">
                {fmtTime(st.remaining)}
              </div>
            </div>
          );
        }

        const activeAllocSec = (st.durationAllocated ?? active.dur) * 60;
        const activePct = activeAllocSec > 0
          ? Math.min(1, Math.max(0, (activeAllocSec - Math.max(0, st.remaining)) / activeAllocSec))
          : 0;
        const ringCirc = 2 * Math.PI * 54;

        return (
          <div className="tt-timerOverlay">
            <div className={`tt-timerModal ${done ? "done" : ""} ${critical ? "warn" : ""}`}>
              <button className="tt-tmMinimizeBtn" onClick={() => setTimerMinimized(true)} title="Minimize" aria-label="Minimize">
                ⌄
              </button>

              <div className="tt-tmHead">
                <span className="tt-tmIcon">{active.icon}</span>
                <span className="tt-tmTitle">{active.act}</span>
                <span className={`tt-statusPill tt-st-${st.status}`}>
                  {st.status === "notstarted" ? "NOT STARTED" : st.status.toUpperCase()}
                </span>
              </div>
              {sessionTopics[active.id] && (
                <div className="tt-tmTopic">📌 {sessionTopics[active.id]}</div>
              )}

              <div className="tt-tmRingRow">
                {(() => {
                  const keys: ExamKey[] = active.cat === "technical" ? ["gate", "ese"] : (active.cat === "aptitude" || active.cat === "gs") ? ["ssc"] : [];
                  const badge = (key: ExamKey, side: "L" | "R") => {
                    const e = examDates[key];
                    const c = mounted ? countdownParts(e.date) : { d: 0, h: 0, m: 0, s: 0 };
                    return (
                      <div className={`tt-tmMission ${key} ${side === "L" ? "left" : "right"}`} key={key}>
                        <div className="tt-tmMissionTag">MISSION</div>
                        <div className="tt-tmMissionName">{e.label}</div>
                        <div className="tt-tmMissionDays">{mounted ? c.d : "--"}<span>d</span></div>
                        <div className="tt-tmMissionSub">{mounted ? `${String(c.h).padStart(2, "0")}h ${String(c.m).padStart(2, "0")}m` : "--"}</div>
                      </div>
                    );
                  };
                  return (
                    <>
                      <div className="tt-tmMissionCol">{keys[0] ? badge(keys[0], "L") : null}</div>
                      <div className="tt-tmRingWrap">
                        <svg className="tt-tmRingSvg" viewBox="0 0 120 120">
                          <circle className="tt-tmRingTrack" cx="60" cy="60" r="54" />
                          <circle
                            className="tt-tmRingFill"
                            cx="60" cy="60" r="54"
                            style={{ strokeDasharray: ringCirc, strokeDashoffset: ringCirc * (1 - activePct) }}
                          />
                        </svg>
                        <TimerRingMagic pct={activePct} tone={done ? "done" : critical ? "warn" : "run"} />
                        <div className="tt-tmBig">{fmtTime(st.remaining)}</div>
                      </div>
                      <div className="tt-tmMissionCol">{keys[1] ? badge(keys[1], "R") : keys[0] && keys.length === 1 ? null : null}</div>
                    </>
                  );
                })()}
              </div>


              <div className="tt-tmHint">
                {done ? "✅ Time complete — you may Complete or Extend." : "Complete and Extension unlock in the final 10 minutes."}
              </div>
              <div className="tt-tmBtns">
                {st.status === "running" ? (
                  <button className="tt-b-pause" onClick={() => pauseSession(active.id)}>⏸ Pause</button>
                ) : (
                  <button className="tt-b-start" onClick={() => startSession(active.id)}>▶ Resume</button>
                )}
                <button className="tt-b-ext" disabled={!canExtend} onClick={() => { setDeductId('none'); setExtendComment(''); setExtendModal({ id: active.id }); }}>➕ Extend</button>
                <button className="tt-b-done" disabled={st.remaining > 10 * 60} onClick={() => completeSession(active.id)}>✓ Complete</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* CSS */}
      <style>{`
        .tt-modalOverlay { position: fixed; inset: 0; background: rgba(0,0,0,0.75); z-index: 9999; display: flex; justify-content: center; align-items: center; padding: 15px; }
        .tt-modalBox { background: white; width: 100%; max-width: 420px; border-radius: 16px; padding: 24px; box-shadow: 0 10px 25px rgba(0,0,0,0.2); }
        .tt-modalBox h3 { margin-top: 0; color: #1f2870; font-size: 20px; font-weight: 800; margin-bottom: 16px; }
        .tt-modalBox label { display: block; font-weight: 600; font-size: 14px; margin-bottom: 8px; color: #4b5563; }
        .tt-modalBox select, .tt-modalBox input { width: 100%; padding: 10px; border: 2px solid #e5e7eb; border-radius: 8px; font-size: 16px; outline: none; }
        .tt-modalBox select:focus, .tt-modalBox input:focus { border-color: #1f2870; }
        .tt-extBtnGroup { display: flex; gap: 8px; margin-bottom: 12px; }
        .tt-extBtnGroup button { flex: 1; padding: 8px 0; font-size: 14px; font-weight: 600; background: #f3f4f6; color: #4b5563; border: 2px solid transparent; border-radius: 8px; cursor: pointer; transition: 0.2s; }
        .tt-extBtnGroup button.active { background: #e0e7ff; color: #1f2870; border-color: #1f2870; }
        .tt-modalActions { display: flex; gap: 12px; margin-top: 24px; justify-content: flex-end; }
        .tt-modalActions button { padding: 10px 20px; border-radius: 8px; font-weight: bold; font-size: 14px; border: none; cursor: pointer; }

        .tt-timerMini { position: fixed; top: 15px; left: 50%; transform: translateX(-50%); background: #1f2870; color: white; padding: 10px 30px; border-radius: 50px; display: flex; align-items: center; gap: 15px; box-shadow: 0 8px 20px rgba(0,0,0,0.3); z-index: 9998; cursor: pointer; border: 2px solid #f0b429; transition: transform 0.2s; }
        .tt-timerMini:active { transform: translateX(-50%) scale(0.95); }
        .tt-timerMini .tt-tmIcon { font-size: 20px; }
        .tt-timerMini .tt-tmSubj { font-size: 16px; font-weight: 600; color: #fcd34d; max-width: 250px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .tt-tmBigSolid { background: #ea580c; color: #ffffff; padding: 6px 14px; border-radius: 8px; font-size: 22px; font-weight: 900; font-family: monospace; letter-spacing: 1px; box-shadow: inset 0 2px 4px rgba(0,0,0,0.2); margin-left: 10px; }
        .tt-tmCloseBtn { background: #e5e7eb; color: #4b5563; border: none; padding: 6px 12px; border-radius: 12px; font-size: 13px; font-weight: bold; cursor: pointer; transition: background 0.2s; }
        .tt-tmCloseBtn:hover { background: #d1d5db; color: #111; }
        .tt-tmHead { display: flex; justify-content: space-between; align-items: center; gap: 10px; width: 100%; }
        .tt-tmHead > div { display: flex; align-items: center; gap: 10px; }

        /* ===== TIMER — CENTERED iOS-STYLE GLASS MODAL ===== */
        .tt-timerOverlay {
          position: fixed !important; inset: 0 !important; z-index: 9997;
          display: flex !important; justify-content: center !important; align-items: center !important; padding: 16px;
          background: radial-gradient(ellipse at center, rgba(21,27,77,0.5), rgba(0,0,0,0.7));
          backdrop-filter: blur(12px) saturate(140%);
          animation: ttFadeIn .2s ease-out;
          pointer-events: none;
        }
        .tt-timerModal {
          position: relative !important; top: auto !important; left: auto !important; right: auto !important; bottom: auto !important;
          transform: none !important; margin: 0 !important;
          pointer-events: auto;
          width: 100%; max-width: 520px;
          background: linear-gradient(160deg, rgba(255,255,255,0.85), rgba(255,255,255,0.6));
          backdrop-filter: blur(28px) saturate(180%);
          border: 1px solid rgba(255,255,255,0.6);
          border-radius: 28px;
          padding: 30px 26px 22px;
          box-shadow: 0 30px 70px rgba(15,20,50,0.4), inset 0 1px 0 rgba(255,255,255,0.7);
          color: #1b1e2b; text-align: center;
          animation: ttGlassIn .3s cubic-bezier(.2,.9,.3,1.2), ttModalBreathe 4s ease-in-out infinite;
        }
        @keyframes ttModalBreathe {
          0%, 100% { box-shadow: 0 30px 70px rgba(15,20,50,0.4), inset 0 1px 0 rgba(255,255,255,0.7); }
          50% { box-shadow: 0 30px 80px rgba(43,111,214,0.22), inset 0 1px 0 rgba(255,255,255,0.7); }
        }
        .tt-timerModal.warn { border-color: rgba(234,88,12,0.5); }
        .tt-timerModal.done { border-color: rgba(34,197,94,0.5); }

        .tt-tmMinimizeBtn {
          position: absolute; top: 14px; right: 14px;
          width: 28px; height: 28px; border-radius: 50%;
          background: rgba(21,27,77,0.08); color: #4b5563; border: none;
          font-size: 16px; font-weight: 800; cursor: pointer; line-height: 1;
          display: flex; align-items: center; justify-content: center;
          transition: background .15s, transform .15s;
        }
        .tt-tmMinimizeBtn:hover { background: rgba(21,27,77,0.16); transform: scale(1.08); }

        .tt-tmHead { display: flex; align-items: center; justify-content: center; gap: 8px; flex-wrap: wrap; margin-bottom: 6px; padding-right: 30px; }
        .tt-timerModal .tt-tmIcon { font-size: 20px; animation: ttIconPulse 1.8s ease-in-out infinite; }
        .tt-timerModal .tt-tmTitle { font-family: var(--tt-font-display, inherit); font-size: 15px; font-weight: 800; color: #151b4d; }

        .tt-tmRingRow { display: flex; align-items: center; justify-content: center; gap: 10px; margin: 12px 0 4px; }
        .tt-tmMissionCol { flex: 1 1 0; min-width: 0; display: flex; justify-content: center; }
        .tt-tmMission {
          position: relative; overflow: hidden;
          width: 100%; max-width: 118px; padding: 10px 8px; border-radius: 16px; text-align: center;
          background: linear-gradient(160deg, rgba(255,255,255,0.78), rgba(255,255,255,0.45));
          border: 1px solid rgba(255,255,255,0.7);
          box-shadow: 0 10px 24px rgba(15,20,50,0.12), inset 0 1px 0 rgba(255,255,255,0.8);
          animation:
            ttMissionIn .6s cubic-bezier(.2,.9,.3,1.25) both,
            ttMissionFloat 4.2s ease-in-out 0.6s infinite,
            ttMissionGlow 3.4s ease-in-out 0.6s infinite;
        }
        .tt-tmMission.left { animation-delay: 0s, .6s, .6s; transform-origin: right center; }
        .tt-tmMission.right { animation-delay: .12s, .9s, .9s; transform-origin: left center; }
        .tt-tmMission::after {
          content: ""; position: absolute; top: -60%; left: -140%; width: 60%; height: 220%;
          background: linear-gradient(100deg, transparent, rgba(255,255,255,0.85), transparent);
          transform: rotate(18deg); animation: ttMissionSheen 5s ease-in-out 1s infinite; pointer-events: none;
        }
        @keyframes ttMissionIn {
          0% { opacity: 0; transform: translateY(14px) scale(.82) rotateY(28deg); filter: blur(6px); }
          60% { opacity: 1; transform: translateY(-3px) scale(1.04) rotateY(-4deg); filter: blur(0); }
          100% { opacity: 1; transform: translateY(0) scale(1) rotateY(0deg); }
        }
        @keyframes ttMissionFloat {
          0%, 100% { translate: 0 0; }
          50% { translate: 0 -5px; }
        }
        @keyframes ttMissionGlow {
          0%, 100% { box-shadow: 0 10px 24px rgba(15,20,50,0.12), inset 0 1px 0 rgba(255,255,255,0.8); }
          50% { box-shadow: 0 14px 30px rgba(43,111,214,0.28), inset 0 1px 0 rgba(255,255,255,0.9); }
        }
        @keyframes ttMissionSheen {
          0%, 65% { left: -140%; }
          100% { left: 160%; }
        }
        .tt-tmMissionTag { font-size: 8px; letter-spacing: 1.4px; font-weight: 800; color: #6b7280; }
        .tt-tmMissionName { font-family: var(--tt-font-display, inherit); font-size: 11px; font-weight: 800; color: #151b4d; line-height: 1.15; margin: 2px 0 4px; }
        .tt-tmMissionDays { font-size: 24px; font-weight: 900; line-height: 1; color: #2b6fd6; animation: ttMissionPulse 2.6s ease-in-out infinite; }
        .tt-tmMissionDays span { font-size: 11px; font-weight: 800; margin-left: 2px; opacity: .75; }
        @keyframes ttMissionPulse {
          0%, 100% { transform: scale(1); text-shadow: none; }
          50% { transform: scale(1.07); text-shadow: 0 0 14px currentColor; }
        }
        .tt-tmMissionSub { font-size: 9px; font-weight: 700; color: #6b7280; margin-top: 3px; letter-spacing: .5px; }
        .tt-tmMission.gate .tt-tmMissionDays { color: #7c3aed; }
        .tt-tmMission.gate { animation-name: ttMissionIn, ttMissionFloat, ttMissionGlowP; }
        @keyframes ttMissionGlowP {
          0%, 100% { box-shadow: 0 10px 24px rgba(15,20,50,0.12), inset 0 1px 0 rgba(255,255,255,0.8); }
          50% { box-shadow: 0 14px 30px rgba(124,58,237,0.28), inset 0 1px 0 rgba(255,255,255,0.9); }
        }
        .tt-tmMission.ese .tt-tmMissionDays { color: #2b6fd6; }
        .tt-tmMission.ssc .tt-tmMissionDays { color: #16a34a; }
        .tt-tmMission.ssc { animation-name: ttMissionIn, ttMissionFloat, ttMissionGlowG; }
        @keyframes ttMissionGlowG {
          0%, 100% { box-shadow: 0 10px 24px rgba(15,20,50,0.12), inset 0 1px 0 rgba(255,255,255,0.8); }
          50% { box-shadow: 0 14px 30px rgba(22,163,74,0.28), inset 0 1px 0 rgba(255,255,255,0.9); }
        }
        @media (prefers-reduced-motion: reduce) {
          .tt-tmMission, .tt-tmMission::after, .tt-tmMissionDays { animation: none !important; }
        }
        .tt-tmRingWrap { position: relative; width: 190px; height: 190px; margin: 0 auto; flex: 0 0 auto; }
        .tt-tmRingSvg { width: 100%; height: 100%; transform: rotate(-90deg); }
        .tt-tmRingTrack { fill: none; stroke: rgba(21,27,77,0.1); stroke-width: 8; }
        .tt-tmRingFill {
          fill: none; stroke: #2b6fd6; stroke-width: 8; stroke-linecap: round;
          transition: stroke-dashoffset 1s linear;
          filter: drop-shadow(0 0 6px rgba(43,111,214,0.6));
        }
        .tt-timerModal.warn .tt-tmRingFill { stroke: #ea580c; filter: drop-shadow(0 0 6px rgba(234,88,12,0.6)); }
        .tt-timerModal.done .tt-tmRingFill { stroke: #16a34a; filter: drop-shadow(0 0 6px rgba(22,163,74,0.6)); }
        .tt-tmRingMagic { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; }
        @media (prefers-reduced-motion: reduce) { .tt-tmRingMagic { display: none; } }
        .tt-timerModal .tt-tmBig {
          position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
          font-family: monospace; font-size: 34px; font-weight: 800; color: #151b4d; letter-spacing: 1px;
        }
        .tt-timerModal.warn .tt-tmBig { color: #ea580c; animation: ttPulseWarn 1s ease-in-out infinite; }
        .tt-timerModal.done .tt-tmBig { color: #16a34a; }
        @keyframes ttPulseWarn { 0%, 100% { opacity: 1; } 50% { opacity: 0.55; } }
        .tt-timerModal .tt-tmHint { font-size: 12px; color: #6b7280; margin: 10px 0 18px 0; }
        .tt-timerModal .tt-tmBtns { display: flex; gap: 8px; justify-content: center; }
        .tt-timerModal .tt-tmBtns button {
          flex: 1; padding: 11px 10px; border-radius: 12px; border: none; font-weight: 700; font-size: 13px; cursor: pointer;
          transition: transform .15s;
        }
        .tt-timerModal .tt-tmBtns button:hover:not(:disabled) { transform: translateY(-1px); }
        .tt-timerModal .tt-tmBtns button:disabled { opacity: 0.4; cursor: not-allowed; }
        .tt-timerModal .tt-b-start { background: linear-gradient(145deg,#22c55e,#16a34a); color: #fff; }
        .tt-timerModal .tt-b-pause { background: linear-gradient(145deg,#f2c14e,#e8a92e); color: #151b4d; }
        .tt-timerModal .tt-b-ext { background: rgba(21,27,77,0.08); color: #151b4d; }
        .tt-timerModal .tt-b-done { background: linear-gradient(145deg,#151b4d,#1f2870); color: #f2c14e; }

        /* ===== RUNNING ROW — MAGICAL LIVE ANIMATION (full-row fill) ===== */
        .tt-rowRUN {
          position: relative; overflow: hidden;
          background: linear-gradient(90deg,
            rgba(59,130,246,0.30) 0%, rgba(59,130,246,0.30) var(--pct, 0%),
            rgba(255,255,255,0.28) var(--pct, 0%), rgba(255,255,255,0.28) 100%);
          transition: background 1s linear;
          animation: ttRowHalo 3s ease-in-out infinite;
        }
        /* Shine sweep — a soft diagonal light pass drifting across the row */
        .tt-rowRUN::before {
          content: "";
          position: absolute; inset: 0;
          background:
            linear-gradient(100deg, transparent 40%, rgba(255,255,255,0.55) 50%, transparent 60%),
            radial-gradient(2px 2px at 12% 40%, rgba(242,193,78,.9), transparent 60%),
            radial-gradient(2px 2px at 38% 70%, rgba(255,255,255,.85), transparent 60%),
            radial-gradient(2px 2px at 66% 30%, rgba(242,193,78,.8), transparent 60%),
            radial-gradient(2px 2px at 88% 62%, rgba(255,255,255,.75), transparent 60%);
          background-size: 250% 100%, auto, auto, auto, auto;
          animation: ttShineSweep 4.2s cubic-bezier(.45,0,.25,1) infinite,
                     ttRowSparkle 3.4s ease-in-out infinite;
          pointer-events: none;
          will-change: background-position, opacity;
        }
        /* Glowing wavefront — a bright vertical edge marking exactly how far
           you've studied into this session, like a liquid fill line */
        .tt-rowRUN::after {
          content: "";
          position: absolute; top: 0; bottom: 0; left: var(--pct, 0%);
          width: 3px; transform: translateX(-50%);
          background: linear-gradient(180deg, #1d4ed8, #7cc0ff, #f2c14e);
          box-shadow: 0 0 12px 3px rgba(59,130,246,0.75);
          transition: left 1.1s cubic-bezier(.4,0,.2,1);
          animation: ttWavefront 2.4s ease-in-out infinite;
          pointer-events: none;
        }
        .tt-rowRUN .tt-rowIcon {
          display: inline-block; animation: ttIconPulse 2.4s cubic-bezier(.45,0,.35,1) infinite;
          filter: drop-shadow(0 0 7px rgba(43,111,214,0.65));
        }
        .tt-rowRUN td { position: relative; z-index: 1; } /* keep text above the fill/shine layers */
        @keyframes ttShineSweep { 0% { background-position: 180% 0; } 100% { background-position: -80% 0; } }
        @keyframes ttRowSparkle { 0%,100% { opacity: .55 } 50% { opacity: 1 } }
        @keyframes ttWavefront { 0%,100% { box-shadow: 0 0 10px 2px rgba(59,130,246,.6) } 50% { box-shadow: 0 0 18px 5px rgba(124,192,255,.85) } }
        @keyframes ttRowHalo {
          0%, 100% { box-shadow: inset 0 0 0px rgba(59,130,246,0); }
          50% { box-shadow: inset 0 0 22px rgba(59,130,246,0.18); }
        }
        @keyframes ttIconPulse { 0%, 100% { transform: scale(1) rotate(0deg); } 50% { transform: scale(1.18) rotate(-4deg); } }


        /* ===== COMPLETED ROW — one-shot celebration pop ===== */
        .tt-rowDONE { animation: ttDonePop 0.7s ease-out; }
        @keyframes ttDonePop {
          0% { transform: scale(0.98); box-shadow: 0 0 0 rgba(34,197,94,0); }
          45% { transform: scale(1.008); box-shadow: 0 0 26px rgba(34,197,94,0.55); }
          100% { transform: scale(1); box-shadow: 0 0 0 rgba(34,197,94,0); }
        }

        /* Topic note shown once you tell the app what you're focusing on */
        .tt-rowTopic {
          font-size: 11px; color: #1d4ed8; font-weight: 600; margin-top: 2px;
          opacity: 0.9;
        }
        .tt-tmTopic {
          font-size: 12px; color: #1d4ed8; font-weight: 600; margin: -6px 0 14px 0;
          background: rgba(59,130,246,0.1); border-radius: 8px; padding: 6px 10px;
        }

        /* ===== GLASS ACTION BUTTONS / PILLS / PENDING CHIPS ===== */
        .tt-actBtns button {
          backdrop-filter: blur(8px) saturate(160%);
          border-radius: 10px !important;
          box-shadow: 0 2px 8px rgba(21,27,77,0.12);
          transition: transform .15s, box-shadow .15s, filter .15s;
          border: 1px solid rgba(255,255,255,0.4) !important;
        }
        .tt-actBtns button:not(:disabled):hover {
          transform: translateY(-2px) scale(1.05);
          filter: brightness(1.08);
          box-shadow: 0 6px 16px rgba(21,27,77,0.22);
        }
        .tt-actBtns button:disabled { opacity: 0.35 !important; filter: grayscale(0.4); }
        .tt-actBtns .tt-b-start { background: linear-gradient(145deg, rgba(34,197,94,0.9), rgba(22,163,74,0.9)) !important; color: #fff !important; }
        .tt-actBtns .tt-b-pause { background: linear-gradient(145deg, rgba(242,193,78,0.9), rgba(232,169,46,0.9)) !important; color: #151b4d !important; }
        .tt-actBtns .tt-b-ext { background: linear-gradient(145deg, rgba(139,92,246,0.85), rgba(109,40,217,0.85)) !important; color: #fff !important; }
        .tt-actBtns .tt-b-done { background: linear-gradient(145deg, rgba(21,27,77,0.92), rgba(31,40,112,0.92)) !important; color: #f2c14e !important; }
        .tt-statusPill {
          backdrop-filter: blur(6px) saturate(150%);
          border-radius: 20px !important;
          letter-spacing: .4px;
          box-shadow: 0 2px 8px rgba(21,27,77,0.08);
        }
        .tt-pendingItem {
          background: rgba(255,255,255,0.5) !important;
          backdrop-filter: blur(10px) saturate(140%);
          border: 1px solid rgba(21,27,77,0.1) !important;
          border-radius: 14px !important;
          box-shadow: 0 3px 10px rgba(21,27,77,0.06);
        }
        .tt-pendingItem button {
          border-radius: 10px !important;
        }

        /* ===== GLASS EXTENSION MODAL ===== */
        @keyframes ttGlassIn { from { opacity: 0; transform: translateY(14px) scale(.96); } to { opacity: 1; transform: translateY(0) scale(1); } }
        @keyframes ttFadeIn { from { opacity: 0; } to { opacity: 1; } }
        .tt-glassOverlay {
          position: fixed; inset: 0; z-index: 9999;
          display: flex; justify-content: center; align-items: center; padding: 16px;
          background: radial-gradient(ellipse at center, rgba(21,27,77,0.55), rgba(0,0,0,0.75));
          backdrop-filter: blur(14px) saturate(140%);
          animation: ttFadeIn .2s ease-out;
        }
        .tt-glassBox {
          width: 100%; max-width: 440px;
          background: linear-gradient(160deg, rgba(255,255,255,0.85), rgba(255,255,255,0.65));
          backdrop-filter: blur(24px) saturate(160%);
          border: 1px solid rgba(255,255,255,0.6);
          border-radius: 22px;
          padding: 22px 24px 20px;
          box-shadow: 0 24px 60px rgba(15,20,50,0.35), inset 0 1px 0 rgba(255,255,255,0.7);
          color: #1b1e2b; font-family: var(--tt-font-body);
          animation: ttGlassIn .28s cubic-bezier(.2,.9,.3,1.2);
        }
        .tt-glassHead { display: flex; align-items: center; gap: 12px; margin-bottom: 18px; }
        .tt-glassIcon {
          width: 44px; height: 44px; border-radius: 14px; flex: 0 0 auto;
          display: flex; align-items: center; justify-content: center; font-size: 22px;
          background: linear-gradient(145deg, #f2c14e, #e8862e);
          box-shadow: 0 6px 14px rgba(232,134,46,0.35), inset 0 1px 0 rgba(255,255,255,0.6);
        }
        .tt-glassEyebrow { font-size: 10px; font-weight: 800; letter-spacing: 1.2px; color: #6b7280; text-transform: uppercase; }
        .tt-glassTitle { font-family: var(--tt-font-display); font-size: 18px; font-weight: 800; color: #151b4d; line-height: 1.15; max-width: 280px; }
        .tt-glassClose {
          margin-left: auto; width: 32px; height: 32px; border-radius: 50%;
          border: 1px solid rgba(21,27,77,0.15); background: rgba(255,255,255,0.6);
          font-size: 20px; line-height: 1; color: #4b5563; cursor: pointer;
          transition: transform .15s, background .15s;
        }
        .tt-glassClose:hover { background: #fff; transform: rotate(90deg); }

        .tt-glassSection { margin-bottom: 16px; }
        .tt-glassLabel { font-size: 12px; font-weight: 700; color: #374151; text-transform: uppercase; letter-spacing: .5px; margin-bottom: 10px; }
        .tt-glassOptional { color: #9ca3af; font-weight: 500; text-transform: none; letter-spacing: 0; }

        .tt-glassChips { display: flex; gap: 8px; margin-bottom: 10px; }
        .tt-glassChip {
          flex: 1; padding: 9px 0; font-size: 13px; font-weight: 700;
          background: rgba(255,255,255,0.55); color: #4b5563;
          border: 1px solid rgba(21,27,77,0.12); border-radius: 12px;
          cursor: pointer; transition: all .18s;
        }
        .tt-glassChip:hover { background: #fff; transform: translateY(-1px); }
        .tt-glassChip.active {
          background: linear-gradient(145deg, #151b4d, #1f2870);
          color: #f2c14e; border-color: #151b4d;
          box-shadow: 0 6px 14px rgba(21,27,77,0.35);
        }

        .tt-glassStepper {
          display: flex; align-items: center; justify-content: space-between;
          background: rgba(255,255,255,0.55); border: 1px solid rgba(21,27,77,0.12);
          border-radius: 14px; padding: 4px;
        }
        .tt-glassStepper button {
          width: 40px; height: 40px; border-radius: 10px; border: none;
          background: transparent; font-size: 22px; font-weight: 700; color: #151b4d;
          cursor: pointer; transition: background .15s;
        }
        .tt-glassStepper button:hover { background: rgba(21,27,77,0.08); }
        .tt-glassStepperValue { display: flex; align-items: baseline; gap: 4px; font-family: var(--tt-font-display); }
        .tt-glassStepperValue span { font-size: 26px; font-weight: 800; color: #151b4d; }
        .tt-glassStepperValue small { font-size: 11px; color: #6b7280; font-weight: 700; }

        .tt-glassSelect {
          width: 100%; padding: 12px 14px;
          background: rgba(255,255,255,0.7); color: #1b1e2b;
          border: 1px solid rgba(21,27,77,0.15); border-radius: 12px;
          font-size: 14px; font-weight: 600; outline: none; cursor: pointer;
          transition: border-color .15s, background .15s;
        }
        .tt-glassSelect:focus { border-color: #151b4d; background: #fff; }
        .tt-glassHint { margin-top: 8px; font-size: 11px; color: #6b7280; font-style: italic; }

        /* Sunday planner */
        .tt-sundayBtn {
          margin-left: 10px; padding: 6px 14px; border-radius: 20px; cursor: pointer;
          border: 1px solid #f0b429; background: linear-gradient(135deg,#fff8df,#fde68a);
          color: #92400e; font-weight: 800; font-size: 13px;
          box-shadow: 0 3px 10px rgba(240,180,41,.28); transition: transform .15s ease, box-shadow .15s ease;
        }
        .tt-sundayBtn:hover { transform: translateY(-1px); box-shadow: 0 6px 16px rgba(240,180,41,.35); }
        .tt-sundayBox { max-width: 560px; }
        .tt-sundayForm { display: flex; flex-direction: column; gap: 8px; }
        .tt-sundayRowInputs { display: flex; gap: 8px; align-items: flex-end; }
        .tt-sundayRowInputs label { display: flex; flex-direction: column; gap: 4px; font-size: 11px; font-weight: 700; color: #4b5563; flex: 1; }
        .tt-sundayList { display: flex; flex-direction: column; gap: 6px; max-height: 190px; overflow-y: auto; }
        .tt-sundayItem {
          display: flex; align-items: center; gap: 8px; padding: 7px 10px; border-radius: 10px;
          background: rgba(255,255,255,.65); border: 1px solid rgba(148,163,184,.35); font-size: 12px;
          animation: ttPopIn .28s cubic-bezier(.2,.9,.3,1.2) both;
        }
        .tt-sundayItemName { font-weight: 800; color: #1f2870; flex: 1; }
        .tt-sundayItemTime { color: #6b7280; font-size: 11px; white-space: nowrap; }
        .tt-sundayItem button {
          border: none; background: rgba(239,68,68,.12); color: #b91c1c; border-radius: 8px;
          width: 22px; height: 22px; cursor: pointer; font-size: 14px; line-height: 1;
        }
        .tt-sundayWarn {
          margin-top: 8px; padding: 7px 10px; border-radius: 10px; font-size: 11.5px; font-weight: 700;
          background: rgba(251,191,36,.18); color: #92400e; border: 1px solid rgba(245,158,11,.4);
        }


        .tt-glassTextarea {
          width: 100%; padding: 10px 12px; box-sizing: border-box;
          background: rgba(255,255,255,0.7); color: #1b1e2b;
          border: 1px solid rgba(21,27,77,0.15); border-radius: 12px;
          font-size: 13px; font-family: inherit; outline: none; resize: vertical;
          transition: border-color .15s, background .15s;
        }
        .tt-glassTextarea:focus { border-color: #151b4d; background: #fff; }

        .tt-glassActions { display: flex; gap: 10px; margin-top: 20px; }
        .tt-glassBtn {
          flex: 1; padding: 12px 16px; border-radius: 12px; border: none;
          font-weight: 800; font-size: 14px; cursor: pointer; transition: all .18s;
          font-family: var(--tt-font-body); letter-spacing: .3px;
        }
        .tt-glassBtn.ghost {
          background: rgba(255,255,255,0.55); color: #4b5563;
          border: 1px solid rgba(21,27,77,0.12);
        }
        .tt-glassBtn.ghost:hover { background: #fff; color: #1b1e2b; }
        .tt-glassBtn.primary {
          background: linear-gradient(145deg, #151b4d, #1f2870);
          color: #f2c14e;
          box-shadow: 0 8px 20px rgba(21,27,77,0.35), inset 0 1px 0 rgba(255,255,255,0.15);
        }
        .tt-glassBtn.primary:hover { transform: translateY(-1px); box-shadow: 0 12px 24px rgba(21,27,77,0.45); }

        /* ===== WHOLE-APP GLASS THEME ===== */
        .tt-quoteBar { animation: ttQuoteFade .5s ease-out; }
        @keyframes ttQuoteFade { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
        .tt-root {
          background: linear-gradient(160deg, #eef1fb 0%, #e6ebfa 35%, #dde5f7 70%, #e9edfb 100%) !important;
          background-attachment: fixed !important;
          min-height: 100vh;
        }
        .tt-header, .tt-card, .tt-pendingBox, .tt-rememberBox, .tt-emailCard {
          background: rgba(255,255,255,0.55) !important;
          backdrop-filter: blur(20px) saturate(160%) !important;
          -webkit-backdrop-filter: blur(20px) saturate(160%) !important;
          border: 1px solid rgba(255,255,255,0.65) !important;
          border-radius: 20px !important;
          box-shadow: 0 14px 34px rgba(31,40,112,0.08), inset 0 1px 0 rgba(255,255,255,0.6) !important;
        }
        .tt-checklist, .tt-heatmapWrap {
          background: rgba(255,255,255,0.35) !important;
          backdrop-filter: blur(10px) saturate(140%) !important;
          border-radius: 14px !important;
          padding: 10px !important;
        }
        .tt-table {
          background: rgba(255,255,255,0.5) !important;
          backdrop-filter: blur(18px) saturate(150%) !important;
          -webkit-backdrop-filter: blur(18px) saturate(150%) !important;
          border: 1px solid rgba(255,255,255,0.55) !important;
          border-radius: 18px !important;
          overflow: hidden;
          border-collapse: separate !important;
        }
        .tt-table thead tr { background: rgba(21,27,77,0.07) !important; }
        .tt-rowLIFE, .tt-rowNS { background: rgba(255,255,255,0.25) !important; }
        .tt-rowPAUSE { background: rgba(254,243,199,0.55) !important; }
        .tt-rowDONE { background: rgba(220,252,231,0.55) !important; }
      `}</style>
    </div>
  );
}
