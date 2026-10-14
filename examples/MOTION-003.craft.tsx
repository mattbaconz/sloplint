import { AbsoluteFill, spring, useCurrentFrame, useVideoConfig } from 'remotion';

export const Headline = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  // Critically damped: settles without passing its target.
  const settle = spring({ frame, fps, config: { damping: 200 } });

  return (
    <AbsoluteFill className="headline">
      <h1 style={{ transform: `translateY(${(1 - settle) * 24}px)` }}>Close the books in an afternoon</h1>
    </AbsoluteFill>
  );
};
