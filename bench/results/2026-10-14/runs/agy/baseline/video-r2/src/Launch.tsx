import React from 'react';
import {
  AbsoluteFill,
  Audio,
  Easing,
  Sequence,
  Series,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';

// Durations for each of the 5 scenes (Total: 450 frames = 15 seconds at 30 fps)
const SCENE_DURATIONS = [70, 95, 115, 90, 80] as const;

// Color palette: obsidian slate base with emerald precision accent
const COLORS = {
  bg: '#090d14',
  cardBg: 'rgba(17, 24, 39, 0.75)',
  cardBorder: 'rgba(255, 255, 255, 0.08)',
  textPrimary: '#f8fafc',
  textSecondary: '#94a3b8',
  textMuted: '#64748b',
  accent: '#10b981',
  accentMuted: 'rgba(16, 185, 129, 0.15)',
  accentBorder: 'rgba(16, 185, 129, 0.4)',
  blue: '#38bdf8',
  amber: '#fbbf24',
};

// Reusable SVG logo glyph for Ledgerly
const LedgerGlyph: React.FC<{ size?: number; glow?: boolean }> = ({ size = 48, glow = false }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 48 48"
    fill="none"
    style={{ filter: glow ? 'drop-shadow(0 0 12px rgba(16, 185, 129, 0.4))' : undefined }}
  >
    <rect x="6" y="6" width="36" height="36" rx="8" fill="#111827" stroke="rgba(255,255,255,0.12)" strokeWidth="1.5" />
    <path d="M14 15H34" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round" />
    <path d="M14 24H26" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" />
    <path d="M14 33H30" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round" />
    <circle cx="34" cy="24" r="3.5" fill="#10b981" />
  </svg>
);

// Chrome frame bar showing system telemetry
const SystemStatusBar: React.FC = () => {
  return (
    <div
      style={{
        position: 'absolute',
        top: 36,
        left: 60,
        right: 60,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 24px',
        backgroundColor: 'rgba(15, 23, 42, 0.6)',
        borderRadius: 10,
        border: `1px solid ${COLORS.cardBorder}`,
        color: COLORS.textMuted,
        fontSize: 14,
        letterSpacing: '1px',
        fontFamily: 'monospace',
        zIndex: 50,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.accent }} />
        <span style={{ color: COLORS.textPrimary, fontWeight: 700, letterSpacing: '2px' }}>LEDGERLY ENGINE</span>
        <span style={{ color: COLORS.textMuted }}>/ FINANCIAL CORE v3.8</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 24, fontVariantNumeric: 'tabular-nums' }}>
        <span>FEED: 12,410 INSTITUTIONS</span>
        <span>LATENCY: 14ms</span>
        <span style={{ color: COLORS.accent }}>STATUS: LIVE RECONCILING</span>
      </div>
    </div>
  );
};

// SCENE 1: Brand Intro & Hook (Frames 0 - 70)
const SceneIntro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Hero scale leads, settles cleanly without overshoot
  const heroScale = spring({
    frame,
    fps,
    config: { damping: 200 },
  });

  const cardOffset = interpolate(frame, [8, 32], [40, 0], {
    easing: Easing.out(Easing.cubic),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: COLORS.bg,
        padding: '0 120px',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          transform: `scale(${heroScale})`,
          maxWidth: 1200,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginBottom: 24 }}>
          <LedgerGlyph size={64} glow />
          <span
            style={{
              fontSize: 54,
              fontWeight: 800,
              letterSpacing: '6px',
              color: COLORS.textPrimary,
            }}
          >
            LEDGERLY
          </span>
        </div>

        <h1
          style={{
            fontSize: 68,
            fontWeight: 800,
            lineHeight: 1.15,
            color: COLORS.textPrimary,
            margin: '0 0 20px 0',
            letterSpacing: '-1.5px',
          }}
        >
          Month-end close, finished before lunch.
        </h1>

        <p
          style={{
            fontSize: 26,
            lineHeight: 1.45,
            color: COLORS.textSecondary,
            margin: '0 0 36px 0',
            maxWidth: 860,
          }}
        >
          The autonomous general ledger that reconciles every transaction in real time.
        </p>

        {/* Live status badge */}
        <div
          style={{
            transform: `translateY(${cardOffset}px)`,
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            backgroundColor: COLORS.cardBg,
            padding: '14px 28px',
            borderRadius: 12,
            border: `1px solid ${COLORS.accentBorder}`,
          }}
        >
          <div style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.accent }} />
          <span style={{ fontSize: 18, fontWeight: 600, color: COLORS.accent, letterSpacing: '0.5px' }}>
            AUTONOMOUS RECONCILIATION ENGINE
          </span>
          <span style={{ color: COLORS.textMuted }}>|</span>
          <span style={{ fontSize: 18, color: COLORS.textSecondary, fontVariantNumeric: 'tabular-nums' }}>
            Zero manual journal entries
          </span>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// SCENE 2: Feature 1 — Live Multi-Bank Feeds (Frames 70 - 165)
