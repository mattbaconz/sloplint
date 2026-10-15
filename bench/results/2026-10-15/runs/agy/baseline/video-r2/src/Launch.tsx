import React from "react";
import {
  Audio,
  interpolate,
  Sequence,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

const TOKENS = {
  bg: "#080b11",
  surface: "#0f1420",
  raised: "#161c2d",
  subtle: "#1c2438",
  line: "#222d42",
  lineStrong: "#2e3c56",
  ink: "#f8fafc",
  inkMuted: "#94a3b8",
  inkFaint: "#64748b",
  accent: "#00dc82",
  accentHover: "#00c474",
  onAccent: "#042013",
  accentFaint: "rgba(0, 220, 130, 0.12)",
  good: "#10b981",
  goodFaint: "rgba(16, 185, 129, 0.14)",
  warn: "#f59e0b",
  warnFaint: "rgba(245, 158, 11, 0.14)",
  bad: "#ef4444",
  fontSans:
    '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  fontMono:
    '"JetBrains Mono", "Fira Code", ui-monospace, Menlo, Consolas, monospace',
  radiusLg: 16,
  radiusMd: 12,
  radiusSm: 6,
  radiusInner: 4,
};

const SCENE_DURATIONS = {
  intro: 85,
  reconciliation: 115,
  doubleEntry: 105,
  auditTrail: 75,
  cta: 70,
} as const;

export const Launch: React.FC = () => {
  return (
    <div
      style={{
        width: 1920,
        height: 1080,
        backgroundColor: TOKENS.bg,
        color: TOKENS.ink,
        fontFamily: TOKENS.fontSans,
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Background radial gradient glow */}
      <div
        style={{
          position: "absolute",
          top: -200,
          left: 460,
          width: 1000,
          height: 800,
          background:
            "radial-gradient(circle, rgba(0, 220, 130, 0.07) 0%, rgba(8, 11, 17, 0) 70%)",
          pointerEvents: "none",
        }}
      />

      {/* Subtle coordinate grid lines for high-precision fintech feel */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundImage: `linear-gradient(${TOKENS.line} 1px, transparent 1px), linear-gradient(90deg, ${TOKENS.line} 1px, transparent 1px)`,
          backgroundSize: "80px 80px",
          opacity: 0.22,
          pointerEvents: "none",
        }}
      />

      {/* Background Track: public/music.mp3 with ducking and fade out */}
      <Audio
        src={staticFile("music.mp3")}
        volume={(f) =>
          interpolate(f, [0, 25, 415, 450], [0, 0.28, 0.28, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          })
        }
      />

      {/* SFX 1: whoosh.mp3 on Brand Intro reveal */}
      <Sequence from={14} durationInFrames={36}>
        <Audio src={staticFile("sfx/whoosh.mp3")} volume={0.22} />
      </Sequence>

      {/* SFX 2: click.mp3 on Bank Reconciliation match confirmation */}
      <Sequence from={142} durationInFrames={30}>
        <Audio src={staticFile("sfx/click.mp3")} volume={0.18} />
      </Sequence>

      {/* SFX 3: pop.mp3 on Double-Entry zero-delta balance badge */}
      <Sequence from={255} durationInFrames={32}>
        <Audio src={staticFile("sfx/pop.mp3")} volume={0.2} />
      </Sequence>

      {/* SFX 4: riser.mp3 building momentum into closing call to action */}
      <Sequence from={345} durationInFrames={40}>
        <Audio src={staticFile("sfx/riser.mp3")} volume={0.24} />
      </Sequence>

      {/* Persistent Telemetry Instrument Top Bar */}
      <TelemetryTopBar />

      {/* Scene 1: Brand Unveil & Hook (Frames 0 - 85) */}
      <Sequence from={0} durationInFrames={SCENE_DURATIONS.intro}>
        <SceneIntro />
      </Sequence>

      {/* Scene 2: Key Feature 1 - Autonomous Multi-Bank Reconciliation (Frames 85 - 200) */}
      <Sequence
        from={SCENE_DURATIONS.intro}
        durationInFrames={SCENE_DURATIONS.reconciliation}
      >
        <SceneReconciliation />
      </Sequence>

      {/* Scene 3: Key Feature 2 - Real-Time Double-Entry Engine (Frames 200 - 305) */}
      <Sequence
        from={SCENE_DURATIONS.intro + SCENE_DURATIONS.reconciliation}
        durationInFrames={SCENE_DURATIONS.doubleEntry}
      >
        <SceneDoubleEntry />
      </Sequence>

      {/* Scene 4: Key Feature 3 - Cryptographic Merkle Audit Trail (Frames 305 - 380) */}
      <Sequence
        from={
          SCENE_DURATIONS.intro +
          SCENE_DURATIONS.reconciliation +
          SCENE_DURATIONS.doubleEntry
        }
        durationInFrames={SCENE_DURATIONS.auditTrail}
      >
        <SceneAuditTrail />
      </Sequence>

      {/* Scene 5: Closing Call to Action (Frames 380 - 450) */}
      <Sequence
        from={
          SCENE_DURATIONS.intro +
          SCENE_DURATIONS.reconciliation +
          SCENE_DURATIONS.doubleEntry +
          SCENE_DURATIONS.auditTrail
        }
        durationInFrames={SCENE_DURATIONS.cta}
      >
        <SceneCallToAction />
      </Sequence>
    </div>
  );
};

const TelemetryTopBar: React.FC = () => {
  const frame = useCurrentFrame();
  const simulatedMs = String(
    Math.floor(400 + (frame * 13.3) % 600)
  ).padStart(3, "0");
  const liveTps = 18420 + Math.floor((frame * 7) % 85);

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        height: 64,
        padding: "0 48px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        borderBottom: `1px solid ${TOKENS.line}`,
        backgroundColor: "rgba(8, 11, 17, 0.85)",
        backdropFilter: "blur(12px)",
        zIndex: 50,
      }}
    >
      {/* Brand Identity */}
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <div
          style={{
            width: 32,
            height: 32,
            backgroundColor: TOKENS.accent,
            color: TOKENS.onAccent,
            borderRadius: TOKENS.radiusSm,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 800,
            fontSize: 18,
            fontFamily: TOKENS.fontMono,
          }}
        >
          L
        </div>
        <span
          style={{
            fontSize: 18,
            fontWeight: 700,
            letterSpacing: "0.04em",
            color: TOKENS.ink,
          }}
        >
          LEDGERLY
        </span>
        <span
          style={{
            fontSize: 12,
            fontFamily: TOKENS.fontMono,
            fontWeight: 600,
            color: TOKENS.accent,
            padding: "3px 8px",
            backgroundColor: TOKENS.raised,
            border: `1px solid ${TOKENS.line}`,
            borderRadius: TOKENS.radiusInner,
            letterSpacing: "0.06em",
          }}
        >
          CORE v2.4
        </span>
      </div>

      {/* Telemetry Metrics */}
      <div
        className="tabular-nums"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 32,
          fontFamily: TOKENS.fontMono,
          fontSize: 12,
          color: TOKENS.inkMuted,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ color: TOKENS.good }}>●</span>
          <span>CLUSTER 01 // 48 NODES SYNCED</span>
        </div>
        <div>
          <span>LATENCY: </span>
          <span style={{ color: TOKENS.ink, fontWeight: 600 }}>0.34ms p99</span>
        </div>
        <div>
          <span>THROUGHPUT: </span>
          <span style={{ color: TOKENS.accent, fontWeight: 600 }}>
            {liveTps.toLocaleString()} TX/S
          </span>
        </div>
        <div>
          <span>2026-10-15 07:51:10.{simulatedMs} UTC</span>
        </div>
      </div>
    </div>
  );
};

