// SPDX-License-Identifier: GPL-3.0-only
import { loc_0ad7 } from "./loc_0ad7.js";

// Longer attract delay: wait 0x80 frames. Generator; memory-only.
export function* loc_0ab6(m) {
  yield* loc_0ad7(m, 0x80);
}
