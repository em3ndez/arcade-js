// SPDX-License-Identifier: GPL-3.0-only
/** enterVblankInterrupt — the per-frame interrupt entry: control lands here once a frame and hands straight on to the frame-service handler, writing nothing of its own. LIVE-OUT: memory. */

import { saveAccumulatorForFrameInterrupt } from "./saveAccumulatorForFrameInterrupt.js";

export function enterVblankInterrupt(m) {
  return saveAccumulatorForFrameInterrupt(m);
}
