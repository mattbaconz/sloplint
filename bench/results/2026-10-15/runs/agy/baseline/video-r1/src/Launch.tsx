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
  bg: "#0e0f11",
  surface: "#15171a",
  raised: "#1c1f23",
  line: "#2a2e34",
  ink: "#e8e6e1",
  ink2: "#9a9ea6",
  accent: "#f2a33a",
  onAccent: "#1a1206",
  good: "#5fbf8f",
  warn: "#e6c15a",
  bad: "#ef6b5b",
  fontBody: '"IBM Plex Sans", system-ui, sans-serif',
  fontMono: '"IBM Plex Mono", ui-monospace, monospace',
  radius: 6,
  radiusInner: 2,
};

const SCENE_DURATIONS = [90, 120, 135, 105] as const;

export const Launch: React.FC = () => {
  return (
    <div
      style={{
        width: 1920,
        height: 1080,
        backgroundColor: TOKENS.bg,
        color: TOKENS.ink,
        fontFamily: TOKENS.fontBody,
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Background Music: mixed at 0.28 with smooth fade in and out */}
      <Audio
        src={staticFile("music.mp3")}
        volume={(f) =>
          interpolate(f, [0, 25, 415, 450], [0, 0.28, 0.28, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          })
        }
      />

      {/* SFX 1: Whoosh on Scene 1 Product Reveal */}
      <Sequence from={14} durationInFrames={36}>
        <Audio src={staticFile("sfx/whoosh.mp3")} volume={0.22} />
      </Sequence>

      {/* SFX 2: Click on Scene 2 Transaction Commit */}
      <Sequence from={142} durationInFrames={28}>
        <Audio src={staticFile("sfx/click.mp3")} volume={0.16} />
      </Sequence>

      {/* SFX 3: Pop on Scene 3 Merkle Verification Badge */}
      <Sequence from={258} durationInFrames={32}>
        <Audio src={staticFile("sfx/pop.mp3")} volume={0.18} />
      </Sequence>

      {/* SFX 4: Riser building into Final Call to Action */}
      <Sequence from={312} durationInFrames={33}>
        <Audio src={staticFile("sfx/riser.mp3")} volume={0.2} />
      </Sequence>

      {/* Global Top Instrument Bar */}
      <TelemetryTopBar />

      {/* Scene 1: Product Intro & Hook (Duration: 90 frames / 3.0s) */}
      <Sequence from={0} durationInFrames={SCENE_DURATIONS[0]}>
        <SceneIntro />
      </Sequence>

      {/* Scene 2: Feature 1 - Real-Time Double-Entry Ledger (Duration: 120 frames / 4.0s) */}
      <Sequence
        from={SCENE_DURATIONS[0]}
        durationInFrames={SCENE_DURATIONS[1]}
      >
        <SceneFeatureLedger />
      </Sequence>

      {/* Scene 3: Feature 2 & 3 - Multi-Bank Reconciliation & Cryptographic Audit Stream (Duration: 135 frames / 4.5s) */}
      <Sequence
        from={SCENE_DURATIONS[0] + SCENE_DURATIONS[1]}
        durationInFrames={SCENE_DURATIONS[2]}
      >
        <SceneFeatureReconciliationAndAudit />
      </Sequence>

      {/* Scene 4: Closing Call to Action (Duration: 105 frames / 3.5s) */}
      <Sequence
        from={
          SCENE_DURATIONS[0] + SCENE_DURATIONS[1] + SCENE_DURATIONS[2]
        }
        durationInFrames={SCENE_DURATIONS[3]}
      >
        <SceneCallToAction />
      </Sequence>
    </div>
  );
};

const TelemetryTopBar: React.FC = () => {
  const frame = useCurrentFrame();
  const simulatedMs = Math.floor(480 + (frame * 16.6) % 500);

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
        backgroundColor: TOKENS.bg,
        zIndex: 50,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <div
          style={{
            width: 28,
            height: 28,
            backgroundColor: TOKENS.accent,
            color: TOKENS.onAccent,
            borderRadius: TOKENS.radiusInner,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 700,
            fontSize: 16,
            fontFamily: TOKENS.fontMono,
          }}
        >
          L
        </div>
        <span
          style={{
            fontSize: 18,
            fontWeight: 600,
            letterSpacing: "0.06em",
            color: TOKENS.ink,
          }}
        >
          LEDGERLY
        </span>
        <span
          style={{
            fontSize: 12,
            fontFamily: TOKENS.fontMono,
            fontWeight: 500,
            color: TOKENS.ink2,
            padding: "2px 8px",
            backgroundColor: TOKENS.raised,
            borderRadius: TOKENS.radiusInner,
            letterSpacing: "0.06em",
          }}
        >
          CORE v2.4
        </span>
      </div>

      <div
        className="tabular-nums"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 32,
          fontFamily: TOKENS.fontMono,
          fontSize: 12,
          color: TOKENS.ink2,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ color: TOKENS.good }}>●</span>
          <span>CLUSTER 01 // 40 NODES ONLINE</span>
        </div>
        <div>
          <span>LATENCY: </span>
          <span style={{ color: TOKENS.ink }}>0.38ms</span>
        </div>
        <div>
          <span>THROUGHPUT: </span>
          <span style={{ color: TOKENS.accent }}>14,280 TX/S</span>
        </div>
        <div>
          <span>2026-10-14 22:23:03.{simulatedMs} UTC</span>
        </div>
      </div>
    </div>
  );
};

