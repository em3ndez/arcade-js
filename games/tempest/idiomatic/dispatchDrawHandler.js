// SPDX-License-Identifier: GPL-3.0-only
import { GAME_MODE } from "./names.js";
import { beginEaromSequenceIfIdle } from "./beginEaromSequenceIfIdle.js";
import { emitReadoutVectorList } from "./emitReadoutVectorList.js";
import { emitFixedHeaderAndClearVectorSlots } from "./emitFixedHeaderAndClearVectorSlots.js";
import { stepVectorPhaseAnimation } from "./stepVectorPhaseAnimation.js";
import { emitPrimedHeaderAndClearVectorSlots } from "./emitPrimedHeaderAndClearVectorSlots.js";
import { emitHalvedCountHeaderAndClearVectorSlots } from "./emitHalvedCountHeaderAndClearVectorSlots.js";
import { initVectorDisplayRegisters } from "./initVectorDisplayRegisters.js";

/**
 * dispatchDrawHandler -- select and run the per-frame draw handler on the display-finalize path. ROM 0xdb0f.
 *
 * Role in the machine: on the self-test / display-finalize path (runSelfTestLoop builds each frame through
 * here) the machine has to emit one of several vector-list bodies -- the EAROM high-score sequence, the
 * readout vector list, the fixed/primed/halved-count header variants, the phase animation, and the vector
 * display-register init. Which one runs is chosen per frame from the mode cell via a computed jump.
 *
 * Behavior: GAME_MODE (0x0) holds a byte offset (0,2,4,6,8,10,12) into a 2-byte-per-entry table. An
 * out-of-range offset (>= 0x0e) is clamped to offset 0x02 and the clamp is persisted back to GAME_MODE so
 * the machine never dispatches off the end of the table. The seven-entry TABLE is then indexed at
 * offset>>1 -- beginEaromSequenceIfIdle, emitReadoutVectorList, emitFixedHeaderAndClearVectorSlots,
 * stepVectorPhaseAnimation, emitPrimedHeaderAndClearVectorSlots, emitHalvedCountHeaderAndClearVectorSlots,
 * initVectorDisplayRegisters -- and that handler is tail-called, its result returned to this routine's caller.
 *
 * Live-out: GAME_MODE (possibly clamped to 0x02) plus whatever vector state the selected handler emits.
 * Grounding: [seen].
 */
const TABLE = [beginEaromSequenceIfIdle, emitReadoutVectorList, emitFixedHeaderAndClearVectorSlots, stepVectorPhaseAnimation, emitPrimedHeaderAndClearVectorSlots, emitHalvedCountHeaderAndClearVectorSlots, initVectorDisplayRegisters];

export function dispatchDrawHandler(m) {
  const { mem8 } = m;
  let i = mem8[GAME_MODE];
  if (i >= 0x0e) { i = 0x02; mem8[GAME_MODE] = 0x02; }
  return TABLE[i >> 1](m);
}