const SceneBankSync: React.FC = () => {
  const frame = useCurrentFrame();

  const titleProgress = interpolate(frame, [0, 22], [0.92, 1], {
    easing: Easing.bezier(0.16, 1, 0.3, 1),
    extrapolateRight: 'clamp',
  });

  const accounts = [
    { name: 'Mercury Operating Checking', account: 'Act #8402', balance: '$184,320.45', time: 'Streaming now' },
    { name: 'Stripe Treasury Settlement', account: 'Act #3199', balance: '$42,850.00', time: '2s ago' },
    { name: 'Silicon Valley Reserve Account', account: 'Act #9104', balance: '$249,100.05', time: '4s ago' },
  ];

  const ease = Easing.out(Easing.quad);

  return (
    <AbsoluteFill
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: COLORS.bg,
        padding: '0 100px',
      }}
    >
      <div style={{ width: 1280, transform: `scale(${titleProgress})` }}>
        {/* Section Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 32 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: COLORS.accent, letterSpacing: '2px', marginBottom: 8 }}>
              FEATURE 01 / 03
            </div>
            <h2 style={{ fontSize: 52, fontWeight: 800, color: COLORS.textPrimary, margin: 0, letterSpacing: '-1px' }}>
              Direct Multi-Bank Feeds
            </h2>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 14, color: COLORS.textMuted, marginBottom: 4 }}>TOTAL LIQUID BALANCES</div>
            <div style={{ fontSize: 32, fontWeight: 700, color: COLORS.textPrimary, fontVariantNumeric: 'tabular-nums' }}>
              $476,270.50
            </div>
          </div>
        </div>

        {/* Live Bank Feed Card */}
        <div
          style={{
            backgroundColor: COLORS.cardBg,
            borderRadius: 16,
            border: `1px solid ${COLORS.cardBorder}`,
            overflow: 'hidden',
          }}
        >
          {/* Card Table Header */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '2fr 1fr 1.5fr 1fr',
              padding: '16px 28px',
              backgroundColor: 'rgba(255, 255, 255, 0.02)',
              borderBottom: `1px solid ${COLORS.cardBorder}`,
              fontSize: 13,
              fontWeight: 600,
              color: COLORS.textMuted,
              letterSpacing: '1px',
            }}
          >
            <span>FINANCIAL INSTITUTION</span>
            <span>IDENTIFIER</span>
            <span style={{ textAlign: 'right' }}>RECONCILED BALANCE</span>
            <span style={{ textAlign: 'right' }}>INGESTION</span>
          </div>

          {/* Accounts List with non-fixed-step stagger */}
          {accounts.map((acc, i) => {
            const startFrame = Math.round(ease(i / (accounts.length - 1)) * 14);
            const rowOpacity = interpolate(frame - startFrame, [0, 10], [0.35, 1], {
              easing: ease,
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            });
            const rowTranslate = interpolate(frame - startFrame, [0, 14], [18, 0], {
              easing: ease,
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            });

            return (
              <div
                key={acc.name}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '2fr 1fr 1.5fr 1fr',
                  padding: '24px 28px',
                  alignItems: 'center',
                  borderBottom: i < accounts.length - 1 ? `1px solid ${COLORS.cardBorder}` : undefined,
                  opacity: rowOpacity,
                  transform: `translateY(${rowTranslate}px)`,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.accent }} />
                  <span style={{ fontSize: 20, fontWeight: 600, color: COLORS.textPrimary }}>{acc.name}</span>
                </div>
                <span style={{ fontSize: 16, color: COLORS.textMuted, fontFamily: 'monospace' }}>{acc.account}</span>
                <span
                  style={{
                    fontSize: 22,
                    fontWeight: 700,
                    color: COLORS.textPrimary,
                    textAlign: 'right',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {acc.balance}
                </span>
                <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 14, color: COLORS.accent, fontWeight: 600 }}>{acc.time}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};

// SCENE 3: Feature 2 — Zero-Touch Transaction Matching (Frames 165 - 280)
const SceneAutoMatch: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleSlide = interpolate(frame, [0, 20], [0.94, 1], {
    easing: Easing.bezier(0.16, 1, 0.3, 1),
    extrapolateRight: 'clamp',
  });

  // Match badge springs into place around frame 55 with damping 200
  const matchSpring = spring({
    frame: frame - 55,
    fps,
    config: { damping: 200 },
  });

  const matchOpacity = interpolate(frame, [50, 62], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: COLORS.bg,
        padding: '0 100px',
      }}
    >
      <div style={{ width: 1320, transform: `scale(${titleSlide})` }}>
        {/* Section Header */}
        <div style={{ marginBottom: 34, textAlign: 'center' }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: COLORS.accent, letterSpacing: '2px', marginBottom: 8 }}>
            FEATURE 02 / 03
          </div>
          <h2 style={{ fontSize: 52, fontWeight: 800, color: COLORS.textPrimary, margin: 0, letterSpacing: '-1px' }}>
            Zero-Touch Transaction Matching
          </h2>
        </div>

        {/* Bilateral Reconciliation Cockpit */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24 }}>
          {/* Left: Bank Settlement */}
          <div
            style={{
              flex: 1,
              backgroundColor: COLORS.cardBg,
              borderRadius: 16,
              border: `1px solid ${COLORS.cardBorder}`,
              padding: 30,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 18 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: COLORS.textMuted, letterSpacing: '1px' }}>
                BANK SETTLEMENT WIRE
              </span>
              <span style={{ fontSize: 13, color: COLORS.blue, fontWeight: 600 }}>CONFIRMED</span>
            </div>
            <div style={{ fontSize: 32, fontWeight: 700, color: COLORS.textPrimary, fontVariantNumeric: 'tabular-nums', marginBottom: 12 }}>
              +$18,450.00
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 16, color: COLORS.textSecondary }}>
              <div>Origin: <strong style={{ color: COLORS.textPrimary }}>Nordic Design Studio</strong></div>
              <div>Reference: <span style={{ fontFamily: 'monospace' }}>WIRE-TX-90428</span></div>
              <div style={{ fontVariantNumeric: 'tabular-nums' }}>Posted: Oct 14, 2026 · 10:42 AM</div>
            </div>
          </div>

          {/* Center: Match Engine Connector */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              width: 260,
              opacity: matchOpacity,
              transform: `scale(${matchSpring})`,
            }}
          >
            <div
              style={{
                backgroundColor: COLORS.accentMuted,
                border: `1.5px solid ${COLORS.accent}`,
                padding: '16px 20px',
                borderRadius: 12,
                textAlign: 'center',
                boxShadow: '0 8px 24px rgba(16, 185, 129, 0.25)',
              }}
            >
              <div style={{ fontSize: 20, fontWeight: 800, color: COLORS.accent, letterSpacing: '1px' }}>
                100% MATCHED
              </div>
              <div style={{ fontSize: 13, color: COLORS.textPrimary, marginTop: 4, fontWeight: 600 }}>
                Confidence Score: 0.998
              </div>
            </div>
            <div style={{ fontSize: 12, color: COLORS.textMuted, marginTop: 10, letterSpacing: '0.5px' }}>
              DR Cash / CR Accounts Rec.
            </div>
          </div>

          {/* Right: Internal Invoice */}
          <div
            style={{
              flex: 1,
              backgroundColor: COLORS.cardBg,
              borderRadius: 16,
              border: `1px solid ${COLORS.cardBorder}`,
              padding: 30,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 18 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: COLORS.textMuted, letterSpacing: '1px' }}>
                ACCOUNTS RECEIVABLE INVOICE
              </span>
              <span style={{ fontSize: 13, color: COLORS.accent, fontWeight: 600 }}>AUTO-PAIRED</span>
            </div>
            <div style={{ fontSize: 32, fontWeight: 700, color: COLORS.textPrimary, fontVariantNumeric: 'tabular-nums', marginBottom: 12 }}>
              $18,450.00
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 16, color: COLORS.textSecondary }}>
              <div>Client: <strong style={{ color: COLORS.textPrimary }}>Nordic Design Studio</strong></div>
              <div>Invoice: <span style={{ fontFamily: 'monospace' }}>INV-2026-881</span></div>
              <div style={{ fontVariantNumeric: 'tabular-nums' }}>Due Date: Oct 15, 2026 · Net 30</div>
            </div>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// SCENE 4: Feature 3 — Audit-Ready Continuous Close (Frames 280 - 370)
