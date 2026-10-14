import { AbsoluteFill, Audio, Sequence, interpolate, staticFile } from 'remotion';

const VOICE = [30, 330];

// Music sits under the voice and comes back up when the narration ends.
const music = (f: number) => interpolate(f, [VOICE[0] - 10, VOICE[0], VOICE[1], VOICE[1] + 15], [0.35, 0.12, 0.12, 0.35], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

export const Soundtrack = () => (
  <AbsoluteFill>
    <Audio src={staticFile('music/score.mp3')} volume={music} />
    <Sequence from={VOICE[0]}><Audio src={staticFile('voice/narration.wav')} volume={0.9} /></Sequence>
    <Sequence from={390}><Audio src={staticFile('sfx/logo-hit.wav')} volume={0.25} /></Sequence>
  </AbsoluteFill>
);
