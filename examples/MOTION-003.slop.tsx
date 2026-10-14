import { AbsoluteFill, spring, useCurrentFrame, useVideoConfig } from 'remotion';

export const Headline = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame, fps });

  return (
    <AbsoluteFill className="headline">
      <h1 style={{ transform: `scale(${pop})` }}>Close the books in an afternoon</h1>
    </AbsoluteFill>
  );
};
