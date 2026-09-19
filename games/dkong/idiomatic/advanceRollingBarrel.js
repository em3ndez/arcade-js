// SPDX-License-Identifier: GPL-3.0-only
/**
 * advanceRollingBarrel — shared tail of the two roll arms: carry the barrel one step along its
 * run (re-glue it to the girder slope, refresh its sprite orientation), then route it to the
 * ladder detour or to an edge arm as the position gates fire. Most passes are mid-playfield and
 * fall straight through to the shared sprite publish.
 *
 * The record base stays in the index register on purpose: the continuations read that register
 * directly, so a caller passing a different record would be obeyed by the lines here and ignored
 * one call later. The direction code is likewise never touched — the orientation refresh reads it
 * off the machine itself.
 */

import { u8 } from "../../../core/int.js";
import {
  BARREL_ROLL_GATE_RETURN,
  OBJ_X,
  OBJ_Y,
} from "./names.js";
import { snapYToGirder } from "./snapYToGirder.js";
import { advanceBarrelSpriteOrientation } from "./advanceBarrelSpriteOrientation.js";

// The record's big-endian signed 16-bit per-frame horizontal step (1/256-px units), unshared so
// scoped here.
const STEP_X_HI = 0x10;
const STEP_X_LO = 0x11;

// Step stamped at the high-X end: +96 (three eighths of a pixel/frame rightward), the mirror of
// the low-end arm's −96.
const STEP_X_RIGHT = 96;

// The X window in which the barrel simply keeps rolling.
const X_LOW_EDGE = 28;
const X_HIGH_EDGE = 228;

// The girder snap works on a coordinate three pixels off the record's Y; the three go back on.
const SNAP_OFFSET = 3;

// Return address for the bottom-of-playfield gate, which consumes it on the arm where it takes the
// walk over.

export function advanceRollingBarrel(
  m,
  slopeStep = m.regs.b /* default: both entry arms leave the selector in this register */,
) {
  const { mem8, regs } = m;
  const record = regs.ix;

  const x = mem8[record + OBJ_X];

  // One X in eight takes the ladder detour, which reads both coordinates out of the registers.
  if ((x & 7) === 3) {
    regs.h = x;
    regs.l = mem8[record + OBJ_Y];
    return m.call(0x215f);
  }

  // Re-glue the barrel to the girder slope it just stepped along.
  mem8[record + OBJ_Y] = u8(
    snapYToGirder(x, u8(mem8[record + OBJ_Y] - SNAP_OFFSET), slopeStep) + SNAP_OFFSET,
  );

  advanceBarrelSpriteOrientation(m);

  // On its own last arm the gate discards this return address and carries the walk on itself.
  m.push16(BARREL_ROLL_GATE_RETURN);
  if (!m.call(0x24b4)) return;

  // Re-read X: the gate writes that field itself, though only on the arm that never comes back.
  const xNow = mem8[record + OBJ_X];
  if (xNow < X_LOW_EDGE) return m.call(0x202f);
  if (xNow < X_HIGH_EDGE) return m.call(0x21ba);

  // Past the high edge: stamp the rightward step, hand to the shared motion writer.
  mem8[record + STEP_X_HI] = STEP_X_RIGHT >> 8;
  mem8[record + STEP_X_LO] = STEP_X_RIGHT;
  regs.a = 0; // the shared writer stores the accumulator into four further record bytes
  return m.call(0x2038);
}
