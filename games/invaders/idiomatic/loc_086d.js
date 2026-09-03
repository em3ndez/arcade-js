// SPDX-License-Identifier: GPL-3.0-only
import { loc_079b } from "./loc_079b.js";

// Two-player game start: set the two-player flag, deduct two credits, then run the shared game-start init.
// Generator.
export function* loc_086d(m) {
  yield* loc_079b(m, 0x01, 0x98);
}
