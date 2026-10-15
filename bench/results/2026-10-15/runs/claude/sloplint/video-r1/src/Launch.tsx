import React from "react";
import {
  AbsoluteFill,
  Audio,
  Easing,
  Sequence,
  interpolate,
  staticFile,
  useCurrentFrame,
} from "remotion";

const FPS = 30;

// Scene lengths in frames, timed to what each scene has to show.
// intro 2.2s, matching 3.8s, overview 3.2s, export 2.8s, call to action 3.0s.
export const SCENES = [66, 114, 96, 84, 90] as const;
export const LAUNCH_DURATION = SCENES.reduce((a, b) => a + b, 0);

const START = SCENES.reduce<number[]>(
  (acc, len, i) => [...acc, i === 0 ? 0 : acc[i - 1] + SCENES[i - 1]],
  [],
);

const TOKENS = `
@import url("https://fonts.googleapis.com/css2?family=Unbounded:wght@600&family=Golos+Text:wght@400;600&family=JetBrains+Mono:wght@400;500&display=swap");
.ledgerly-root {
  --bg: #f0f9ff;
  --surface: #fbfdfe;
  --surface-2: #e0eef7;
  --line: #bfd0da;
  --ink: #0e1c24;
  --ink-2: #5b6c76;
  --accent: #0599d5;
  --accent-ink: #067aa9;
  --on-accent: #071822;
  --font-display: "Unbounded", system-ui, sans-serif;
  --font-text: "Golos Text", system-ui, sans-serif;
  --font-mono: "JetBrains Mono", ui-monospace, Menlo, Consolas, monospace;
  --radius-sm: 10px;
  --radius: 16px;
  --radius-lg: 24px;
  --border: 2px;
  --shadow: 8px 8px 0 var(--ink);
}
`;

const outCurve = Easing.bezier(0.16, 1, 0.3, 1);

// 0 -> 1 between frames a and b, decelerating, never overshooting.
const progress = (frame: number, a: number, b: number) =>
  interpolate(frame, [a, b], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: outCurve,
  });

// Delay for item i of n, spread over `window` frames on an easing curve.
const spread = (i: number, n: number, window: number) =>
  Math.round(Easing.out(Easing.cubic)(n > 1 ? i / (n - 1) : 0) * window);

const displayFont: React.CSSProperties = {
  fontFamily: "var(--font-display)",
  fontWeight: 600,
  lineHeight: 1.05,
  letterSpacing: "-0.015em",
  color: "var(--ink)",
  margin: 0,
};

const monoTag: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontWeight: 500,
  fontSize: 26,
  fontVariantNumeric: "tabular-nums",
  color: "var(--ink)",
  border: "1px solid var(--line)",
  borderRadius: "var(--radius-sm)",
  padding: "6px 14px",
  display: "inline-block",
};

const bodyText: React.CSSProperties = {
  fontFamily: "var(--font-text)",
  fontSize: 38,
  lineHeight: 1.45,
  color: "var(--ink)",
  margin: 0,
};

const card: React.CSSProperties = {
  background: "var(--surface)",
  border: "var(--border) solid var(--line)",
  borderRadius: "var(--radius-lg)",
  boxShadow: "var(--shadow)",
  padding: 56,
  width: "100%",
  boxSizing: "border-box",
};

/** 5/7 split: headline column left, proof column right. */
const Split: React.FC<{
  left: React.ReactNode;
  right: React.ReactNode;
}> = ({ left, right }) => (
  <AbsoluteFill
    style={{
      padding: "120px 120px",
      display: "grid",
      gridTemplateColumns: "5fr 7fr",
      columnGap: 96,
      alignItems: "center",
    }}
  >
    <div style={{ display: "flex", flexDirection: "column", gap: 36 }}>{left}</div>
    <div>{right}</div>
  </AbsoluteFill>
);

/* ---------- Scene 1: product name ---------- */

const Intro: React.FC = () => {
  const frame = useCurrentFrame();
  const reveal = progress(frame, 4, 26);
  const bar = progress(frame, 18, 42);
  const line = progress(frame, 34, 50);
  return (
    <AbsoluteFill
      style={{ justifyContent: "center", padding: "0 160px", gap: 36 }}
    >
      <div
        style={{
          clipPath: `inset(0 0 ${(1 - reveal) * 100}% 0)`,
          transform: `translateY(${(1 - reveal) * 60}px)`,
        }}
      >
        <h1 style={{ ...displayFont, fontSize: 260 }}>Ledgerly</h1>
      </div>
      <div
        style={{
          height: 14,
          width: 520,
          background: "var(--accent)",
          transformOrigin: "left center",
          transform: `scaleX(${bar})`,
        }}
      />
      <p style={{ ...bodyText, fontSize: 52, opacity: line }}>
        Bookkeeping you can check line by line.
      </p>
    </AbsoluteFill>
  );
};

