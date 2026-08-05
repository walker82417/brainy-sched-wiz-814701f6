/* Study-oriented boot animation shown right after sign-in. */
const LINES = [
  "Sharpening pencils…",
  "Stacking today's books…",
  "Loading exam countdowns…",
  "Warming up focus timers…",
  "Mission Control ready.",
];

export default function StudyLoader({ name }: { name?: string | null }) {
  return (
    <div className="sl-root">
      <div className="sl-glow g1" />
      <div className="sl-glow g2" />
      <div className="sl-grid" />

      <div className="sl-stage">
        <div className="sl-lamp" />
        <div className="sl-books">
          <span className="sl-book b1" />
          <span className="sl-book b2" />
          <span className="sl-book b3" />
          <span className="sl-book b4" />
        </div>

        <div className="sl-desk">
          <div className="sl-page">
            <span className="sl-line l1" />
            <span className="sl-line l2" />
            <span className="sl-line l3" />
            <span className="sl-line l4" />
          </div>
          <div className="sl-pencil">✎</div>
        </div>
      </div>

      <h2 className="sl-title">
        {name ? `Welcome back, ${name.split(" ")[0]}` : "Welcome back, Officer"}
      </h2>

      <div className="sl-ticker">
        <div className="sl-tickerTrack">
          {LINES.map((l) => (
            <span key={l} className="sl-tick">{l}</span>
          ))}
        </div>
      </div>

      <div className="sl-bar"><span /></div>

      <style>{`
        .sl-root {
          position: fixed; inset: 0; z-index: 9999;
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          gap: 18px; overflow: hidden; color: #fff;
          font-family: 'Poppins','Segoe UI',Roboto,sans-serif;
          background: radial-gradient(ellipse at top, #1f2870 0%, #10133f 60%, #0a0c2b 100%);
          animation: slFade .45s ease-out both;
        }
        @keyframes slFade { from { opacity: 0 } to { opacity: 1 } }

        .sl-grid {
          position: absolute; inset: 0;
          background-image: linear-gradient(rgba(255,255,255,.04) 1px, transparent 1px),
                            linear-gradient(90deg, rgba(255,255,255,.04) 1px, transparent 1px);
          background-size: 42px 42px;
          mask-image: radial-gradient(ellipse at center, rgba(0,0,0,.9) 0%, transparent 72%);
          animation: slDrift 24s linear infinite;
        }
        @keyframes slDrift { to { background-position: 42px 42px, 42px 42px } }

        .sl-glow { position: absolute; border-radius: 50%; filter: blur(70px); opacity: .32; animation: slFloat 12s ease-in-out infinite; }
        .sl-glow.g1 { width: 340px; height: 340px; background: #f2c14e; top: -70px; left: -50px; }
        .sl-glow.g2 { width: 300px; height: 300px; background: #2b6fd6; bottom: -70px; right: -40px; animation-delay: -5s; }
        @keyframes slFloat { 0%,100% { transform: translate(0,0) scale(1) } 50% { transform: translate(24px,-18px) scale(1.08) } }

        .sl-stage { position: relative; z-index: 2; width: 230px; height: 150px; }

        .sl-lamp {
          position: absolute; top: -6px; left: 50%; width: 190px; height: 120px; transform: translateX(-50%);
          background: conic-gradient(from 250deg at 50% 0%, transparent 0deg, rgba(242,193,78,.28) 28deg, transparent 60deg);
          filter: blur(6px); animation: slLamp 3.2s ease-in-out infinite;
        }
        @keyframes slLamp { 0%,100% { opacity: .55 } 50% { opacity: 1 } }

        .sl-books { position: absolute; left: 8px; bottom: 26px; display: flex; flex-direction: column-reverse; gap: 4px; }
        .sl-book { display: block; height: 10px; border-radius: 3px; opacity: 0; animation: slBook .5s cubic-bezier(.2,.9,.3,1.3) forwards; }
        .sl-book.b1 { width: 74px; background: linear-gradient(90deg,#f2c14e,#e8a92e); animation-delay: .15s }
        .sl-book.b2 { width: 64px; background: linear-gradient(90deg,#3b82f6,#2563eb); animation-delay: .55s }
        .sl-book.b3 { width: 70px; background: linear-gradient(90deg,#22c55e,#16a34a); animation-delay: .95s }
        .sl-book.b4 { width: 58px; background: linear-gradient(90deg,#f472b6,#db2777); animation-delay: 1.35s }
        @keyframes slBook { from { opacity: 0; transform: translateY(-16px) rotate(-6deg) } to { opacity: 1; transform: none } }

        .sl-desk {
          position: absolute; right: 4px; bottom: 18px; width: 116px; height: 82px;
          background: rgba(255,255,255,.07); border: 1px solid rgba(255,255,255,.16);
          border-radius: 10px; backdrop-filter: blur(8px); padding: 12px 12px 0;
          animation: slDesk 4.5s ease-in-out infinite;
        }
        @keyframes slDesk { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-4px) } }
        .sl-page { display: flex; flex-direction: column; gap: 8px; }
        .sl-line { height: 5px; border-radius: 3px; background: rgba(255,255,255,.75); width: 0; animation: slWrite 4s ease-in-out infinite; }
        .sl-line.l1 { animation-delay: .1s } .sl-line.l2 { animation-delay: .9s }
        .sl-line.l3 { animation-delay: 1.7s } .sl-line.l4 { animation-delay: 2.5s }
        @keyframes slWrite { 0% { width: 0; opacity: .3 } 35% { width: 84%; opacity: 1 } 85% { width: 84%; opacity: 1 } 100% { width: 84%; opacity: .25 } }
        .sl-pencil { position: absolute; right: 10px; bottom: 6px; font-size: 20px; color: #f2c14e; animation: slPencil 1.6s ease-in-out infinite; }
        @keyframes slPencil { 0%,100% { transform: translateX(0) rotate(0) } 50% { transform: translateX(-42px) rotate(-12deg) } }

        .sl-title { position: relative; z-index: 2; margin: 4px 0 0; font-size: 22px; font-weight: 800; letter-spacing: .3px;
          animation: slUp .6s .2s cubic-bezier(.2,.9,.3,1.1) both; }
        @keyframes slUp { from { opacity: 0; transform: translateY(12px) } to { opacity: 1; transform: none } }

        .sl-ticker { position: relative; z-index: 2; height: 20px; overflow: hidden; }
        .sl-tickerTrack { display: flex; flex-direction: column; animation: slTicker 5s cubic-bezier(.65,0,.35,1) forwards; will-change: transform; }
        .sl-tick { height: 20px; line-height: 20px; font-size: 13px; letter-spacing: .5px; opacity: .8; }
        @keyframes slTicker {
          0%   { transform: translateY(0) }
          14%  { transform: translateY(0) }
          25%  { transform: translateY(-20px) }
          39%  { transform: translateY(-20px) }
          50%  { transform: translateY(-40px) }
          64%  { transform: translateY(-40px) }
          75%  { transform: translateY(-60px) }
          89%  { transform: translateY(-60px) }
          100% { transform: translateY(-80px) }
        }

        .sl-bar { position: relative; z-index: 2; width: 240px; height: 5px; border-radius: 99px; background: rgba(255,255,255,.12); overflow: hidden; }
        .sl-bar span { display: block; height: 100%; width: 0; border-radius: 99px;
          background: linear-gradient(90deg,#f2c14e,#3b82f6,#22c55e);
          box-shadow: 0 0 12px rgba(242,193,78,.5);
          animation: slBar 5s cubic-bezier(.25,.6,.25,1) forwards; will-change: width; }
        @keyframes slBar { 0% { width: 0 } 40% { width: 52% } 75% { width: 82% } 100% { width: 100% } }


        @media (prefers-reduced-motion: reduce) {
          .sl-root *, .sl-root { animation-duration: .001ms !important; animation-iteration-count: 1 !important; }
          .sl-bar span { width: 100% }
        }
      `}</style>
    </div>
  );
}
