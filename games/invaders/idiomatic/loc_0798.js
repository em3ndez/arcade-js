// SPDX-License-Identifier: GPL-3.0-only
import { loc_079b } from "./loc_079b.js";

// One-player game start: no two-player flag, deduct a single credit, then run the shared game-start init.
// Generator.
export function* loc_0798(m) {
  yield* loc_079b(m, 0x00, 0x99);
}
