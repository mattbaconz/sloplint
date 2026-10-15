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
export const LAUNCH_DURATION = 15 * FPS;

const css = `
@import url("https://fonts.googleapis.com/css2?family=Newsreader:wght@400;600&family=Public+Sans:wght@400;600&family=IBM+Plex+Mono:wght@400;500&display=swap");
.lg {
  --bg: #faf6ed;
  --line: #d1cbbf;
  --ink: #171208;
  --ink-2: #6e685c;
  --accent: #704601;
  --on-accent: #fff9f3;
  --font-display: "Newsreader", Georgia, "Times New Roman", serif;
  --font-text: "Public Sans", system-ui, sans-serif;
  --font-mono: "IBM Plex Mono", ui-monospace, Menlo, Consolas, monospace;
  background: var(--bg);
  color: var(--ink);
  font-family: var(--font-text);
}
.lg .mono { font-family: var(--font-mono); font-variant-numeric: tabular-nums; }
.lg .display { font-family: var(--font-display); font-weight: 600; line-height: 1.05; letter-spacing: -0.01em; }
`;

// Scene lengths follow what each scene has to show, not a fixed step.
const SCENES = {
  intro: { from: 0, len: 90 },
  features: [
    { from: 90, len: 105 },
    { from: 195, len: 80 },
    { from: 275, len: 95 },
  ],
  cta: { from: 370, len: 80 },
};

const ease = Easing.bezier(0.2, 0, 0, 1);

