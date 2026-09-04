// SPDX-License-Identifier: GPL-3.0-only
import { typePacedSpriteRun } from "./typePacedSpriteRun.js";
import { loc_2b14 } from "./names.js";

// Type a 0x0f-byte block to a fixed screen destination, using the caller's source pointer `de`.
// Generator; memory-only.
export function* loc_0acf(m, de) {
  yield* typePacedSpriteRun(m, de, 0x0f, loc_2b14);
}
