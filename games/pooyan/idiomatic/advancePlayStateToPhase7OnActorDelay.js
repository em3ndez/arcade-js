// SPDX-License-Identifier: GPL-3.0-only
import { loc_250f } from "./loc_250f.js";
import { TAMPER_ROM_CHECK_FLAG, PLAY_STATE_INDEX, TAMPER_STRIKES_HUD_GUARD } from "./names.js";

const HOLD_FIELD = 0x11; //  per-record frame-delay countdown
const SHAPE_FLAG = 0x07; //  value stamped into the selected shape-state cell

/**
 * advancePlayStateToPhase7OnActorDelay — actor-table state 5 handler. Counts the record's frame-delay down; while it is
 * still non-zero it returns. On expiry it stamps 0x07 into the tamper-check flag cell (or, when
 * that cell is already set, into the play-state index), then — if the HUD-guard tally is set —
 * falls into the shape loader keyed by that pointer.
 * LIVE-OUT: memory only on the early paths; the fall-through tail-inherits the shape loader's
 * register live-out (IX/HL/B/A) through the return.
 */
export function advancePlayStateToPhase7OnActorDelay(m, rec = m.regs.ix) {
  const { mem8 } = m;

  mem8[rec + HOLD_FIELD] = mem8[rec + HOLD_FIELD] - 1;
  if (mem8[rec + HOLD_FIELD] !== 0) return; // still holding this frame

  const shapePtr = mem8[TAMPER_ROM_CHECK_FLAG] !== 0 ? TAMPER_ROM_CHECK_FLAG : PLAY_STATE_INDEX;
  mem8[shapePtr] = SHAPE_FLAG;

  if (mem8[TAMPER_STRIKES_HUD_GUARD] === 0) return;
  return loc_250f(m, shapePtr, rec); // reload a shape from the pointer just written
}
