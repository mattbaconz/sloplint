import { useEffect, useState } from "react";
import {
  AbsoluteFill,
  Audio,
  cancelRender,
  Easing,
  Sequence,
  continueRender,
  delayRender,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

export const LAUNCH_DURATION = 450; // 15s at 30fps

// Scene lengths follow what each scene has to show, not a fixed step.
const NAME = { from: 0, length: 96 };
const F1 = { from: 96, length: 105 };
const F2 = { from: 201, length: 90 };
const F3 = { from: 291, length: 90 };
const CTA = { from: 381, length: 69 };

const FONT_CSS = `
@import url("https://fonts.googleapis.com/css2?family=Red+Hat+Display:wght@700&family=Red+Hat+Text:wght@400;600&family=Red+Hat+Mono:wght@400;500&display=swap");
:root {
  --bg: #f0f4f8;
  --surface: #f7f9fb;
  --surface-2: #e3e9ed;
  --line: #c4cacf;
  --ink: #0e1317;
  --ink-2: #61676c;
  --accent: #0f8d9a;
  --accent-ink: #027a85;
  --on-accent: #031a1d;
  --font-display: "Red Hat Display", system-ui, sans-serif;
  --font-text: "Red Hat Text", system-ui, sans-serif;
  --font-mono: "Red Hat Mono", ui-monospace, Menlo, Consolas, monospace;
  --radius: 4px;
  --radius-lg: 6px;
}
`;

// Critically damped: no overshoot.
const smooth = { damping: 200 };

const useFonts = () => {
  const [handle] = useState(() => delayRender("fonts"));
  useEffect(() => {
    Promise.all([
      document.fonts.load('700 100px "Red Hat Display"'),
      document.fonts.load('600 40px "Red Hat Text"'),
      document.fonts.load('500 40px "Red Hat Mono"'),
    ])
      .then(() => continueRender(handle))
      .catch((err) => cancelRender(err));
  }, [handle]);
};

const Grid: React.FC = () => (
  <AbsoluteFill
    style={{
      flexDirection: "row",
      padding: "0 120px",
      gap: 24,
      opacity: 0.5,
    }}
  >
    {Array.from({ length: 12 }, (_, i) => (
      <div
        key={i}
        style={{
          flex: 1,
          borderLeft: "1px solid var(--line)",
          borderRight: "1px solid var(--line)",
        }}
      />
    ))}
  </AbsoluteFill>
);

const Row: React.FC<{
  label: string;
  value: string;
  progress: number;
  highlight?: boolean;
}> = ({ label, value, progress, highlight }) => (
  <div
    style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "baseline",
      padding: "22px 0",
      borderBottom: "1px solid var(--line)",
      opacity: progress,
      transform: `translateY(${(1 - progress) * 16}px)`,
      fontFamily: "var(--font-mono)",
      fontVariantNumeric: "tabular-nums",
      fontSize: 34,
      color: highlight ? "var(--accent-ink)" : "var(--ink)",
    }}
  >
    <span>{label}</span>
    <span style={{ textAlign: "right" }}>{value}</span>
  </div>
);

// Rows spread over a fixed window on an ease-out curve, not a fixed step.
const rowProgress = (
  frame: number,
  i: number,
  n: number,
  start: number,
  window: number,
) => {
  const eased = Easing.out(Easing.cubic)(n === 1 ? 0 : i / (n - 1));
  const delay = start + Math.round(eased * window);
  return interpolate(frame, [delay, delay + 12], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
};

const FeatureScene: React.FC<{
  index: string;
  claim: string;
  detail: string;
  rows: { label: string; value: string; highlight?: boolean }[];
  caption: string;
  entrance: "slide" | "mask" | "cut";
}> = ({ index, claim, detail, rows, caption, entrance }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame, fps, config: smooth, durationInFrames: 24 });

  let titleStyle: React.CSSProperties = {};
  if (entrance === "slide") {
    titleStyle = { transform: `translateX(${(1 - s) * -80}px)`, opacity: s };
  } else if (entrance === "mask") {
    titleStyle = { clipPath: `inset(0 ${(1 - s) * 100}% 0 0)` };
  }

  return (
    <AbsoluteFill style={{ padding: "0 120px" }}>
      <div
        style={{
          display: "flex",
          height: "100%",
          alignItems: "center",
          gap: 24,
        }}
      >
        <div style={{ flex: 5, paddingRight: 48 }}>
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontVariantNumeric: "tabular-nums",
              fontSize: 220,
              lineHeight: 1,
              color: "var(--accent)",
              fontWeight: 500,
            }}
          >
            {index}
          </div>
          <div
            style={{
              ...titleStyle,
              fontFamily: "var(--font-display)",
              fontWeight: 700,
              fontSize: 92,
              lineHeight: 1.05,
              letterSpacing: "-0.02em",
              color: "var(--ink)",
              marginTop: 24,
            }}
          >
            {claim}
          </div>
          <div
            style={{
              fontFamily: "var(--font-text)",
              fontSize: 36,
              lineHeight: 1.45,
              color: "var(--ink)",
              marginTop: 28,
              maxWidth: 760,
              opacity: interpolate(frame, [10, 26], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }),
            }}
          >
            {detail}
          </div>
        </div>
        <div
          style={{
            flex: 6,
            background: "var(--surface)",
            border: "1px solid var(--line)",
            borderRadius: "var(--radius-lg)",
            padding: "32px 48px 24px",
          }}
        >
          {rows.map((r, i) => (
            <Row
              key={r.label}
              label={r.label}
              value={r.value}
              highlight={r.highlight}
              progress={rowProgress(frame, i, rows.length, 8, 22)}
            />
          ))}
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 24,
              color: "var(--ink-2)",
              marginTop: 20,
            }}
          >
            {caption}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

const NameScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: frame - 6, fps, config: smooth, durationInFrames: 30 });
  const scale = interpolate(s, [0, 1], [1.18, 1]);
  const ruleW = interpolate(frame, [18, 48], [0, 100], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  return (
    <AbsoluteFill style={{ justifyContent: "center", padding: "0 120px" }}>
      <div
        style={{
          fontFamily: "var(--font-display)",
          fontWeight: 700,
          fontSize: 300,
          lineHeight: 1.05,
          letterSpacing: "-0.02em",
          color: "var(--ink)",
          transform: `scale(${scale})`,
          transformOrigin: "left center",
          clipPath: `inset(0 ${(1 - s) * 100}% 0 0)`,
        }}
      >
        Ledgerly
      </div>
      <div
        style={{
          height: 6,
          width: `${ruleW}%`,
          background: "var(--accent)",
          marginTop: 24,
        }}
      />
    </AbsoluteFill>
  );
};

const CtaScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame, fps, config: smooth, durationInFrames: 20 });
  const btn = spring({ frame: frame - 18, fps, config: smooth, durationInFrames: 18 });
  return (
    <AbsoluteFill
      style={{ justifyContent: "center", alignItems: "flex-start", padding: "0 120px" }}
    >
      <div
        style={{
          fontFamily: "var(--font-display)",
          fontWeight: 700,
          fontSize: 140,
          lineHeight: 1.05,
          letterSpacing: "-0.02em",
          color: "var(--ink)",
          opacity: s,
          transform: `translateY(${(1 - s) * 40}px)`,
        }}
      >
        Ledgerly
      </div>
      <div
        style={{
          marginTop: 56,
          height: 104,
          padding: "0 56px",
          display: "flex",
          alignItems: "center",
          background: "var(--accent)",
          color: "var(--on-accent)",
          borderRadius: "var(--radius)",
          fontFamily: "var(--font-text)",
          fontWeight: 600,
          fontSize: 48,
          opacity: btn,
          transform: `scale(${interpolate(btn, [0, 1], [0.94, 1])})`,
        }}
      >
        Create your ledger
      </div>
    </AbsoluteFill>
  );
};

export const Launch: React.FC = () => {
  useFonts();

  return (
    <AbsoluteFill style={{ background: "var(--bg)" }}>
      <style>{FONT_CSS}</style>
      <Grid />

      <Sequence from={NAME.from} durationInFrames={NAME.length}>
        <NameScene />
      </Sequence>
      <Sequence from={F1.from} durationInFrames={F1.length}>
        <FeatureScene
          index="01"
          claim="Every entry, reconciled"
          detail="Bank lines match to ledger entries as they arrive."
          caption="Sample data"
          entrance="slide"
          rows={[
            { label: "Office rent", value: "-1,200.00" },
            { label: "Client payment", value: "+4,800.00" },
            { label: "Software", value: "-89.00" },
            { label: "Matched", value: "3 / 3", highlight: true },
          ]}
        />
      </Sequence>
      <Sequence from={F2.from} durationInFrames={F2.length}>
        <FeatureScene
          index="02"
          claim="Invoices that chase themselves"
          detail="Reminders go out on the due date until the invoice is paid."
          caption="Sample data"
          entrance="mask"
          rows={[
            { label: "INV-0041", value: "Paid" },
            { label: "INV-0042", value: "Due in 3 days" },
            { label: "INV-0043", value: "Reminder sent", highlight: true },
          ]}
        />
      </Sequence>
      <Sequence from={F3.from} durationInFrames={F3.length}>
        <FeatureScene
          index="03"
          claim="Month-end in one view"
          detail="Totals, open items and exports sit on one page."
          caption="Sample data"
          entrance="cut"
          rows={[
            { label: "Income", value: "4,800.00" },
            { label: "Expenses", value: "1,289.00" },
            { label: "Net", value: "3,511.00", highlight: true },
          ]}
        />
      </Sequence>
      <Sequence from={CTA.from} durationInFrames={CTA.length}>
        <CtaScene />
      </Sequence>

      {/* Music sits low and fades out over the last second. */}
      <Audio
        src={staticFile("music.mp3")}
        volume={(f) =>
          interpolate(
            f,
            [0, 15, LAUNCH_DURATION - 30, LAUNCH_DURATION],
            [0, 0.3, 0.3, 0],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
          )
        }
      />

      {/* Each sound is placed once, at the moment it matters. */}
      <Sequence from={8} durationInFrames={30}>
        <Audio src={staticFile("sfx/pop.mp3")} volume={0.25} />
      </Sequence>
      <Sequence from={F1.from - 4} durationInFrames={30}>
        <Audio src={staticFile("sfx/whoosh.mp3")} volume={0.2} />
      </Sequence>
      <Sequence from={F2.from + 20} durationInFrames={20}>
        <Audio src={staticFile("sfx/click.mp3")} volume={0.15} />
      </Sequence>
      <Sequence from={CTA.from - 36} durationInFrames={40}>
        <Audio src={staticFile("sfx/riser.mp3")} volume={0.2} />
      </Sequence>
      <Sequence from={CTA.from + 18} durationInFrames={30}>
        <Audio src={staticFile("sfx/pop.mp3")} volume={0.3} playbackRate={1.25} />
      </Sequence>
    </AbsoluteFill>
  );
};