const SceneIntro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const heroSpring = spring({
    frame,
    fps,
    config: { damping: 200, mass: 1, stiffness: 100 },
    overshootClamping: true,
  });

  const heroScale = 0.94 + heroSpring * 0.06;
  const clipWidth = interpolate(frame, [0, 22], [0, 100], {
    extrapolateRight: "clamp",
  });
  const textArrive = interpolate(frame, [25, 37], [0, 1], {
    extrapolateRight: "clamp",
  });

  const liveThroughput = Math.round(
    interpolate(frame, [15, 65], [0, 14280], {
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
          width: 1120,
          backgroundColor: TOKENS.surface,
          border: `1px solid ${TOKENS.line}`,
          borderRadius: TOKENS.radius,
          padding: 48,
          transform: `scale(${heroScale})`,
          clipPath: `inset(0 ${100 - clipWidth}% 0 0)`,
        }}
      >
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
              fontWeight: 500,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              color: TOKENS.ink2,
              fontFamily: TOKENS.fontMono,
            }}
          >
            INSTRUMENT PANEL // FINANCIAL PROTOCOL DAEMON
          </div>
          <div
            style={{
              fontSize: 12,
              fontFamily: TOKENS.fontMono,
              color: TOKENS.good,
            }}
          >
            ● CONSENSUS NOMINAL
          </div>
        </div>

        <div style={{ paddingTop: 36, paddingBottom: 36 }}>
          <div
            style={{
              fontSize: 14,
              fontFamily: TOKENS.fontMono,
              color: TOKENS.accent,
              letterSpacing: "0.08em",
              marginBottom: 12,
            }}
          >
            IMMUTABLE ACCOUNTING INFRASTRUCTURE
          </div>
          <div
            style={{
              fontSize: 40,
              fontWeight: 600,
              lineHeight: 1.15,
              color: TOKENS.ink,
              marginBottom: 16,
            }}
          >
            Ledgerly
          </div>
          <div
            style={{
              fontSize: 20,
              fontWeight: 600,
              color: TOKENS.ink,
              opacity: textArrive,
            }}
          >
            Programmable double-entry financial engine for high-volume transactions.
          </div>
        </div>

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
              padding: 20,
              borderRadius: TOKENS.radiusInner,
            }}
          >
            <div
              style={{
                fontSize: 12,
                fontFamily: TOKENS.fontMono,
                color: TOKENS.ink2,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                marginBottom: 8,
              }}
            >
              Throughput
            </div>
            <div
              style={{
                fontSize: 28,
                fontWeight: 600,
                fontFamily: TOKENS.fontMono,
                color: TOKENS.accent,
              }}
            >
              {liveThroughput.toLocaleString()} tx/s
            </div>
          </div>

          <div
            style={{
              backgroundColor: TOKENS.raised,
              padding: 20,
              borderRadius: TOKENS.radiusInner,
            }}
          >
            <div
              style={{
                fontSize: 12,
                fontFamily: TOKENS.fontMono,
                color: TOKENS.ink2,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                marginBottom: 8,
              }}
            >
              Settlement Latency
            </div>
            <div
              style={{
                fontSize: 28,
                fontWeight: 600,
                fontFamily: TOKENS.fontMono,
                color: TOKENS.ink,
              }}
            >
              0.38ms p99
            </div>
          </div>

          <div
            style={{
              backgroundColor: TOKENS.raised,
              padding: 20,
              borderRadius: TOKENS.radiusInner,
            }}
          >
            <div
              style={{
                fontSize: 12,
                fontFamily: TOKENS.fontMono,
                color: TOKENS.ink2,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                marginBottom: 8,
              }}
            >
              Balance Precision
            </div>
            <div
              style={{
                fontSize: 28,
                fontWeight: 600,
                fontFamily: TOKENS.fontMono,
                color: TOKENS.good,
              }}
            >
              Δ 0.0000 USD
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const LEDGER_ROWS = [
  {
    txId: "TX-80419",
    timestamp: "22:23:01.102",
    route: "Stripe Settlement #4029",
    debit: "$184,500.00",
    credit: "$0.00",
    status: "COMMITTED",
  },
  {
    txId: "TX-80420",
    timestamp: "22:23:01.102",
    route: "JPMorgan Operating Reserves",
    debit: "$0.00",
    credit: "$184,500.00",
    status: "COMMITTED",
  },
  {
    txId: "TX-80421",
    timestamp: "22:23:01.103",
    route: "Fedwire Treasury Interbank",
    debit: "$42,100.00",
    credit: "$0.00",
    status: "COMMITTED",
  },
  {
    txId: "TX-80422",
    timestamp: "22:23:01.103",
    route: "Custody Reserve Vault",
    debit: "$0.00",
    credit: "$42,100.00",
    status: "COMMITTED",
  },
];

