// SPDX-License-Identifier: GPL-3.0-only
import { GAME_MODE } from "./names.js";
import { beginEaromSequenceIfIdle } from "./beginEaromSequenceIfIdle.js";
import { emitReadoutVectorList } from "./emitReadoutVectorList.js";
import { emitFixedHeaderAndClearVectorSlots } from "./emitFixedHeaderAndClearVectorSlots.js";
import { stepVectorPhaseAnimation } from "./stepVectorPhaseAnimation.js";
import { emitPrimedHeaderAndClearVectorSlots } from "./emitPrimedHeaderAndClearVectorSlots.js";
import { emitHalvedCountHeaderAndClearVectorSlots } from "./emitHalvedCountHeaderAndClearVectorSlots.js";
import { initVectorDisplayRegisters } from "./initVectorDisplayRegisters.js";

// Computed dispatch: GAME_MODE holds a byte offset (0,2,4,6,8,10,12) into a 2-byte-per-entry table.
// An offset >= 0x0e is clamped to offset 2 and the clamp persisted to GAME_MODE. Selects the per-frame
// draw handler at offset>>1 and tail-returns its result to this routine's own caller.
const TABLE = [beginEaromSequenceIfIdle, emitReadoutVectorList, emitFixedHeaderAndClearVectorSlots, stepVectorPhaseAnimation, emitPrimedHeaderAndClearVectorSlots, emitHalvedCountHeaderAndClearVectorSlots, initVectorDisplayRegisters];

export function dispatchDrawHandler(m) {
  const { mem8 } = m;
  let i = mem8[GAME_MODE];
  if (i >= 0x0e) { i = 0x02; mem8[GAME_MODE] = 0x02; }
  return TABLE[i >> 1](m);
}
