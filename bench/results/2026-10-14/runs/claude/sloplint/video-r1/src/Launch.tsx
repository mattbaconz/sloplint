import React from "react";
import {
  AbsoluteFill,
  Audio,
  Easing,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

const C = {
  bg: "#0e0f11",
  surface: "#15171a",
  line: "#2a2e34",
  ink: "#e8e6e1",
  ink2: "#9a9ea6",
  accent: "#f2a33a",
  onAccent: "#1a1206",
  good: "#5fbf8f",
};
const SANS = '"IBM Plex Sans", system-ui, sans-serif';
const MONO = '"IBM Plex Mono", ui-monospace, monospace';
const RADIUS = 6;
const PAD = 32;

// Scene lengths in frames, timed to content: a quick name, a long lead feature, two shorter ones, a short close.
const SCENES = {
  intro: 84,
  reconcile: 108,
  close: 84,
  export: 96,
  cta: 78,
} as const;
const START = {
  intro: 0,
  reconcile: SCENES.intro,
  close: SCENES.intro + SCENES.reconcile,
  export: SCENES.intro + SCENES.reconcile + SCENES.close,
  cta: SCENES.intro + SCENES.reconcile + SCENES.close + SCENES.export,
};
export const LAUNCH_DURATION = Object.values(SCENES).reduce((a, b) => a + b, 0);

const easeOut = Easing.out(Easing.cubic);
// Critically damped: no overshoot anywhere in the film.
const SMOOTH = { damping: 200 };
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

const Frame: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <AbsoluteFill
    style={{
      backgroundColor: C.bg,
      color: C.ink,
      fontFamily: SANS,
      justifyContent: "center",
      padding: "0 160px",
    }}
  >
    {children}
  </AbsoluteFill>
);

const Label: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div
    style={{
      fontSize: 24,
      fontWeight: 500,
      letterSpacing: "0.06em",
      textTransform: "uppercase",
      color: C.ink2,
      marginBottom: 24,
    }}
  >
    {children}
  </div>
);

// Hero: the product name rises out of a mask.
const Intro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const rise = spring({ frame: frame - 6, fps, config: SMOOTH, durationInFrames: 30 });
  const rule = interpolate(frame, [20, 50], [0, 100], { ...clamp, easing: easeOut });
  return (
    <Frame>
      <div style={{ overflow: "hidden", paddingBottom: 12 }}>
        <div
          style={{
            fontSize: 220,
            fontWeight: 600,
            lineHeight: 1.1,
            transform: `translateY(${(1 - rise) * 110}%)`,
          }}
        >
          Ledger<span style={{ color: C.accent }}>ly</span>
        </div>
      </div>
      <div style={{ height: 4, width: `${rule}%`, maxWidth: 560, backgroundColor: C.accent }} />
      <div style={{ fontSize: 48, marginTop: 40, opacity: interpolate(frame, [44, 56], [0, 1], clamp) }}>
        Bookkeeping that closes itself.
      </div>
    </Frame>
  );
};

const ROWS = [
  { payee: "Stripe payout", amount: "4,812.50" },
  { payee: "AWS invoice #8841", amount: "-1,236.07" },
  { payee: "Gusto payroll", amount: "-9,420.00" },
  { payee: "Figma annual plan", amount: "-540.00" },
  { payee: "Wire from Northwind", amount: "7,250.00" },
];

// Lead feature, shown in depth: rows land across a fixed window with an eased spread.
const Reconcile: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const slide = spring({ frame, fps, config: SMOOTH, durationInFrames: 24 });
  const n = ROWS.length;
  const net = interpolate(frame, [30, 84], [0, 10866.93], { ...clamp, easing: easeOut });
  return (
    <Frame>
      <div style={{ display: "flex", gap: 96, alignItems: "center" }}>
        <div style={{ flex: "0 0 640px", transform: `translateX(${(1 - slide) * -80}px)`, opacity: slide }}>
          <Label>01 Bank reconciliation</Label>
          <div style={{ fontSize: 80, fontWeight: 600, lineHeight: 1.15 }}>
            Every transaction matched on import.
          </div>
        </div>
        <div
          style={{
            flex: 1,
            backgroundColor: C.surface,
            border: `2px solid ${C.line}`,
            borderRadius: RADIUS,
            padding: PAD,
            transform: `translateY(${(1 - slide) * 60}px)`,
          }}
        >
          {ROWS.map((row, i) => {
            const at = 18 + Math.round(easeOut(i / (n - 1)) * 40);
            const shown = interpolate(frame, [at, at + 8], [0, 1], clamp);
            return (
              <div
                key={row.payee}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  height: 72,
                  fontSize: 28,
                  borderTop: i === 0 ? "none" : `2px solid ${C.line}`,
                  opacity: shown,
                  transform: `translateY(${(1 - shown) * 12}px)`,
                }}
              >
                <span>{row.payee}</span>
                <span style={{ display: "flex", gap: 32, alignItems: "center" }}>
                  <span style={{ fontFamily: MONO, fontVariantNumeric: "tabular-nums" }}>{row.amount}</span>
                  <span style={{ color: C.good, width: 130, textAlign: "right" }}>Matched</span>
                </span>
              </div>
            );
          })}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginTop: 8,
              paddingTop: 20,
              borderTop: `2px solid ${C.line}`,
              fontSize: 28,
            }}
          >
            <span>Net, 5 of 5 matched</span>
            <span style={{ fontFamily: MONO, fontVariantNumeric: "tabular-nums", color: C.accent }}>
              {net.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      </div>
    </Frame>
  );
};