/* =========================================================================
   SCENE 1: Brand Unveil & Hook (Duration: 85 frames / ~2.83s)
   ========================================================================= */
const SceneIntro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const heroSpring = spring({
    frame,
    fps,
    config: { damping: 200, mass: 1, stiffness: 100 },
    overshootClamping: true,
  });

  const heroScale = 0.95 + heroSpring * 0.05;
  const clipWidth = interpolate(frame, [0, 24], [0, 100], {
    extrapolateRight: "clamp",
  });
  const subheadOpacity = interpolate(frame, [22, 38], [0, 1], {
    extrapolateRight: "clamp",
  });

  const liveThroughput = Math.round(
    interpolate(frame, [15, 65], [0, 18450], {
      extrapolateRight: "clamp",
    })
  );

  return (
    <div
      style={{
        position: "absolute",
        top: 64,
        left: 0,
        right: 0,
        bottom: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          width: 1240,
          backgroundColor: TOKENS.surface,
          border: `1px solid ${TOKENS.line}`,
          borderRadius: TOKENS.radiusLg,
          padding: "48px 56px",
          transform: `scale(${heroScale})`,
          clipPath: `inset(0 ${100 - clipWidth}% 0 0)`,
          boxShadow: "0 24px 64px rgba(0, 0, 0, 0.4)",
        }}
      >
        {/* Status header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            paddingBottom: 24,
            borderBottom: `1px solid ${TOKENS.line}`,
          }}
        >
          <div
            style={{
              fontSize: 12,
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: TOKENS.accent,
              fontFamily: TOKENS.fontMono,
            }}
          >
            CONTINUOUS CLOSE INFRASTRUCTURE
          </div>
          <div
            style={{
              fontSize: 12,
              fontFamily: TOKENS.fontMono,
              color: TOKENS.good,
              fontWeight: 600,
            }}
          >
            ● CONSENSUS FINALIZED
          </div>
        </div>

        {/* Brand headline */}
        <div style={{ paddingTop: 36, paddingBottom: 36 }}>
          <h1
            style={{
              fontSize: 72,
              fontWeight: 800,
              letterSpacing: "-0.03em",
              lineHeight: 1.05,
              color: TOKENS.ink,
              margin: 0,
              marginBottom: 16,
            }}
          >
            Ledgerly
          </h1>
          <div
            style={{
              fontSize: 24,
              fontWeight: 500,
              color: TOKENS.inkMuted,
              opacity: subheadOpacity,
              lineHeight: 1.4,
              maxWidth: 900,
            }}
          >
            Autonomous accounting engine for high-velocity financial
            institutions. Close books in hours, not weeks.
          </div>
        </div>

        {/* Live Instrument Panels */}
        <div
          className="tabular-nums"
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: 24,
            paddingTop: 32,
            borderTop: `1px solid ${TOKENS.line}`,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          <div
            style={{
              backgroundColor: TOKENS.raised,
              padding: 24,
              borderRadius: TOKENS.radiusMd,
              border: `1px solid ${TOKENS.line}`,
            }}
          >
            <div
              style={{
                fontSize: 12,
                fontFamily: TOKENS.fontMono,
                color: TOKENS.inkMuted,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                marginBottom: 8,
              }}
            >
              Throughput Engine
            </div>
            <div
              style={{
                fontSize: 34,
                fontWeight: 700,
                fontFamily: TOKENS.fontMono,
                color: TOKENS.accent,
              }}
            >
              {liveThroughput.toLocaleString()} tx/s
            </div>
            <div
              style={{
                fontSize: 12,
                color: TOKENS.inkFaint,
                marginTop: 6,
                fontFamily: TOKENS.fontMono,
              }}
            >
              Sub-millisecond ACID execution
            </div>
          </div>

          <div
            style={{
              backgroundColor: TOKENS.raised,
              padding: 24,
              borderRadius: TOKENS.radiusMd,
              border: `1px solid ${TOKENS.line}`,
            }}
          >
            <div
              style={{
                fontSize: 12,
                fontFamily: TOKENS.fontMono,
                color: TOKENS.inkMuted,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                marginBottom: 8,
              }}
            >
              Settlement Latency
            </div>
            <div
              style={{
                fontSize: 34,
                fontWeight: 700,
                fontFamily: TOKENS.fontMono,
                color: TOKENS.ink,
              }}
            >
              0.34ms p99
            </div>
            <div
              style={{
                fontSize: 12,
                color: TOKENS.inkFaint,
                marginTop: 6,
                fontFamily: TOKENS.fontMono,
              }}
            >
              Direct memory ledger journal
            </div>
          </div>

          <div
            style={{
              backgroundColor: TOKENS.raised,
              padding: 24,
              borderRadius: TOKENS.radiusMd,
              border: `1px solid ${TOKENS.line}`,
            }}
          >
            <div
              style={{
                fontSize: 12,
                fontFamily: TOKENS.fontMono,
                color: TOKENS.inkMuted,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                marginBottom: 8,
              }}
            >
              Balance Invariance
            </div>
            <div
              style={{
                fontSize: 34,
                fontWeight: 700,
                fontFamily: TOKENS.fontMono,
                color: TOKENS.good,
              }}
            >
              Δ 0.0000 USD
            </div>
            <div
              style={{
                fontSize: 12,
                color: TOKENS.good,
                marginTop: 6,
                fontFamily: TOKENS.fontMono,
                fontWeight: 600,
              }}
            >
              ● Mathematical balance proof
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/* =========================================================================
   SCENE 2: Feature 1 - Autonomous Multi-Bank Reconciliation (Frames 85 - 200)
   ========================================================================= */
const RECON_ROWS = [
  {
    bank: "JPMorgan Chase Treasury",
    txId: "WIRE-89421",
    amount: "$450,000.00",
    matchedTarget: "INV-2026-9042",
    rate: "100.0%",
  },
  {
    bank: "Stripe Connect Settlement",
    txId: "PO-77124",
    amount: "$184,250.30",
    matchedTarget: "BATCH-SETTLE-44",
    rate: "100.0%",
  },
  {
    bank: "Silicon Valley Bank",
    txId: "ACH-33910",
    amount: "$98,500.00",
    matchedTarget: "PR-OCT-029",
    rate: "100.0%",
  },
  {
    bank: "Bank of America Clearing",
    txId: "WIRE-55208",
    amount: "$36,740.00",
    matchedTarget: "AP-VEND-108",
    rate: "99.8%",
  },
];

const SceneReconciliation: React.FC = () => {
  const frame = useCurrentFrame();

  const containerSlide = interpolate(frame, [0, 24], [28, 0], {
    extrapolateRight: "clamp",
  });
  const opacity = interpolate(frame, [0, 16], [0, 1], {
    extrapolateRight: "clamp",
  });

  const isConfirmed = frame >= 57; // At frame 142 globally

  return (
    <div
      style={{
        position: "absolute",
        top: 64,
        left: 0,
        right: 0,
        bottom: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        opacity,
        transform: `translateY(${containerSlide}px)`,
      }}
    >
      <div
        style={{
          width: 1440,
          backgroundColor: TOKENS.surface,
          border: `1px solid ${TOKENS.line}`,
          borderRadius: TOKENS.radiusLg,
          padding: 44,
          boxShadow: "0 24px 64px rgba(0, 0, 0, 0.4)",
        }}
      >
        {/* Section Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            paddingBottom: 24,
            borderBottom: `1px solid ${TOKENS.line}`,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 12,
                fontFamily: TOKENS.fontMono,
                color: TOKENS.accent,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                fontWeight: 600,
                marginBottom: 6,
              }}
            >
              KEY FEATURE 01 // DATA SYNC & MATCHING
            </div>
            <div
              style={{
                fontSize: 32,
                fontWeight: 700,
                color: TOKENS.ink,
                letterSpacing: "-0.02em",
              }}
            >
              Autonomous Multi-Bank Reconciliation
            </div>
          </div>

          <div
            className="tabular-nums"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
              fontFamily: TOKENS.fontMono,
              fontSize: 12,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            <div
              style={{
                backgroundColor: TOKENS.raised,
                padding: "8px 18px",
                borderRadius: TOKENS.radiusSm,
                border: `1px solid ${TOKENS.line}`,
              }}
            >
              <span style={{ color: TOKENS.inkMuted }}>MATCH ACCURACY: </span>
              <span style={{ color: TOKENS.accent, fontWeight: 700 }}>
                99.8%
              </span>
            </div>
            <div
              style={{
                backgroundColor: isConfirmed
                  ? TOKENS.goodFaint
                  : TOKENS.raised,
                padding: "8px 18px",
                borderRadius: TOKENS.radiusSm,
                border: `1px solid ${isConfirmed ? TOKENS.good : TOKENS.line}`,
              }}
            >
              <span style={{ color: isConfirmed ? TOKENS.good : TOKENS.warn }}>
                {isConfirmed ? "● ALL FEEDS RECONCILED" : "○ SYNCING INBOUND FEEDS"}
              </span>
            </div>
          </div>
        </div>

        {/* Content Body: Split View with Stat highlight and Live Feed */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "380px 1fr",
            gap: 32,
            marginTop: 28,
          }}
        >
          {/* Left card: Metric & Protocols */}
          <div
            style={{
              backgroundColor: TOKENS.raised,
              borderRadius: TOKENS.radiusMd,
              border: `1px solid ${TOKENS.line}`,
              padding: 28,
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 12,
                  fontFamily: TOKENS.fontMono,
                  color: TOKENS.inkMuted,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  marginBottom: 8,
                }}
              >
                Straight-Through Match Rate
              </div>
              <div
                className="tabular-nums"
                style={{
                  fontSize: 56,
                  fontWeight: 800,
                  fontFamily: TOKENS.fontMono,
                  color: TOKENS.accent,
                  lineHeight: 1.1,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                99.8%
              </div>
              <p
                style={{
                  fontSize: 14,
                  color: TOKENS.inkMuted,
                  lineHeight: 1.5,
                  marginTop: 12,
                }}
              >
                Eliminate manual month-end spreadsheets. Real-time matching
                against ERP invoices and treasury schedules.
              </p>
            </div>

            <div
              style={{
                borderTop: `1px solid ${TOKENS.line}`,
                paddingTop: 20,
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontFamily: TOKENS.fontMono,
                  color: TOKENS.inkFaint,
                  textTransform: "uppercase",
                  marginBottom: 10,
                  letterSpacing: "0.05em",
                }}
              >
                Supported Clearing Gateways
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {["Fedwire", "SWIFT ISO 20022", "Plaid Direct", "Stripe Connect"].map(
                  (badge) => (
                    <span
                      key={badge}
                      style={{
                        fontSize: 11,
                        fontFamily: TOKENS.fontMono,
                        color: TOKENS.ink,
                        backgroundColor: TOKENS.subtle,
                        padding: "4px 10px",
                        borderRadius: TOKENS.radiusInner,
                      }}
                    >
                      {badge}
                    </span>
                  )
                )}
              </div>
            </div>
          </div>

          {/* Right card: Live Ingest Table */}
          <div
            className="tabular-nums"
            style={{
              backgroundColor: TOKENS.raised,
              borderRadius: TOKENS.radiusMd,
              border: `1px solid ${TOKENS.line}`,
              padding: 24,
              fontFamily: TOKENS.fontMono,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {/* Table Header */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1.4fr 1fr 1fr 1.2fr 100px",
                padding: "8px 16px",
                backgroundColor: TOKENS.subtle,
                borderRadius: TOKENS.radiusSm,
                color: TOKENS.inkMuted,
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
              }}
            >
              <div>Clearing Source</div>
              <div>Transaction ID</div>
              <div style={{ textAlign: "right" }}>Amount</div>
              <div>Matched ERP Target</div>
              <div style={{ textAlign: "right" }}>Match</div>
            </div>

            {/* Rows */}
            {RECON_ROWS.map((row, idx) => {
              const rowDelay = idx * 10;
              const isRowVisible = frame >= rowDelay;
              const rowSlide = interpolate(
                frame,
                [rowDelay, rowDelay + 14],
                [-10, 0],
                { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
              );

              return (
                <div
                  key={row.txId}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1.4fr 1fr 1fr 1.2fr 100px",
                    padding: "13px 16px",
                    borderTop: `1px solid ${TOKENS.line}`,
                    fontSize: 13,
                    opacity: isRowVisible ? 1 : 0,
                    transform: `translateX(${rowSlide}px)`,
                    color: TOKENS.ink,
                  }}
                >
                  <div style={{ fontWeight: 600 }}>{row.bank}</div>
                  <div style={{ color: TOKENS.inkMuted }}>{row.txId}</div>
                  <div style={{ textAlign: "right", fontWeight: 600 }}>
                    {row.amount}
                  </div>
                  <div style={{ color: TOKENS.accent }}>{row.matchedTarget}</div>
                  <div
                    style={{
                      textAlign: "right",
                      color: TOKENS.good,
                      fontWeight: 700,
                    }}
                  >
                    ● {row.rate}
                  </div>
                </div>
              );
            })}

            {/* Reconciliation Confirmation Footer Bar */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "14px 18px",
                marginTop: 16,
                backgroundColor: isConfirmed
                  ? TOKENS.goodFaint
                  : TOKENS.subtle,
                border: `1px solid ${
                  isConfirmed ? TOKENS.good : TOKENS.line
                }`,
                borderRadius: TOKENS.radiusSm,
                fontSize: 12,
              }}
            >
              <div style={{ display: "flex", gap: 24 }}>
                <span>
                  <strong style={{ color: TOKENS.inkMuted }}>
                    TOTAL PROCESSED:{" "}
                  </strong>
                  <span>$769,490.30 USD</span>
                </span>
                <span>
                  <strong style={{ color: TOKENS.inkMuted }}>
                    UNRECONCILED DELTA:{" "}
                  </strong>
                  <span style={{ color: TOKENS.good, fontWeight: 700 }}>
                    0.00 USD
                  </span>
                </span>
              </div>
              <div
                style={{
                  color: isConfirmed ? TOKENS.good : TOKENS.inkMuted,
                  fontWeight: 700,
                  letterSpacing: "0.06em",
                }}
              >
                {isConfirmed
                  ? "✓ AUTOMATED BATCH RECONCILIATION CONFIRMED"
                  : "CALCULATING LEDGER SYNC..."}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/* =========================================================================
   SCENE 3: Feature 2 - Real-Time Double-Entry Engine (Frames 200 - 305)
   ========================================================================= */
const JOURNAL_ENTRIES = [
  {
    code: "1010",
    account: "Operating Cash (Chase Treasury USD)",
    debit: "$384,500.00",
    credit: "$0.00",
    status: "COMMITTED",
  },
  {
    code: "2010",
    account: "Accounts Payable Clearing (USD)",
    debit: "$0.00",
    credit: "$384,500.00",
    status: "COMMITTED",
  },
  {
    code: "1040",
    account: "Euro Treasury Liquidity (EUR)",
    debit: "€165,000.00",
    credit: "€0.00",
    status: "COMMITTED",
  },
  {
    code: "2040",
    account: "FX Treasury Hedging Reserve (EUR)",
    debit: "€0.00",
    credit: "€165,000.00",
    status: "COMMITTED",
  },
];

const SceneDoubleEntry: React.FC = () => {
  const frame = useCurrentFrame();

  const containerSlide = interpolate(frame, [0, 24], [28, 0], {
    extrapolateRight: "clamp",
  });
  const opacity = interpolate(frame, [0, 16], [0, 1], {
    extrapolateRight: "clamp",
  });

  const isZeroDeltaVerified = frame >= 55; // At frame 255 globally

  return (
    <div
      style={{
        position: "absolute",
        top: 64,
        left: 0,
        right: 0,
        bottom: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        opacity,
        transform: `translateY(${containerSlide}px)`,
      }}
    >
      <div
        style={{
          width: 1440,
          backgroundColor: TOKENS.surface,
          border: `1px solid ${TOKENS.line}`,
          borderRadius: TOKENS.radiusLg,
          padding: 44,
          boxShadow: "0 24px 64px rgba(0, 0, 0, 0.4)",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            paddingBottom: 24,
            borderBottom: `1px solid ${TOKENS.line}`,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 12,
                fontFamily: TOKENS.fontMono,
                color: TOKENS.accent,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                fontWeight: 600,
                marginBottom: 6,
              }}
            >
              KEY FEATURE 02 // ATOMIC TRANSACTION INTEGRITY
            </div>
            <div
              style={{
                fontSize: 32,
                fontWeight: 700,
                color: TOKENS.ink,
                letterSpacing: "-0.02em",
              }}
            >
              Real-Time Double-Entry Engine
            </div>
          </div>

          <div
            className="tabular-nums"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
              fontFamily: TOKENS.fontMono,
              fontSize: 12,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            <div
              style={{
                backgroundColor: TOKENS.raised,
                padding: "8px 18px",
                borderRadius: TOKENS.radiusSm,
                border: `1px solid ${TOKENS.line}`,
              }}
            >
              <span style={{ color: TOKENS.inkMuted }}>POSTING SPEED: </span>
              <span style={{ color: TOKENS.ink, fontWeight: 700 }}>0.34ms</span>
            </div>
            <div
              style={{
                backgroundColor: TOKENS.raised,
                padding: "8px 18px",
                borderRadius: TOKENS.radiusSm,
                border: `1px solid ${TOKENS.line}`,
              }}
            >
              <span style={{ color: TOKENS.inkMuted }}>CONCURRENCY: </span>
              <span style={{ color: TOKENS.accent, fontWeight: 700 }}>
                18,450 TX/S
              </span>
            </div>
          </div>
        </div>

        {/* Live Journal Entry Ledger Table */}
        <div
          className="tabular-nums"
          style={{
            marginTop: 28,
            backgroundColor: TOKENS.raised,
            borderRadius: TOKENS.radiusMd,
            border: `1px solid ${TOKENS.line}`,
            padding: 24,
            fontFamily: TOKENS.fontMono,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {/* Voucher Info */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              paddingBottom: 16,
              borderBottom: `1px solid ${TOKENS.line}`,
              fontSize: 12,
            }}
          >
            <span style={{ color: TOKENS.accent, fontWeight: 700 }}>
              JOURNAL VOUCHER: #JV-2026-88401 (MULTI-CURRENCY PARALLEL POST)
            </span>
            <span style={{ color: TOKENS.inkMuted }}>
              ISOLATION LEVEL: SERIALIZABLE ACID
            </span>
          </div>

          {/* Table Headers */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "100px 1fr 180px 180px 140px",
              padding: "10px 16px",
              marginTop: 14,
              backgroundColor: TOKENS.subtle,
              borderRadius: TOKENS.radiusSm,
              color: TOKENS.inkMuted,
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
            }}
          >
            <div>Account</div>
            <div>Account Description</div>
            <div style={{ textAlign: "right" }}>Debit</div>
            <div style={{ textAlign: "right" }}>Credit</div>
            <div style={{ textAlign: "right" }}>Status</div>
          </div>

          {/* Entry Rows */}
          {JOURNAL_ENTRIES.map((entry, idx) => {
            const rowDelay = idx * 9;
            const isVisible = frame >= rowDelay;
            const rowSlide = interpolate(
              frame,
              [rowDelay, rowDelay + 14],
              [-10, 0],
              { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
            );

            return (
              <div
                key={entry.code}
                style={{
                  display: "grid",
                  gridTemplateColumns: "100px 1fr 180px 180px 140px",
                  padding: "14px 16px",
                  borderTop: `1px solid ${TOKENS.line}`,
                  fontSize: 13,
                  opacity: isVisible ? 1 : 0,
                  transform: `translateX(${rowSlide}px)`,
                  color: TOKENS.ink,
                }}
              >
                <div style={{ color: TOKENS.accent, fontWeight: 700 }}>
                  {entry.code}
                </div>
                <div style={{ fontWeight: 500 }}>{entry.account}</div>
                <div style={{ textAlign: "right", fontWeight: 600 }}>
                  {entry.debit}
                </div>
                <div style={{ textAlign: "right", fontWeight: 600 }}>
                  {entry.credit}
                </div>
                <div
                  style={{
                    textAlign: "right",
                    color: TOKENS.good,
                    fontWeight: 700,
                  }}
                >
                  ● {entry.status}
                </div>
              </div>
            );
          })}

          {/* Strict Mathematical Zero-Delta Verification Bar */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "16px 20px",
              marginTop: 18,
              borderTop: `1px solid ${TOKENS.line}`,
              backgroundColor: isZeroDeltaVerified
                ? TOKENS.goodFaint
                : TOKENS.subtle,
              border: `1px solid ${
                isZeroDeltaVerified ? TOKENS.good : TOKENS.line
              }`,
              borderRadius: TOKENS.radiusSm,
            }}
          >
            <div style={{ display: "flex", gap: 32, fontSize: 13 }}>
              <span>
                <strong style={{ color: TOKENS.inkMuted }}>
                  SUM OF DEBITS:{" "}
                </strong>
                <span>$384,500.00 / €165,000.00</span>
              </span>
              <span>
                <strong style={{ color: TOKENS.inkMuted }}>
                  SUM OF CREDITS:{" "}
                </strong>
                <span>$384,500.00 / €165,000.00</span>
              </span>
              <span>
                <strong style={{ color: TOKENS.inkMuted }}>
                  VARIANCE DELTA:{" "}
                </strong>
                <span style={{ color: TOKENS.good, fontWeight: 800 }}>
                  0.00000000 (EXACT ZERO)
                </span>
              </span>
            </div>

            <div
              style={{
                color: isZeroDeltaVerified ? TOKENS.good : TOKENS.inkMuted,
                fontWeight: 700,
                fontSize: 12,
                letterSpacing: "0.06em",
              }}
            >
              {isZeroDeltaVerified
                ? "✓ MATHEMATICAL ZERO-DELTA INVARIANT VERIFIED"
                : "VALIDATING JOURNAL CLOSURE..."}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/* =========================================================================
   SCENE 4: Feature 3 - Cryptographic Merkle Audit Trail (Frames 305 - 380)
   ========================================================================= */
const SceneAuditTrail: React.FC = () => {
  const frame = useCurrentFrame();

  const containerSlide = interpolate(frame, [0, 20], [24, 0], {
    extrapolateRight: "clamp",
  });
  const opacity = interpolate(frame, [0, 14], [0, 1], {
    extrapolateRight: "clamp",
  });

  const verifiedTick = frame >= 24;

  return (
    <div
      style={{
        position: "absolute",
        top: 64,
        left: 0,
        right: 0,
        bottom: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        opacity,
        transform: `translateY(${containerSlide}px)`,
      }}
    >
      <div
        style={{
          width: 1440,
          backgroundColor: TOKENS.surface,
          border: `1px solid ${TOKENS.line}`,
          borderRadius: TOKENS.radiusLg,
          padding: 44,
          boxShadow: "0 24px 64px rgba(0, 0, 0, 0.4)",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            paddingBottom: 24,
            borderBottom: `1px solid ${TOKENS.line}`,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 12,
                fontFamily: TOKENS.fontMono,
                color: TOKENS.accent,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                fontWeight: 600,
                marginBottom: 6,
              }}
            >
              KEY FEATURE 03 // COMPLIANCE & PROOF
            </div>
            <div
              style={{
                fontSize: 32,
                fontWeight: 700,
                color: TOKENS.ink,
                letterSpacing: "-0.02em",
              }}
            >
              Cryptographic Merkle Audit Trail
            </div>
          </div>

          <div
            className="tabular-nums"
            style={{
              backgroundColor: verifiedTick
                ? TOKENS.goodFaint
                : TOKENS.raised,
              border: `1px solid ${verifiedTick ? TOKENS.good : TOKENS.line}`,
              padding: "8px 18px",
              borderRadius: TOKENS.radiusSm,
              fontSize: 12,
              fontFamily: TOKENS.fontMono,
              color: verifiedTick ? TOKENS.good : TOKENS.warn,
              fontWeight: 700,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {verifiedTick
              ? "● MERKLE ROOT FINALIZED & SEALED"
              : "○ VALIDATING LEAF HASHES"}
          </div>
        </div>

        {/* Content Columns */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.2fr 1fr",
            gap: 32,
            marginTop: 28,
          }}
        >
          {/* Merkle Root Hash Box */}
          <div
            className="tabular-nums"
            style={{
              backgroundColor: TOKENS.raised,
              borderRadius: TOKENS.radiusMd,
              border: `1px solid ${TOKENS.line}`,
              padding: 28,
              fontFamily: TOKENS.fontMono,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            <div
              style={{
                fontSize: 12,
                color: TOKENS.inkMuted,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                marginBottom: 10,
              }}
            >
              Current State Merkle Root Hash
            </div>
            <div
              style={{
                fontSize: 15,
                fontWeight: 600,
                color: TOKENS.accent,
                backgroundColor: TOKENS.subtle,
                padding: "14px 18px",
                borderRadius: TOKENS.radiusSm,
                border: `1px solid ${TOKENS.line}`,
                wordBreak: "break-all",
                marginBottom: 20,
              }}
            >
              sha256:7f9a2b41c08d13268e3c8149e917d2a5b6f38d10427382109ce4a091
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 16,
              }}
            >
              <div
                style={{
                  backgroundColor: TOKENS.subtle,
                  padding: 16,
                  borderRadius: TOKENS.radiusSm,
                }}
              >
                <div style={{ fontSize: 11, color: TOKENS.inkMuted }}>
                  BLOCK HEIGHT
                </div>
                <div
                  style={{
                    fontSize: 18,
                    fontWeight: 700,
                    color: TOKENS.ink,
                    marginTop: 4,
                  }}
                >
                  #4,891,204
                </div>
              </div>
              <div
                style={{
                  backgroundColor: TOKENS.subtle,
                  padding: 16,
                  borderRadius: TOKENS.radiusSm,
                }}
              >
                <div style={{ fontSize: 11, color: TOKENS.inkMuted }}>
                  SIGNATURE SCHEME
                </div>
                <div
                  style={{
                    fontSize: 18,
                    fontWeight: 700,
                    color: TOKENS.ink,
                    marginTop: 4,
                  }}
                >
                  Ed25519-SHA512
                </div>
              </div>
            </div>
          </div>

          {/* Pillars of Compliance */}
          <div
            style={{
              backgroundColor: TOKENS.raised,
              borderRadius: TOKENS.radiusMd,
              border: `1px solid ${TOKENS.line}`,
              padding: 28,
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
            }}
          >
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 18,
              }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
                <div
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: "50%",
                    backgroundColor: TOKENS.goodFaint,
                    color: TOKENS.good,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 12,
                    fontWeight: 800,
                    flexShrink: 0,
                  }}
                >
                  ✓
                </div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: TOKENS.ink }}>
                    Append-Only Write-Once Log
                  </div>
                  <div style={{ fontSize: 13, color: TOKENS.inkMuted, marginTop: 2 }}>
                    Tamper-evident entries prevent backdating and unauthorized rewrites.
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
                <div
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: "50%",
                    backgroundColor: TOKENS.goodFaint,
                    color: TOKENS.good,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 12,
                    fontWeight: 800,
                    flexShrink: 0,
                  }}
                >
                  ✓
                </div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: TOKENS.ink }}>
                    One-Click Auditor Data Room Export
                  </div>
                  <div style={{ fontSize: 13, color: TOKENS.inkMuted, marginTop: 2 }}>
                    Instant cryptographic proof package exportable for Big 4 auditors.
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
                <div
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: "50%",
                    backgroundColor: TOKENS.goodFaint,
                    color: TOKENS.good,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 12,
                    fontWeight: 800,
                    flexShrink: 0,
                  }}
                >
                  ✓
                </div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: TOKENS.ink }}>
                    Continuous US-GAAP & IFRS Alignment
                  </div>
                  <div style={{ fontSize: 13, color: TOKENS.inkMuted, marginTop: 2 }}>
                    Continuous financial close eliminates month-end crunch cycles.
                  </div>
                </div>
              </div>
            </div>

            <div
              style={{
                fontFamily: TOKENS.fontMono,
                fontSize: 12,
                color: TOKENS.good,
                fontWeight: 600,
                borderTop: `1px solid ${TOKENS.line}`,
                paddingTop: 16,
              }}
            >
              ● SOC 1 & SOC 2 TYPE II CERTIFICATION READY
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/* =========================================================================
   SCENE 5: Closing Call to Action (Duration: 70 frames / ~2.33s)
   ========================================================================= */
