# Motion video brief

You are writing a launch, promo or explainer video as code: Remotion, GSAP, or HTML compositions rendered to video. Generated videos share one look and one sound: everything fades up the same way, springs wobble, scenes tick by at equal length, and a stock whoosh marks every cut. Viewers recognise it within seconds. A video exists to show one product doing one thing well; every motion and sound decision should serve that.

## Before writing a frame

- Write the beat sheet first: what the viewer must understand at each moment, and how long it needs. The scene list and its durations come from that, not from a template.
- Pick the music before timing anything. Measure its tempo and cut on its beats (at 30 fps and 120 BPM, one beat is 15 frames).
- Use the real product: real screens, real numbers, real customer names. No placeholder dashboards or rounded fake metrics.

## Motion

- **MOTION-001 Not every element enters the same way.** If the title, subtitle, screenshot and button all fade in over 20 frames, nothing leads. Choose one hero move per scene (a scale from the previous shape, a mask reveal, a camera push), let supporting elements arrive quietly, and let some be present on the cut.
- **MOTION-002 No fixed-step staggers.** `frame - i * 5` makes a list type itself out at one speed, and long lists drag. Spread items over a fixed window with an easing curve, group items that belong together, or land them on beats.
- **MOTION-003 No default wobble.** Remotion's `spring()` defaults to damping 10 and overshoots by about 16 percent; GSAP's `back`, `elastic` and `bounce` eases wobble on arrival. Use `config: { damping: 200 }` or `overshootClamping: true` for UI and type. Allow overshoot only on one physical object per film, and keep it small.
- Prefer continuity over cuts: morph one shape into the next state, or push into an element that becomes the next scene. A crossfade that stacks two scenes on screen is a last resort.
- No empty frames. If nothing is happening, the scene is too long.

## Pacing

- **MOTION-004 Scenes are not all the same length.** Five 90-frame scenes is a slideshow. The hook is short, the demo holds, the logo gets out of the way. Keep durations in one array so the rhythm is visible in review.

## Sound

- **MOTION-005 No sound effect on every cut.** A whoosh on each transition and a click on each cursor move is the signature of generated videos. Let the music carry most transitions; give the two or three moments that matter their own sound.
- **MOTION-006 Mix every layer.** Each `<Audio>` plays at volume 1 by default, so music, voice and effects stacked together clip and bury the voice. Set levels (music around 0.2 to 0.35, effects lower than you think) and duck the music under narration with a `volume={(f) => ...}` curve.
- Do not use generic stock beds ("upbeat corporate", "inspiring piano") as the default. Choose music that fits the product, or none.

## Type and color on screen

- The UI rules apply to every frame: no purple gradient backgrounds (UI-001), no gradient-filled headlines (UI-009), tabular numbers on anything that counts (UI-005).
- Text must stay on screen long enough to read twice. At normal reading speed, plan at least 10 frames per word at 30 fps for anything the viewer must read.
- No filler copy in captions or titles (COPY-001); the words on screen are product copy.

## Done means

- `npx @sloplint/cli check .` reports no `MOTION-*` findings.
- You watched the render at full speed with sound, once without looking at the code.