// Second feature: one big number that counts down.
const CloseBooks: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const grow = spring({ frame: frame - 4, fps, config: SMOOTH, durationInFrames: 26 });
  const days = Math.round(interpolate(frame, [10, 56], [9, 1], { ...clamp, easing: easeOut }));
  return (
    <Frame>
      <Label>02 Month-end close</Label>
      <div style={{ display: "flex", alignItems: "baseline", gap: 48 }}>
        <div
          style={{
            fontFamily: MONO,
            fontVariantNumeric: "tabular-nums",
            fontSize: 360,
            fontWeight: 600,
            lineHeight: 1,
            color: C.accent,
            transformOrigin: "left bottom",
            transform: `scaleX(${0.6 + 0.4 * grow})`,
          }}
        >
          {days}
        </div>
        <div style={{ fontSize: 72, fontWeight: 600, lineHeight: 1.15 }}>
          day to close
          <br />
          the month.
        </div>
      </div>
    </Frame>
  );
};

// Third feature: the export panel unfolds with a clip-path.
const ExportFile: React.FC = () => {
  const frame = useCurrentFrame();
  const reveal = interpolate(frame, [4, 34], [100, 0], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  const lines = [
    "date,account,debit,credit",
    "2026-09-30,Revenue,0.00,48120.00",
    "2026-09-30,Payroll,9420.00,0.00",
  ];
  return (
    <Frame>
      <Label>03 Audit export</Label>
      <div style={{ display: "flex", gap: 96, alignItems: "center" }}>
        <div style={{ fontSize: 80, fontWeight: 600, lineHeight: 1.15, flex: "0 0 700px" }}>
          One CSV your auditor can open.
        </div>
        <div
          style={{
            flex: 1,
            backgroundColor: C.surface,
            border: `2px solid ${C.line}`,
            borderRadius: RADIUS,
            padding: PAD,
            clipPath: `inset(0 ${reveal}% 0 0)`,
          }}
        >
          {lines.map((line, i) => (
            <div
              key={line}
              style={{
                fontFamily: MONO,
                fontVariantNumeric: "tabular-nums",
                fontSize: 26,
                lineHeight: "56px",
                color: i === 0 ? C.ink2 : C.ink,
                whiteSpace: "pre",
              }}
            >
              {line}
            </div>
          ))}
        </div>
      </div>
    </Frame>
  );
};

const Cta: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const lift = spring({ frame: frame - 6, fps, config: SMOOTH, durationInFrames: 22 });
  const btn = spring({ frame: frame - 30, fps, config: SMOOTH, durationInFrames: 14 });
  return (
    <Frame>
      <div style={{ fontSize: 120, fontWeight: 600, lineHeight: 1.15, transform: `translateY(${(1 - lift) * 40}px)` }}>
        Close your first month
        <br />
        in Ledgerly.
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 40, marginTop: 64 }}>
        <div
          style={{
            height: 96,
            padding: "0 48px",
            display: "flex",
            alignItems: "center",
            backgroundColor: C.accent,
            color: C.onAccent,
            borderRadius: RADIUS,
            fontSize: 40,
            fontWeight: 600,
            transform: `scale(${0.92 + 0.08 * btn})`,
            opacity: btn,
          }}
        >
          Start free trial
        </div>
        <div style={{ fontFamily: MONO, fontSize: 40 }}>ledgerly.app</div>
      </div>
    </Frame>
  );
};

export const Launch: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: C.bg }}>
      <Audio
        src={staticFile("music.mp3")}
        volume={(f) =>
          interpolate(f, [0, 20, LAUNCH_DURATION - 30, LAUNCH_DURATION], [0, 0.3, 0.3, 0], clamp)
        }
      />

      <Sequence from={START.intro} durationInFrames={SCENES.intro}>
        <Intro />
      </Sequence>
      <Sequence from={START.reconcile} durationInFrames={SCENES.reconcile}>
        <Reconcile />
      </Sequence>
      <Sequence from={START.close} durationInFrames={SCENES.close}>
        <CloseBooks />
      </Sequence>
      <Sequence from={START.export} durationInFrames={SCENES.export}>
        <ExportFile />
      </Sequence>
      <Sequence from={START.cta} durationInFrames={SCENES.cta}>
        <Cta />
      </Sequence>

      {/* Music carries most cuts; four moments get their own sound, each at its own level. */}
      <Sequence from={START.close - 6} durationInFrames={30}>
        <Audio src={staticFile("sfx/whoosh.mp3")} volume={0.22} />
      </Sequence>
      <Sequence from={START.reconcile + 58} durationInFrames={20}>
        <Audio src={staticFile("sfx/click.mp3")} volume={0.12} />
      </Sequence>
      <Sequence from={START.cta - 45} durationInFrames={45}>
        <Audio src={staticFile("sfx/riser.mp3")} volume={0.18} />
      </Sequence>
      <Sequence from={START.cta + 30} durationInFrames={30}>
        <Audio src={staticFile("sfx/pop.mp3")} volume={0.25} />
      </Sequence>
    </AbsoluteFill>
  );
};