const SceneAuditClose: React.FC = () => {
  const frame = useCurrentFrame();

  const titleEase = interpolate(frame, [0, 24], [0.93, 1], {
    easing: Easing.bezier(0.16, 1, 0.3, 1),
    extrapolateRight: 'clamp',
  });

  const progressPercent = interpolate(frame, [10, 48], [62, 100], {
    easing: Easing.out(Easing.cubic),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const checklist = [
    { label: 'Bank & Credit Card Reconciliation', result: '100% Balanced', ok: true },
    { label: 'Deferred Revenue Schedule (ASC 606)', result: 'Verified Accurate', ok: true },
    { label: 'Fixed Asset Depreciation Schedules', result: 'Auto-Calculated', ok: true },
    { label: 'Double-Entry Trial Balance Verification', result: 'Variance $0.00', ok: true },
  ];

  return (
    <AbsoluteFill
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: COLORS.bg,
        padding: '0 100px',
      }}
    >
      <div style={{ width: 1280, transform: `scale(${titleEase})` }}>
        {/* Section Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 28 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: COLORS.accent, letterSpacing: '2px', marginBottom: 8 }}>
              FEATURE 03 / 03
            </div>
            <h2 style={{ fontSize: 52, fontWeight: 800, color: COLORS.textPrimary, margin: 0, letterSpacing: '-1px' }}>
              Audit-Ready Continuous Close
            </h2>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: 14, color: COLORS.textMuted }}>PERIOD AUDITED</span>
            <div style={{ fontSize: 24, fontWeight: 700, color: COLORS.textPrimary }}>OCTOBER 2026</div>
          </div>
        </div>

        {/* Close Progress Card */}
        <div
          style={{
            backgroundColor: COLORS.cardBg,
            borderRadius: 16,
            border: `1px solid ${COLORS.cardBorder}`,
            padding: 32,
            marginBottom: 20,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ fontSize: 18, fontWeight: 600, color: COLORS.textPrimary }}>General Ledger Close Completion</span>
            <span style={{ fontSize: 20, fontWeight: 800, color: COLORS.accent, fontVariantNumeric: 'tabular-nums' }}>
              {Math.round(progressPercent)}%
            </span>
          </div>
          <div style={{ width: '100%', height: 12, backgroundColor: 'rgba(255, 255, 255, 0.08)', borderRadius: 6, overflow: 'hidden' }}>
            <div
              style={{
                width: `${progressPercent}%`,
                height: '100%',
                backgroundColor: COLORS.accent,
                borderRadius: 6,
              }}
            />
          </div>
        </div>

        {/* Verification Items Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {checklist.map((item) => (
            <div
              key={item.label}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '18px 24px',
                backgroundColor: 'rgba(15, 23, 42, 0.5)',
                borderRadius: 12,
                border: `1px solid ${COLORS.cardBorder}`,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: COLORS.accentMuted, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ color: COLORS.accent, fontSize: 14, fontWeight: 900 }}>✓</span>
                </div>
                <span style={{ fontSize: 16, fontWeight: 600, color: COLORS.textPrimary }}>{item.label}</span>
              </div>
              <span style={{ fontSize: 15, color: COLORS.accent, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                {item.result}
              </span>
            </div>
          ))}
        </div>
      </div>
    </AbsoluteFill>
  );
};

// SCENE 5: Closing Call to Action (Frames 370 - 450)
const SceneCallToAction: React.FC = () => {
  const frame = useCurrentFrame();

  const logoScale = interpolate(frame, [0, 25], [0.88, 1], {
    easing: Easing.bezier(0.16, 1, 0.3, 1),
    extrapolateRight: 'clamp',
  });

  // Simulated button click at frame 35 (global frame 405)
  const clickScale = interpolate(frame, [34, 37, 42], [1, 0.94, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: COLORS.bg,
        padding: '0 100px',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          transform: `scale(${logoScale})`,
          maxWidth: 960,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginBottom: 28 }}>
          <LedgerGlyph size={68} glow />
          <span
            style={{
              fontSize: 58,
              fontWeight: 800,
              letterSpacing: '6px',
              color: COLORS.textPrimary,
            }}
          >
            LEDGERLY
          </span>
        </div>

        <h2
          style={{
            fontSize: 64,
            fontWeight: 800,
            lineHeight: 1.15,
            color: COLORS.textPrimary,
            margin: '0 0 20px 0',
            letterSpacing: '-1.5px',
          }}
        >
          Close your books in an afternoon.
        </h2>

        <p
          style={{
            fontSize: 24,
            lineHeight: 1.4,
            color: COLORS.textSecondary,
            margin: '0 0 40px 0',
          }}
        >
          Join high-growth finance teams closing 5x faster with autonomous reconciliation.
        </p>

        {/* Actionable Call to Action Button */}
        <div
          style={{
            transform: `scale(${clickScale})`,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 14,
            backgroundColor: COLORS.accent,
            color: '#042f2e',
            fontSize: 24,
            fontWeight: 800,
            padding: '20px 48px',
            borderRadius: 14,
            boxShadow: '0 12px 36px rgba(16, 185, 129, 0.35)',
            marginBottom: 28,
            letterSpacing: '0.5px',
          }}
        >
          <span>Start 14-Day Free Trial</span>
          <span style={{ fontSize: 26 }}>→</span>
        </div>

        {/* Direct URL and trust statement */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 28, fontWeight: 700, color: COLORS.textPrimary, letterSpacing: '1px' }}>
            ledgerly.io
          </span>
          <span style={{ fontSize: 16, color: COLORS.textMuted }}>
            SOC 2 Type II Certified · Continuous Double-Entry Ledger
          </span>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// Main 15-second Launch Video Composition (450 frames at 30 fps)
export const Launch: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.bg }}>
      {/* Background soundtrack mixed and curved */}
      <Audio
        src={staticFile('music.mp3')}
        volume={(f: number) =>
          interpolate(f, [0, 24, 420, 450], [0, 0.32, 0.32, 0], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          })
        }
      />

      {/* SFX: Transition into Feature 1 (Global frame 68) */}
      <Sequence from={68} durationInFrames={30}>
        <Audio src={staticFile('sfx/whoosh.mp3')} volume={0.22} />
      </Sequence>

      {/* SFX: Transaction Match Confirmation (Global frame 225) */}
      <Sequence from={225} durationInFrames={25}>
        <Audio src={staticFile('sfx/pop.mp3')} volume={0.25} />
      </Sequence>

      {/* SFX: Riser building toward the close (Global frame 335) */}
      <Sequence from={335} durationInFrames={40}>
        <Audio src={staticFile('sfx/riser.mp3')} volume={0.28} />
      </Sequence>

      {/* SFX: Button Click on CTA (Global frame 405) */}
      <Sequence from={405} durationInFrames={20}>
        <Audio src={staticFile('sfx/click.mp3')} volume={0.24} />
      </Sequence>

      {/* Top telemetry bar persisted throughout */}
      <SystemStatusBar />

      {/* 5 scenes with variable durations to guarantee dynamic pacing */}
      <Series>
        <Series.Sequence durationInFrames={SCENE_DURATIONS[0]}>
          <SceneIntro />
        </Series.Sequence>
        <Series.Sequence durationInFrames={SCENE_DURATIONS[1]}>
          <SceneBankSync />
        </Series.Sequence>
        <Series.Sequence durationInFrames={SCENE_DURATIONS[2]}>
          <SceneAutoMatch />
        </Series.Sequence>
        <Series.Sequence durationInFrames={SCENE_DURATIONS[3]}>
          <SceneAuditClose />
        </Series.Sequence>
        <Series.Sequence durationInFrames={SCENE_DURATIONS[4]}>
          <SceneCallToAction />
        </Series.Sequence>
      </Series>
    </AbsoluteFill>
  );
};

export default Launch;
