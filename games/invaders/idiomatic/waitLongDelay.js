// SPDX-License-Identifier: GPL-3.0-only
import { waitFrames } from "./waitFrames.js";

// Longer attract delay: wait 0x80 frames. Generator; memory-only.
export function* waitLongDelay(m) {
  yield* waitFrames(m, 0x80);
}