const fade = (frame: number, start: number, dur: number) =>
  interpolate(frame, [start, start + dur], [0, 1], {
    easing: ease,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

const FEATURES = [
  {
    n: "01",
    claim: "Bank feeds reconcile themselves",
    evidence:
      "Every transaction is matched to an invoice or bill. The unmatched ones wait in one queue.",
  },
  {
    n: "02",
    claim: "Invoices go out from the ledger",
    evidence:
      "Send an invoice from the entry that created it. Payments post back to the same line.",
  },
  {
    n: "03",
    claim: "Month end closes on one page",
    evidence:
      "Review open items, lock the period, and export the books for your accountant.",
  },
];

const Intro: React.FC = () => {
  const frame = useCurrentFrame();
  // The name is revealed by a mask wipe; the rule and tagline arrive quietly.
  const wipe = interpolate(frame, [6, 30], [100, 0], {
    easing: ease,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const out = interpolate(frame, [78, 90], [1, 0], { extrapolateLeft: "clamp" });
  return (
    <AbsoluteFill style={{ padding: "0 180px", justifyContent: "center", opacity: out }}>
      <div
        className="mono"
        style={{ fontSize: 22, color: "var(--ink-2)", opacity: fade(frame, 0, 10) }}
      >
        LEDGERLY / ACCOUNTING FOR SMALL TEAMS
      </div>
      <div
        className="display"
        style={{ fontSize: 240, marginTop: 24, clipPath: `inset(0 ${wipe}% 0 0)` }}
      >
        Ledgerly
      </div>
      <div
        style={{
          height: 1,
          background: "var(--line)",
          marginTop: 32,
          width: 1560 * fade(frame, 28, 20),
        }}
      />
      <div style={{ fontSize: 40, marginTop: 28, opacity: fade(frame, 44, 18) }}>
        Your books, kept in plain sight.
      </div>
    </AbsoluteFill>
  );
};

const Feature: React.FC<{ index: number; len: number }> = ({ index, len }) => {
  const frame = useCurrentFrame();
  const f = FEATURES[index];
  // Each feature enters its own way: a cut, a soft fade, then a wipe.
  let claimStyle: React.CSSProperties = {};
  let evidenceOpacity = 1;
  if (index === 0) {
    evidenceOpacity = fade(frame, 14, 10);
  } else if (index === 1) {
    claimStyle = { opacity: fade(frame, 0, 18) };
    evidenceOpacity = fade(frame, 20, 22);
  } else {
    const w = interpolate(frame, [0, 20], [100, 0], {
      easing: ease,
      extrapolateRight: "clamp",
    });
    claimStyle = { clipPath: `inset(0 ${w}% 0 0)` };
    evidenceOpacity = fade(frame, 22, 12);
  }
  const out = interpolate(frame, [len - 8, len], [1, 0], { extrapolateLeft: "clamp" });
  return (
    <AbsoluteFill style={{ padding: "0 180px", justifyContent: "center", opacity: out }}>
      <div
        style={{
          borderTop: "1px solid var(--line)",
          borderBottom: "1px solid var(--line)",
          padding: "72px 0",
          display: "grid",
          gridTemplateColumns: "140px 1fr 1fr",
          gap: 48,
          alignItems: "start",
        }}
      >
        <div className="mono" style={{ fontSize: 40, color: "var(--accent)" }}>
          {f.n}
        </div>
        <div className="display" style={{ fontSize: 84, ...claimStyle }}>
          {f.claim}
        </div>
        <div
          style={{ fontSize: 34, lineHeight: 1.5, opacity: evidenceOpacity, paddingTop: 12 }}
        >
          {f.evidence}
        </div>
      </div>
    </AbsoluteFill>
  );
};

const Cta: React.FC = () => {
  const frame = useCurrentFrame();
  const out = interpolate(frame, [68, 80], [1, 0], { extrapolateLeft: "clamp" });
  return (
    <AbsoluteFill style={{ padding: "0 180px", justifyContent: "center", opacity: out }}>
      <div className="display" style={{ fontSize: 150, opacity: fade(frame, 4, 16) }}>
        Close your books
        <br />
        with Ledgerly.
      </div>
      <div
        style={{
          marginTop: 56,
          display: "flex",
          alignItems: "center",
          gap: 32,
          opacity: fade(frame, 26, 14),
        }}
      >
        <div
          style={{
            height: 72,
            padding: "0 40px",
            display: "flex",
            alignItems: "center",
            background: "var(--accent)",
            color: "var(--on-accent)",
            fontSize: 32,
            fontWeight: 600,
            borderRadius: 2,
          }}
        >
          Start your ledger
        </div>
        <div className="mono" style={{ fontSize: 28, color: "var(--ink-2)" }}>
          ledgerly.app
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const Launch: React.FC = () => {
  const { intro, features, cta } = SCENES;
  return (
    <AbsoluteFill className="lg">
      <style>{css}</style>

      <Audio
        src={staticFile("music.mp3")}
        volume={(f) =>
          interpolate(f, [0, 20, LAUNCH_DURATION - 45, LAUNCH_DURATION], [0, 0.28, 0.28, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          })
        }
      />

      <Sequence from={intro.from} durationInFrames={intro.len}>
        <Intro />
      </Sequence>
      {features.map((s, i) => (
        <Sequence key={s.from} from={s.from} durationInFrames={s.len}>
          <Feature index={i} len={s.len} />
        </Sequence>
      ))}
      <Sequence from={cta.from} durationInFrames={cta.len}>
        <Cta />
      </Sequence>

      {/* The music carries most cuts; effects mark the name, the features and the close. */}
      <Sequence from={6}>
        <Audio src={staticFile("sfx/pop.mp3")} volume={0.35} />
      </Sequence>
      <Sequence from={features[0].from}>
        <Audio src={staticFile("sfx/click.mp3")} volume={0.25} />
      </Sequence>
      <Sequence from={features[1].from + 2}>
        <Audio src={staticFile("sfx/click.mp3")} volume={0.18} playbackRate={1.15} />
      </Sequence>
      <Sequence from={features[2].from}>
        <Audio src={staticFile("sfx/whoosh.mp3")} volume={0.2} />
      </Sequence>
      <Sequence from={cta.from - 40}>
        <Audio src={staticFile("sfx/riser.mp3")} volume={0.22} />
      </Sequence>
    </AbsoluteFill>
  );
};
