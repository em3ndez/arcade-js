// SPDX-License-Identifier: GPL-3.0-only
import { waitFrames } from "./waitFrames.js";

// Short attract delay: wait 0x40 frames. Generator; memory-only.
export function* loc_0ab1(m) {
  yield* waitFrames(m, 0x40);
}