const SceneCallToAction: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const buttonSpring = spring({
    frame: Math.max(0, frame - 10),
    fps,
    config: { damping: 200, mass: 1, stiffness: 100 },
    overshootClamping: true,
  });

  const buttonOpacity = interpolate(frame, [10, 24], [0, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        position: "absolute",
        top: 64,
        left: 0,
        right: 0,
        bottom: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          width: 1080,
          backgroundColor: TOKENS.surface,
          border: `1px solid ${TOKENS.line}`,
          borderRadius: TOKENS.radiusLg,
          padding: "54px 64px",
          textAlign: "center",
          boxShadow: "0 24px 64px rgba(0, 0, 0, 0.4)",
        }}
      >
        <div
          style={{
            fontSize: 12,
            fontFamily: TOKENS.fontMono,
            fontWeight: 700,
            color: TOKENS.accent,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            marginBottom: 14,
          }}
        >
          ENTERPRISE-GRADE FINANCIAL PLATFORM
        </div>

        <h1
          style={{
            fontSize: 64,
            fontWeight: 800,
            letterSpacing: "-0.03em",
            color: TOKENS.ink,
            margin: 0,
            marginBottom: 16,
          }}
        >
          Ledgerly
        </h1>

        <div
          style={{
            fontSize: 22,
            fontWeight: 500,
            color: TOKENS.inkMuted,
            marginBottom: 36,
          }}
        >
          Close your books in hours, not weeks.
        </div>

        {/* Quick-Start Terminal Install Bar */}
        <div
          className="tabular-nums"
          style={{
            backgroundColor: TOKENS.bg,
            border: `1px solid ${TOKENS.line}`,
            borderRadius: TOKENS.radiusSm,
            padding: "16px 24px",
            fontFamily: TOKENS.fontMono,
            fontSize: 15,
            color: TOKENS.accent,
            textAlign: "left",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 36,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          <span>$ curl -fsSL https://ledgerly.io/install.sh | sh</span>
          <span
            style={{
              fontSize: 12,
              color: TOKENS.inkMuted,
            }}
          >
            v2.4.0 (Latest Release)
          </span>
        </div>

        {/* Action Buttons */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 20,
            opacity: buttonOpacity,
            transform: `scale(${0.96 + buttonSpring * 0.04})`,
          }}
        >
          <button
            type="button"
            style={{
              height: 48,
              padding: "0 32px",
              backgroundColor: TOKENS.accent,
              color: TOKENS.onAccent,
              border: "none",
              borderRadius: TOKENS.radiusSm,
              fontWeight: 700,
              fontSize: 15,
              fontFamily: TOKENS.fontSans,
              cursor: "pointer",
            }}
          >
            Start 14-Day Free Trial
          </button>
          <button
            type="button"
            style={{
              height: 48,
              padding: "0 28px",
              backgroundColor: TOKENS.raised,
              color: TOKENS.ink,
              border: `1px solid ${TOKENS.line}`,
              borderRadius: TOKENS.radiusSm,
              fontWeight: 600,
              fontSize: 15,
              fontFamily: TOKENS.fontSans,
              cursor: "pointer",
            }}
          >
            Schedule Enterprise Demo
          </button>
        </div>

        {/* Trust Badges */}
        <div
          className="tabular-nums"
          style={{
            marginTop: 36,
            paddingTop: 24,
            borderTop: `1px solid ${TOKENS.line}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 32,
            fontFamily: TOKENS.fontMono,
            fontSize: 12,
            color: TOKENS.inkFaint,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          <span style={{ color: TOKENS.inkMuted, fontWeight: 600 }}>
            ledgerly.io
          </span>
          <span>●</span>
          <span>SOC 2 TYPE II CERTIFIED</span>
          <span>●</span>
          <span>ISO 27001 & ISO 20022 READY</span>
          <span>●</span>
          <span>DOCUMENTATION: docs.ledgerly.io</span>
        </div>
      </div>
    </div>
  );
};

export default Launch;
