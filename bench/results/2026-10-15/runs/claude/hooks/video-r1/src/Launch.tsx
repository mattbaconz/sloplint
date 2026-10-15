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

export const LAUNCH_FPS = 30;
export const LAUNCH_DURATION = 450;

const css = `
@import url("https://fonts.googleapis.com/css2?family=Gloock:wght@400&family=Source+Serif+4:wght@400;600&family=Source+Code+Pro:wght@400;500&display=swap");
.launch {
  --bg: #fef9f4;
  --line: #d4cec7;
  --ink: #241f19;
  --ink-2: #6e6860;
  --accent: #8f5a0d;
  --on-accent: #fff9f3;
  --font-display: "Gloock", Georgia, "Times New Roman", serif;
  --font-text: "Source Serif 4", Georgia, "Times New Roman", serif;
  --font-mono: "Source Code Pro", ui-monospace, Menlo, Consolas, monospace;
}
`;

const ease = Easing.bezier(0.2, 0, 0, 1);

const fade = (frame: number, from: number, dur: number) =>
  interpolate(frame, [from, from + dur], [0, 1], {
    easing: ease,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

// Scene lengths follow what each beat has to say, not a fixed step.
const SCENES = {
  title: { from: 0, dur: 110 },
  reconcile: { from: 110, dur: 100 },
  categorize: { from: 210, dur: 80 },
  close: { from: 290, dur: 70 },
  cta: { from: 360, dur: 90 },
};

const FEATURES = [
  {
    scene: SCENES.reconcile,
    index: "01",
    head: "Bank feeds reconcile themselves.",
    body: "Every deposit and charge is matched to its entry as it arrives, so the ledger and the statement agree.",
    mono: "STATEMENT = LEDGER",
  },
  {
    scene: SCENES.categorize,
    index: "02",
    head: "Each transaction gets a category.",
    body: "Rules sort the routine ones. You review only the entries that break a pattern.",
    mono: "RULE MATCHED / REVIEW",
  },
  {
    scene: SCENES.close,
    index: "03",
    head: "Close the month in one pass.",
    body: "Lock the period, export the report, and move on.",
    mono: "PERIOD LOCKED",
  },
];

const Rule: React.FC<{ progress: number; top?: number; bottom?: number }> = ({
  progress,
  top,
  bottom,
}) => (
  <div
    style={{
      position: "absolute",
      left: 160,
      right: 160,
      top,
      bottom,
      height: 1,
      background: "var(--line)",
      transformOrigin: "left center",
      transform: `scaleX(${progress})`,
    }}
  />
);

const Frame: React.FC<{ children: React.ReactNode; label: string }> = ({
  children,
  label,
}) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: "var(--bg)", color: "var(--ink)" }}>
      <Rule top={120} progress={fade(frame, 0, 20)} />
      <div
        style={{
          position: "absolute",
          left: 160,
          top: 64,
          fontFamily: "var(--font-mono)",
          fontSize: 22,
          fontWeight: 500,
          letterSpacing: "0.08em",
          fontVariantNumeric: "tabular-nums",
          opacity: fade(frame, 0, 12),
        }}
      >
        LEDGERLY
      </div>
      <div
        style={{
          position: "absolute",
          right: 160,
          top: 64,
          fontFamily: "var(--font-mono)",
          fontSize: 22,
          color: "var(--ink-2)",
          fontVariantNumeric: "tabular-nums",
          opacity: fade(frame, 0, 12),
        }}
      >
        {label}
      </div>
      {children}
    </AbsoluteFill>
  );
};

const Title: React.FC = () => {
  const frame = useCurrentFrame();
  // The hero is revealed by a mask wipe; everything else simply fades.
  const reveal = interpolate(frame, [4, 34], [100, 0], {
    easing: ease,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <Frame label="Launch">
      <div style={{ position: "absolute", left: 160, top: 250 }}>
        <div
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 300,
            lineHeight: 1.05,
            letterSpacing: "-0.01em",
            clipPath: `inset(0 ${reveal}% 0 0)`,
          }}
        >
          Ledgerly
        </div>
        <div
          style={{
            marginTop: 56,
            maxWidth: 1000,
            fontFamily: "var(--font-text)",
            fontSize: 44,
            lineHeight: 1.45,
            opacity: fade(frame, 48, 24),
          }}
        >
          Bookkeeping that keeps the ledger and the bank statement in
          agreement.
        </div>
      </div>
      <Rule bottom={140} progress={fade(frame, 60, 30)} />
      <div
        style={{
          position: "absolute",
          left: 160,
          bottom: 80,
          fontFamily: "var(--font-mono)",
          fontSize: 22,
          color: "var(--ink-2)",
          opacity: fade(frame, 78, 18),
        }}
      >
        Reconcile / Categorize / Close
      </div>
    </Frame>
  );
};

