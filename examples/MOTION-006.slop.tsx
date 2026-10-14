import { AbsoluteFill, Audio, Sequence, staticFile } from 'remotion';

export const Soundtrack = () => (
  <AbsoluteFill>
    <Audio src={staticFile('music/score.mp3')} />
    <Audio src={staticFile('voice/narration.wav')} />
    <Sequence from={390}><Audio src={staticFile('sfx/logo-hit.wav')} /></Sequence>
  </AbsoluteFill>
);
