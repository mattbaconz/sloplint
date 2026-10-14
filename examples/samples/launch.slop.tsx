import { AbsoluteFill, Audio, Series, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';

const features = ['Bank sync', 'Auto-matching', 'Approval flows', 'Audit trail', 'Exports'];

const Hook = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame, fps });
  return (
    <AbsoluteFill className="scene">
      <h1 style={{ transform: `scale(${pop})` }}>Month-end, finished by lunch</h1>
    </AbsoluteFill>
  );
};

const Features = () => {
  const frame = useCurrentFrame();
  const heading = interpolate(frame, [0, 20], [0, 1]);
  const caption = interpolate(frame, [10, 30], [0, 1]);
  const footer = interpolate(frame, [40, 60], [0, 1]);
  return (
    <AbsoluteFill className="scene">
      <h2 style={{ opacity: heading }}>Everything your close needs</h2>
      <p style={{ opacity: caption }}>Connect a bank and the ledger keeps itself</p>
      <ul>
        {features.map((name, i) => (
          <li key={name} style={{ opacity: interpolate(frame - i * 5, [0, 10], [0.5, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }) }}>{name}</li>
        ))}
      </ul>
      <small style={{ opacity: footer }}>Available on every plan</small>
    </AbsoluteFill>
  );
};

const Logo = () => (
  <AbsoluteFill className="scene">
    <img src="/ledgerly.svg" alt="Ledgerly" />
  </AbsoluteFill>
);

export const Launch = () => (
  <AbsoluteFill>
    <Audio src={staticFile('music/upbeat-corporate.mp3')} />
    <Series>
      <Series.Sequence durationInFrames={90}><Hook /></Series.Sequence>
      <Series.Sequence durationInFrames={90}><Features /></Series.Sequence>
      <Series.Sequence durationInFrames={90}><Logo /></Series.Sequence>
    </Series>
    <Sequence from={88}><Audio src={staticFile('sfx/whoosh.mp3')} /></Sequence>
    <Sequence from={178}><Audio src={staticFile('sfx/whoosh.mp3')} /></Sequence>
    <Sequence from={268}><Audio src={staticFile('sfx/whoosh.mp3')} /></Sequence>
  </AbsoluteFill>
);
