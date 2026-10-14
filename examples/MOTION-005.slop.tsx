import { Audio, Sequence, staticFile } from 'remotion';

export const Transitions = () => (
  <>
    <Sequence from={45}><Audio src={staticFile('sfx/whoosh.mp3')} volume={0.4} /></Sequence>
    <Sequence from={105}><Audio src={staticFile('sfx/whoosh.mp3')} volume={0.4} /></Sequence>
    <Sequence from={315}><Audio src={staticFile('sfx/whoosh.mp3')} volume={0.4} /></Sequence>
    <Sequence from={390}><Audio src={staticFile('sfx/whoosh.mp3')} volume={0.4} /></Sequence>
  </>
);
