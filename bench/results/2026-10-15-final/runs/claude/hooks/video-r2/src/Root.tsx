import React from "react";
import {Composition} from "remotion";
import {Launch, LAUNCH_FRAMES} from "./Launch";

export const RemotionRoot: React.FC = () => (
  <Composition
    id="Launch"
    component={Launch}
    durationInFrames={LAUNCH_FRAMES}
    fps={30}
    width={1920}
    height={1080}
  />
);