const ROW_OFFSETS = [0, 14, 28, 42] as const;

const SceneFeatureLedger: React.FC = () => {
  const frame = useCurrentFrame();

  const containerSlide = interpolate(frame, [0, 26], [-40, 0], {
    extrapolateRight: "clamp",
  });

  const commitProgress = interpolate(frame, [18, 45], [0, 1], {
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
        transform: `translateY(${containerSlide}px)`,
      }}
    >
      <div
        style={{
          width: 1360,
          backgroundColor: TOKENS.surface,
          border: `1px solid ${TOKENS.line}`,
          borderRadius: TOKENS.radius,
          padding: 40,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            paddingBottom: 20,
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
                letterSpacing: "0.06em",
                marginBottom: 6,
              }}
            >
              FEATURE 01
            </div>
            <div
              style={{
                fontSize: 28,
                fontWeight: 600,
                color: TOKENS.ink,
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
              gap: 24,
              fontFamily: TOKENS.fontMono,
              fontSize: 12,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            <div
              style={{
                backgroundColor: TOKENS.raised,
                padding: "8px 16px",
                borderRadius: TOKENS.radiusInner,
              }}
            >
              <span style={{ color: TOKENS.ink2 }}>POSTING SPEED: </span>
              <span style={{ color: TOKENS.ink }}>0.38ms</span>
            </div>
            <div
              style={{
                backgroundColor: TOKENS.raised,
                padding: "8px 16px",
                borderRadius: TOKENS.radiusInner,
              }}
            >
              <span style={{ color: TOKENS.ink2 }}>STATE: </span>
              <span style={{ color: TOKENS.good }}>● BALANCED</span>
            </div>
          </div>
        </div>

        {/* Live Transaction Ledger Table */}
        <div
          className="tabular-nums"
          style={{
            marginTop: 24,
            fontFamily: TOKENS.fontMono,
            fontSize: 13,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "140px 140px 1fr 180px 180px 150px",
              padding: "10px 16px",
              backgroundColor: TOKENS.raised,
              borderRadius: TOKENS.radiusInner,
              color: TOKENS.ink2,
              fontSize: 12,
              fontWeight: 500,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
            }}
          >
            <div>Transaction ID</div>
            <div>Timestamp</div>
            <div>Clearing Route</div>
            <div style={{ textAlign: "right" }}>Debit</div>
            <div style={{ textAlign: "right" }}>Credit</div>
            <div style={{ textAlign: "right" }}>Status</div>
          </div>

          {LEDGER_ROWS.map((row, idx) => {
            const rowOffset = ROW_OFFSETS[idx];
            const isVisible = frame >= rowOffset;
            const rowSlide = interpolate(
              frame,
              [rowOffset, rowOffset + 16],
              [-12, 0],
              {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }
            );

            return (
              <div
                key={row.txId}
                style={{
                  display: "grid",
                  gridTemplateColumns: "140px 140px 1fr 180px 180px 150px",
                  padding: "12px 16px",
                  borderTop: `1px solid ${TOKENS.line}`,
                  opacity: isVisible ? 1 : 0,
                  transform: `translateX(${rowSlide}px)`,
                  backgroundColor:
                    idx % 2 === 1 ? TOKENS.raised : "transparent",
                  color: TOKENS.ink,
                }}
              >
                <div style={{ color: TOKENS.accent }}>{row.txId}</div>
                <div style={{ color: TOKENS.ink2 }}>{row.timestamp}</div>
                <div>{row.route}</div>
                <div style={{ textAlign: "right" }}>{row.debit}</div>
                <div style={{ textAlign: "right" }}>{row.credit}</div>
                <div
                  style={{
                    textAlign: "right",
                    color: TOKENS.good,
                    fontWeight: 600,
                  }}
                >
                  ● {row.status}
                </div>
              </div>
            );
          })}

          {/* Zero-Delta Balancing Guarantee */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "16px",
              marginTop: 16,
              borderTop: `1px solid ${TOKENS.line}`,
              backgroundColor: TOKENS.raised,
              borderRadius: TOKENS.radiusInner,
              opacity: commitProgress,
            }}
          >
            <div style={{ display: "flex", gap: 32, fontSize: 13 }}>
              <span>
                <strong style={{ color: TOKENS.ink2 }}>TOTAL DEBITS: </strong>
                <span>$226,600.00</span>
              </span>
              <span>
                <strong style={{ color: TOKENS.ink2 }}>TOTAL CREDITS: </strong>
                <span>$226,600.00</span>
              </span>
              <span>
                <strong style={{ color: TOKENS.ink2 }}>DELTA: </strong>
                <span style={{ color: TOKENS.good }}>0.0000 USD</span>
              </span>
            </div>

            <div
              style={{
                color: TOKENS.good,
                fontWeight: 600,
                fontSize: 12,
                letterSpacing: "0.06em",
              }}
            >
              MATHEMATICALLY VERIFIED ZERO-DELTA
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const INSTITUTIONS = [
  { name: "JPMorgan Chase Treasury", matched: "18,420 TX", rate: "100.0%" },
  { name: "Bank of America Clearing", matched: "14,190 TX", rate: "99.8%" },
  { name: "Stripe Connect Clearing", matched: "10,300 TX", rate: "100.0%" },
];

const SceneFeatureReconciliationAndAudit: React.FC = () => {
  const frame = useCurrentFrame();

  const card1Arrival = interpolate(frame, [5, 19], [0, 1], {
    extrapolateRight: "clamp",
  });

  const card2Arrival = interpolate(frame, [22, 40], [0, 1], {
    extrapolateRight: "clamp",
  });

  const verifiedTick = frame >= 48;

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
          width: 1400,
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 32,
        }}
      >
        {/* Feature 2: Automated Multi-Bank Reconciliation */}
        <div
          style={{
            backgroundColor: TOKENS.surface,
            border: `1px solid ${TOKENS.line}`,
            borderRadius: TOKENS.radius,
            padding: 36,
            opacity: card1Arrival,
          }}
        >
          <div
            style={{
              fontSize: 12,
              fontFamily: TOKENS.fontMono,
              color: TOKENS.accent,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              marginBottom: 6,
            }}
          >
            FEATURE 02
          </div>
          <div
            style={{
              fontSize: 28,
              fontWeight: 600,
              color: TOKENS.ink,
              marginBottom: 24,
            }}
          >
            Multi-Bank Reconciliation
          </div>

          <div
            className="tabular-nums"
            style={{
              backgroundColor: TOKENS.raised,
              padding: 24,
              borderRadius: TOKENS.radiusInner,
              marginBottom: 24,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            <div
              style={{
                fontSize: 12,
                fontFamily: TOKENS.fontMono,
                color: TOKENS.ink2,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                marginBottom: 6,
              }}
            >
              Automatic Match Rate
            </div>
            <div
              style={{
                fontSize: 40,
                fontWeight: 600,
                fontFamily: TOKENS.fontMono,
                color: TOKENS.accent,
                lineHeight: 1.15,
              }}
            >
              99.8%
            </div>
            <div
              style={{
                fontSize: 14,
                color: TOKENS.ink,
                marginTop: 8,
              }}
            >
              Across 40+ partner institutions with zero manual exceptions.
            </div>
          </div>

          <div
            className="tabular-nums"
            style={{
              fontFamily: TOKENS.fontMono,
              fontSize: 12,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {INSTITUTIONS.map((inst) => (
              <div
                key={inst.name}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "10px 0",
                  borderTop: `1px solid ${TOKENS.line}`,
                }}
              >
                <span style={{ color: TOKENS.ink }}>{inst.name}</span>
                <span style={{ color: TOKENS.ink2 }}>{inst.matched}</span>
                <span style={{ color: TOKENS.good }}>● {inst.rate}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Feature 3: Cryptographic Audit Stream */}
        <div
          style={{
            backgroundColor: TOKENS.surface,
            border: `1px solid ${TOKENS.line}`,
            borderRadius: TOKENS.radius,
            padding: 36,
            opacity: card2Arrival,
          }}
        >
          <div
            style={{
              fontSize: 12,
              fontFamily: TOKENS.fontMono,
              color: TOKENS.accent,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              marginBottom: 6,
            }}
          >
            FEATURE 03
          </div>
          <div
            style={{
              fontSize: 28,
              fontWeight: 600,
              color: TOKENS.ink,
              marginBottom: 24,
            }}
          >
            Cryptographic Audit Stream
          </div>

          <div
            className="tabular-nums"
            style={{
              backgroundColor: TOKENS.raised,
              padding: 24,
              borderRadius: TOKENS.radiusInner,
              marginBottom: 24,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            <div
              style={{
                fontSize: 12,
                fontFamily: TOKENS.fontMono,
                color: TOKENS.ink2,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                marginBottom: 6,
              }}
            >
              Merkle Root State
            </div>
            <div
              style={{
                fontSize: 14,
                fontFamily: TOKENS.fontMono,
                color: TOKENS.ink,
                wordBreak: "break-all",
                marginBottom: 12,
              }}
            >
              sha256:7f9a2b41c08d13268e3c8149e917d2a5b
            </div>
            <div
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: verifiedTick ? TOKENS.good : TOKENS.warn,
                fontFamily: TOKENS.fontMono,
              }}
            >
              {verifiedTick
                ? "● MERKLE PROOF VERIFIED BY ENGINE"
                : "○ COMPUTING MERKLE TREE HASH"}
            </div>
          </div>

          <div
            style={{
              fontFamily: TOKENS.fontMono,
              fontSize: 13,
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            <div
              style={{
                padding: "8px 0",
                borderTop: `1px solid ${TOKENS.line}`,
                color: TOKENS.ink,
              }}
            >
              Continuous balance sheets without month-end lockouts
            </div>
            <div
              style={{
                padding: "8px 0",
                borderTop: `1px solid ${TOKENS.line}`,
                color: TOKENS.ink,
              }}
            >
              Immutable cryptographic log exportable for auditors
            </div>
            <div
              style={{
                padding: "8px 0",
                borderTop: `1px solid ${TOKENS.line}`,
                color: TOKENS.good,
              }}
            >
              ● 100% US-GAAP & IFRS Compliant Architecture
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const SceneCallToAction: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const buttonSpring = spring({
    frame: Math.max(0, frame - 15),
    fps,
    config: { damping: 200, mass: 1, stiffness: 100 },
    overshootClamping: true,
  });

  const buttonOpacity = interpolate(frame, [15, 31], [0, 1], {
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
          width: 960,
          backgroundColor: TOKENS.surface,
          border: `1px solid ${TOKENS.line}`,
          borderRadius: TOKENS.radius,
          padding: 48,
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontSize: 12,
            fontFamily: TOKENS.fontMono,
            fontWeight: 500,
            color: TOKENS.accent,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            marginBottom: 12,
          }}
        >
          PRODUCTION READY DEPLOYMENT
        </div>

        <div
          style={{
            fontSize: 40,
            fontWeight: 600,
            color: TOKENS.ink,
            marginBottom: 16,
            lineHeight: 1.15,
          }}
        >
          Ledgerly Core
        </div>

        <div
          style={{
            fontSize: 16,
            color: TOKENS.ink,
            marginBottom: 36,
          }}
        >
          Programmable financial infrastructure for real-time ledger accounting.
        </div>

        {/* Terminal install block */}
        <div
          style={{
            backgroundColor: TOKENS.bg,
            border: `1px solid ${TOKENS.line}`,
            borderRadius: TOKENS.radiusInner,
            padding: "16px 24px",
            fontFamily: TOKENS.fontMono,
            fontSize: 15,
            color: TOKENS.accent,
            textAlign: "left",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 32,
          }}
        >
          <span>$ curl -fsSL https://ledgerly.io/install.sh | sh</span>
          <span
            style={{
              fontSize: 12,
              color: TOKENS.ink2,
            }}
          >
            v2.4
          </span>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 24,
            opacity: buttonOpacity,
            transform: `scale(${0.96 + buttonSpring * 0.04})`,
          }}
        >
          <button
            type="button"
            style={{
              height: 40,
              padding: "0 24px",
              backgroundColor: TOKENS.accent,
              color: TOKENS.onAccent,
              border: "none",
              borderRadius: TOKENS.radius,
              fontWeight: 600,
              fontSize: 14,
              fontFamily: TOKENS.fontBody,
              cursor: "pointer",
            }}
          >
            Deploy Ledgerly Core
          </button>
        </div>

        <div
          style={{
            marginTop: 32,
            paddingTop: 24,
            borderTop: `1px solid ${TOKENS.line}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 32,
            fontFamily: TOKENS.fontMono,
            fontSize: 12,
            color: TOKENS.ink2,
          }}
        >
          <span>ledgerly.io</span>
          <span>●</span>
          <span>DOCUMENTATION: docs.ledgerly.io</span>
          <span>●</span>
          <span>APACHE-2.0 LICENSE</span>
        </div>
      </div>
    </div>
  );
};