const Feature: React.FC<{ f: (typeof FEATURES)[number] }> = ({ f }) => {
  const frame = useCurrentFrame();
  return (
    <Frame label={`${f.index} / 03`}>
      <div
        style={{
          position: "absolute",
          left: 160,
          top: 230,
          fontFamily: "var(--font-display)",
          fontSize: 220,
          lineHeight: 1,
          color: "var(--accent)",
          fontVariantNumeric: "tabular-nums",
          opacity: fade(frame, 0, 10),
        }}
      >
        {f.index}
      </div>
      <div style={{ position: "absolute", left: 160, top: 500, right: 160 }}>
        <div
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 112,
            lineHeight: 1.05,
            letterSpacing: "-0.01em",
            maxWidth: 1400,
            opacity: fade(frame, 6, 16),
          }}
        >
          {f.head}
        </div>
        <div
          style={{
            marginTop: 40,
            maxWidth: 1000,
            fontFamily: "var(--font-text)",
            fontSize: 38,
            lineHeight: 1.5,
            opacity: fade(frame, 22, 20),
          }}
        >
          {f.body}
        </div>
      </div>
      <Rule bottom={140} progress={fade(frame, 14, 22)} />
      <div
        style={{
          position: "absolute",
          left: 160,
          bottom: 80,
          fontFamily: "var(--font-mono)",
          fontSize: 22,
          color: "var(--ink-2)",
          opacity: fade(frame, 34, 14),
        }}
      >
        {f.mono}
      </div>
    </Frame>
  );
};

const CallToAction: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <Frame label="Ledgerly">
      <div style={{ position: "absolute", left: 160, top: 300 }}>
        <div
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 190,
            lineHeight: 1.05,
            letterSpacing: "-0.01em",
            opacity: fade(frame, 0, 18),
          }}
        >
          Open your books.
        </div>
        <div
          style={{
            marginTop: 72,
            display: "inline-block",
            height: 88,
            lineHeight: "88px",
            padding: "0 40px",
            borderRadius: 2,
            background: "var(--accent)",
            color: "var(--on-accent)",
            fontFamily: "var(--font-text)",
            fontWeight: 600,
            fontSize: 38,
            opacity: fade(frame, 26, 14),
          }}
        >
          Create your Ledgerly account
        </div>
      </div>
    </Frame>
  );
};

const Sfx: React.FC<{
  at: number;
  file: string;
  volume: number;
  rate?: number;
}> = ({ at, file, volume, rate = 1 }) => (
  <Sequence from={at} layout="none">
    <Audio
      src={staticFile(`sfx/${file}`)}
      volume={volume}
      playbackRate={rate}
    />
  </Sequence>
);

export const Launch: React.FC = () => {
  return (
    <AbsoluteFill className="launch" style={{ background: "#fef9f4" }}>
      <style>{css}</style>

      <Audio
        src={staticFile("music.mp3")}
        volume={(f) =>
          0.28 *
          interpolate(
            f,
            [0, 30, LAUNCH_DURATION - 45, LAUNCH_DURATION],
            [0, 1, 1, 0],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
          )
        }
      />

      <Sequence from={SCENES.title.from} durationInFrames={SCENES.title.dur}>
        <Title />
      </Sequence>
      {FEATURES.map((f) => (
        <Sequence
          key={f.index}
          from={f.scene.from}
          durationInFrames={f.scene.dur}
        >
          <Feature f={f} />
        </Sequence>
      ))}
      <Sequence from={SCENES.cta.from} durationInFrames={SCENES.cta.dur}>
        <CallToAction />
      </Sequence>

      {/* A few distinct moments; the music carries the rest of the cuts. */}
      <Sfx at={4} file="pop.mp3" volume={0.22} />
      <Sfx at={SCENES.reconcile.from} file="whoosh.mp3" volume={0.14} />
      <Sfx at={SCENES.categorize.from + 2} file="click.mp3" volume={0.1} rate={1.1} />
      <Sfx at={SCENES.close.from + 2} file="click.mp3" volume={0.14} rate={0.9} />
      <Sfx at={SCENES.cta.from - 36} file="riser.mp3" volume={0.12} />
      <Sfx at={SCENES.cta.from + 26} file="pop.mp3" volume={0.18} rate={1.2} />
    </AbsoluteFill>
  );
};
