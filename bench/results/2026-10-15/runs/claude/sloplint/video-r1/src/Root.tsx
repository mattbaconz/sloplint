import React from "react";
import { Composition } from "remotion";
import { LAUNCH_DURATION, LAUNCH_FPS, Launch } from "./Launch";

export const RemotionRoot: React.FC = () => (
  <Composition
    id="Launch"
    component={Launch}
    durationInFrames={LAUNCH_DURATION}
    fps={LAUNCH_FPS}
    width={1920}
    height={1080}
  />
);
