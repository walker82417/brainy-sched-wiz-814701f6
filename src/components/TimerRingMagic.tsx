import { useEffect, useRef } from "react";

type Tone = "run" | "warn" | "done";

const TONES: Record<Tone, { core: string; glow: string; spark: string }> = {
  run: { core: "#2b6fd6", glow: "rgba(43,111,214,.55)", spark: "#f2c14e" },
  warn: { core: "#ea580c", glow: "rgba(234,88,12,.55)", spark: "#ffd08a" },
  done: { core: "#16a34a", glow: "rgba(22,163,74,.55)", spark: "#bbf7d0" },
};

/**
 * Decorative overlay drawn on top of the timer modal's SVG ring:
 * orbiting twinkles + a glowing comet head at the leading edge.
 * Progress is eased and never ticks backwards.
 */
export default function TimerRingMagic({ pct, tone = "run" }: { pct: number; tone?: Tone }) {
  const cvsRef = useRef<HTMLCanvasElement | null>(null);
  const targetRef = useRef(0);
  const drawRef = useRef(0);
  const toneRef = useRef<Tone>(tone);

  targetRef.current = Math.max(targetRef.current, Math.min(1, Math.max(0, pct)));
  toneRef.current = tone;

  useEffect(() => {
    const cvs = cvsRef.current;
    if (!cvs) return;
    const ctx = cvs.getContext("2d");
    if (!ctx) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    const sparks = Array.from({ length: 10 }, (_, i) => ({
      a: (i / 10) * Math.PI * 2,
      radK: 0.18 + ((i * 7) % 23) / 100,
      sp: 0.00028 + (i % 4) * 0.00014,
      ph: i * 0.9,
    }));

    let raf = 0;
    let w = 0, h = 0;

    const resize = () => {
      const rect = cvs.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      w = rect.width || 140;
      h = rect.height || 140;
      cvs.width = Math.round(w * dpr);
      cvs.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();

    const draw = (t: number) => {
      if (Math.abs(cvs.getBoundingClientRect().width - w) > 1) resize();

      drawRef.current += (targetRef.current - drawRef.current) * (reduce ? 1 : 0.09);
      if (Math.abs(targetRef.current - drawRef.current) < 0.0005) drawRef.current = targetRef.current;
      const p = drawRef.current;
      const c = TONES[toneRef.current] ?? TONES.run;

      const cx = w / 2, cy = h / 2;
      const r = (Math.min(w, h) / 2) * 0.9; // matches svg r=54 of 120 viewBox

      ctx.clearRect(0, 0, w, h);

      if (!reduce) {
        sparks.forEach((s) => {
          const a = s.a + t * s.sp;
          const tw = 0.3 + 0.7 * Math.abs(Math.sin(t * 0.0015 + s.ph));
          const rad = r * s.radK * (0.85 + 0.15 * Math.sin(t * 0.0009 + s.ph));
          const x = cx + Math.cos(a) * rad;
          const y = cy + Math.sin(a) * rad;
          ctx.globalAlpha = tw * 0.5 * Math.min(1, p * 2.2 + 0.15);
          ctx.fillStyle = c.spark;
          ctx.beginPath();
          ctx.arc(x, y, 0.9 + tw * 1.4, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1;
        });
      }

      if (p > 0.001 && !reduce) {
        const end = -Math.PI / 2 + Math.PI * 2 * p;
        const hx = cx + Math.cos(end) * r;
        const hy = cy + Math.sin(end) * r;

        // soft trailing glow behind the head
        const trail = ctx.createRadialGradient(hx, hy, 0, hx, hy, 14);
        trail.addColorStop(0, c.glow);
        trail.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = trail;
        ctx.beginPath();
        ctx.arc(hx, hy, 14, 0, Math.PI * 2);
        ctx.fill();

        // comet head
        const pulse = 2.4 + 0.9 * Math.sin(t * 0.005);
        ctx.save();
        ctx.shadowColor = c.glow;
        ctx.shadowBlur = 10;
        ctx.fillStyle = "#fffdf5";
        ctx.beginPath();
        ctx.arc(hx, hy, pulse, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);

  return <canvas ref={cvsRef} className="tt-tmRingMagic" aria-hidden="true" />;
}
