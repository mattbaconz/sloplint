import { Audio, Sequence, staticFile } from 'remotion';

// The music carries the cuts. Two moments get their own sound: the first result, and the logo.
export const Transitions = () => (
  <>
    <Sequence from={0}><Audio src={staticFile('music/score.mp3')} volume={0.3} /></Sequence>
    <Sequence from={150}><Audio src={staticFile('sfx/ledger-settle.wav')} volume={0.18} /></Sequence>
    <Sequence from={390}><Audio src={staticFile('sfx/logo-hit.wav')} volume={0.25} /></Sequence>
  </>
);