/* ---------- Feature visuals ---------- */

const Label: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span
    style={{
      fontFamily: "var(--font-mono)",
      fontWeight: 500,
      fontSize: 24,
      fontVariantNumeric: "tabular-nums",
      color: "var(--ink-2)",
      letterSpacing: "0.04em",
    }}
  >
    {children}
  </span>
);

const MatchVisual: React.FC = () => {
  const frame = useCurrentFrame();
  const rows = 4;
  const rowH = 76;
  const gap = 28;
  const widths = [0.82, 0.64, 0.9, 0.7];
  return (
    <div style={{ ...card, display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <Label>BANK LINES</Label>
        <Label>INVOICES</Label>
      </div>
      <div style={{ position: "relative", height: rows * rowH + (rows - 1) * gap }}>
        {Array.from({ length: rows }).map((_, i) => {
          const d = 14 + spread(i, rows, 26);
          const p = progress(frame, d, d + 16);
          const y = i * (rowH + gap);
          const matched = progress(frame, d + 22, d + 40);
          return (
            <React.Fragment key={i}>
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  top: y,
                  height: rowH,
                  width: `${widths[i] * 36}%`,
                  background: "var(--surface-2)",
                  borderRadius: "var(--radius)",
                  opacity: p,
                }}
              />
              <div
                style={{
                  position: "absolute",
                  right: 0,
                  top: y,
                  height: rowH,
                  width: `${widths[(i + 1) % rows] * 36}%`,
                  background: "var(--surface-2)",
                  borderRadius: "var(--radius)",
                  opacity: p,
                }}
              />
              <div
                style={{
                  position: "absolute",
                  left: "40%",
                  top: y + rowH / 2 - 4,
                  height: 8,
                  width: "20%",
                  background: "var(--accent)",
                  transformOrigin: "left center",
                  transform: `scaleX(${matched})`,
                }}
              />
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};

const OverviewVisual: React.FC = () => {
  const frame = useCurrentFrame();
  const bars = [
    { label: "CASH IN", w: 0.86, accent: true },
    { label: "CASH OUT", w: 0.55, accent: false },
    { label: "UNPAID", w: 0.34, accent: false },
  ];
  return (
    <div style={{ ...card, display: "flex", flexDirection: "column", gap: 44 }}>
      {bars.map((b, i) => {
        const d = 10 + spread(i, bars.length, 20);
        const p = progress(frame, d, d + 30);
        return (
          <div key={b.label} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <Label>{b.label}</Label>
            <div style={{ background: "var(--surface-2)", borderRadius: "var(--radius)", height: 72 }}>
              <div
                style={{
                  height: "100%",
                  width: `${b.w * 100}%`,
                  borderRadius: "var(--radius)",
                  background: b.accent ? "var(--accent)" : "var(--ink)",
                  transformOrigin: "left center",
                  transform: `scaleX(${p})`,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};

const ExportVisual: React.FC = () => {
  const frame = useCurrentFrame();
  const lines = [0.9, 0.7, 0.82, 0.6, 0.76];
  const press = progress(frame, 44, 50) - progress(frame, 50, 58);
  return (
    <div style={{ ...card, display: "flex", flexDirection: "column", gap: 28 }}>
      <span style={monoTag}>ledger.csv</span>
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {lines.map((w, i) => {
          const d = 8 + spread(i, lines.length, 22);
          const p = progress(frame, d, d + 14);
          return (
            <div
              key={i}
              style={{
                height: 28,
                width: `${w * 100}%`,
                background: "var(--surface-2)",
                borderRadius: "var(--radius-sm)",
                transformOrigin: "left center",
                transform: `scaleX(${p})`,
              }}
            />
          );
        })}
      </div>
      <div
        style={{
          alignSelf: "flex-start",
          background: "var(--accent)",
          color: "var(--on-accent)",
          fontFamily: "var(--font-text)",
          fontWeight: 600,
          fontSize: 34,
          padding: "20px 36px",
          borderRadius: "var(--radius)",
          transform: `scale(${1 - press * 0.04})`,
        }}
      >
        Download report (CSV)
      </div>
    </div>
  );
};

/* ---------- Feature scene shell, one hero move per scene ---------- */

type Entrance = "wipe" | "scale" | "rise";

const Feature: React.FC<{
  index: number;
  title: string;
  body: string;
  entrance: Entrance;
  titleMoves: boolean;
  children: React.ReactNode;
}> = ({ index, title, body, entrance, titleMoves, children }) => {
  const frame = useCurrentFrame();
  const hero = progress(frame, 0, 22);
  const text = progress(frame, 10, 28);

  let visualStyle: React.CSSProperties;
  if (entrance === "wipe") {
    visualStyle = { clipPath: `inset(0 ${(1 - hero) * 100}% 0 0)` };
  } else if (entrance === "scale") {
    visualStyle = {
      transform: `scale(${0.88 + 0.12 * hero})`,
      transformOrigin: "left center",
      opacity: Math.min(1, hero * 3),
    };
  } else {
    visualStyle = { transform: `translateY(${(1 - hero) * 120}px)` };
  }

  return (
    <Split
      left={
        <>
          <span style={monoTag}>{`0${index} / 03`}</span>
          <h2
            style={{
              ...displayFont,
              fontSize: 68,
              transform: titleMoves ? `translateX(${(1 - hero) * -40}px)` : undefined,
            }}
          >
            {title}
          </h2>
          <p style={{ ...bodyText, opacity: text }}>{body}</p>
        </>
      }
      right={<div style={visualStyle}>{children}</div>}
    />
  );
};

/* ---------- Closing call to action ---------- */

const CallToAction: React.FC = () => {
  const frame = useCurrentFrame();
  const head = progress(frame, 0, 20);
  const btn = progress(frame, 14, 30);
  const press = progress(frame, 44, 49) - progress(frame, 49, 58);
  return (
    <AbsoluteFill style={{ justifyContent: "center", padding: "0 160px", gap: 56 }}>
      <h2
        style={{
          ...displayFont,
          fontSize: 120,
          clipPath: `inset(0 0 ${(1 - head) * 100}% 0)`,
        }}
      >
        Create your
        <br />
        first ledger
      </h2>
      <div style={{ display: "flex", alignItems: "center", gap: 40 }}>
        <div
          style={{
            background: "var(--accent)",
            color: "var(--on-accent)",
            fontFamily: "var(--font-text)",
            fontWeight: 600,
            fontSize: 48,
            padding: "28px 56px",
            borderRadius: "var(--radius)",
            opacity: btn,
            transform: `translateX(${(1 - btn) * -60}px) scale(${1 - press * 0.04})`,
          }}
        >
          Create your ledger
        </div>
        <span style={{ ...monoTag, fontSize: 32, opacity: progress(frame, 30, 44) }}>
          Ledgerly
        </span>
      </div>
    </AbsoluteFill>
  );
};

/* ---------- Audio ---------- */

const MUSIC_LEVEL = 0.26;

const musicVolume = (f: number) =>
  interpolate(
    f,
    [0, 20, LAUNCH_DURATION - 36, LAUNCH_DURATION],
    [0, MUSIC_LEVEL, MUSIC_LEVEL, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

// Four distinct moments, each its own sound and level; most cuts ride the music.
const Sfx: React.FC<{ src: string; at: number; volume: number }> = ({ src, at, volume }) => (
  <Sequence from={at}>
    <Audio src={staticFile(src)} volume={volume} />
  </Sequence>
);

export const Launch: React.FC = () => (
  <AbsoluteFill className="ledgerly-root" style={{ background: "var(--bg)" }}>
    <style>{TOKENS}</style>

    <Audio src={staticFile("music.mp3")} volume={musicVolume} />
    <Sfx src="sfx/pop.mp3" at={8} volume={0.22} />
    <Sfx src="sfx/whoosh.mp3" at={START[1] - 4} volume={0.14} />
    <Sfx src="sfx/riser.mp3" at={START[4] - 40} volume={0.12} />
    <Sfx src="sfx/click.mp3" at={START[4] + 44} volume={0.2} />

    <Sequence from={START[0]} durationInFrames={SCENES[0]}>
      <Intro />
    </Sequence>
    <Sequence from={START[1]} durationInFrames={SCENES[1]}>
      <Feature
        index={1}
        title="Match bank lines to invoices"
        body="Each deposit finds the invoice it pays, and you see the link."
        entrance="wipe"
        titleMoves
      >
        <MatchVisual />
      </Feature>
    </Sequence>
    <Sequence from={START[2]} durationInFrames={SCENES[2]}>
      <Feature
        index={2}
        title="Cash and unpaid invoices in one view"
        body="Money in, money out and what is still owed, side by side."
        entrance="scale"
        titleMoves={false}
      >
        <OverviewVisual />
      </Feature>
    </Sequence>
    <Sequence from={START[3]} durationInFrames={SCENES[3]}>
      <Feature
        index={3}
        title="Export a ledger your accountant can open"
        body="One click gives you a CSV with every entry."
        entrance="rise"
        titleMoves
      >
        <ExportVisual />
      </Feature>
    </Sequence>
    <Sequence from={START[4]} durationInFrames={SCENES[4]}>
      <CallToAction />
    </Sequence>
  </AbsoluteFill>
);

export const LAUNCH_FPS = FPS;
