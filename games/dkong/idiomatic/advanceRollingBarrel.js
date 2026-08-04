// SPDX-License-Identifier: GPL-3.0-only
/**
 * advanceRollingBarrel — the shared tail of the two roll arms: carry the barrel one step along its
 * current run — re-glue it to the girder slope and refresh its sprite orientation — then route it
 * to the ladder detour, or to an edge arm when the position gates fire.
 *
 * Both entry arms have already moved OBJ_X by one and left their slope-step selector in the
 * alternate register bank; everything below reads the record fresh, off the base the walk keeps in
 * the index register.
 *
 * READ:    OBJ_X, OBJ_Y, both off the record base.
 * WRITTEN: OBJ_Y on every arm but the first; the two horizontal-step bytes on the high-X arm only.
 *          Everything else this routine changes is changed by a callee.
 *
 * THE FIVE ARMS, in the order the routine tests them:
 *   1. OBJ_X ≡ 3 (mod 8) — hand the record's X and Y over in the registers and take the ladder
 *      detour, before any of the work below. One X value in eight, so it fires steadily.
 *   2. otherwise the slope snap and the orientation refresh run, and the bottom-of-playfield gate
 *      decides. On the gate's own last arm it takes the walk over — it discards this routine's
 *      return address and carries on itself — and there is nothing left to do here.
 *   3. gate passed, OBJ_X below the low edge — the low-end arm, which stamps the leftward step.
 *   4. gate passed, OBJ_X inside the window — the barrel is mid-playfield, so it goes straight to
 *      the shared sprite publish. This is the overwhelming majority of passes.
 *   5. gate passed, OBJ_X at the high edge or beyond — stamp the mirrored rightward step, +96,
 *      into the record's own horizontal-step bytes and fall into the shared motion writer.
 *
 * THE SLOPE SNAP is called with the record's X, its Y less three, and the entry arm's step
 * selector, and the three come back on afterwards — so what is corrected is a coordinate three
 * pixels off the record's Y, not the Y itself. WHAT THOSE THREE PIXELS ARE IS NOT DETERMINED HERE.
 *
 * NOT CLAIMED. Where the barrel ENDS UP after either edge arm: the vertical half of that motion
 * record is written past this routine, and nothing here was observed on screen. Nor is it claimed
 * that the two edge arms are rare BECAUSE they are edges — they are rare in the runs that were
 * measured, and those runs are one demo.
 *
 * NOT A PARAMETER, deliberately: the record base stays in the index register, because the
 * continuations read that register directly, so a caller passing a different record would be
 * obeyed by the lines below and ignored one call later. The direction code is likewise never
 * touched here — the orientation refresh reads it off the machine itself.
 *
 * LIVE-OUT: memory, plus three register hand-offs, each named for the continuation that consumes
 * it: X and Y in the registers for the ladder detour, and a zeroed accumulator for the shared
 * motion writer. Everything else the arms could leave is dropped — the accumulator on the two
 * middle arms, the X and Y copies on those same arms, the decrement the girder snap applies to the
 * step selector, and every flag.
 */

import { u8 } from "../../../core/int.js";
import { OBJ_X, OBJ_Y } from "./names.js";
import { snapYToGirder } from "./snapYToGirder.js";
import { advanceBarrelSpriteOrientation } from "./advanceBarrelSpriteOrientation.js";

// The record's big-endian signed 16-bit per-frame horizontal step, high byte first, in 1/256-px
// units. The pair carries no shared name, so it is scoped to this file.
const STEP_X_HI = 0x10;
const STEP_X_LO = 0x11;

// The step stamped at the high-X end: +96 in the record's 1/256-px units, three eighths of a
// pixel per frame rightward — the mirror of the −96 the low-end arm stamps.
const STEP_X_RIGHT = 96;

// The X window in which the barrel simply keeps rolling. Below the low edge the low-end arm
// stamps the leftward step; at or above the high edge this routine stamps the rightward one.
const X_LOW_EDGE = 28;
const X_HIGH_EDGE = 228;

// The girder snap is handed a coordinate three pixels off the record's Y, and the three go back
// on its answer. See the header — what the offset represents is not determined here.
const SNAP_OFFSET = 3;

// The return address pushed for the bottom-of-playfield gate. That gate consumes it on the arm
// where it takes the walk over, so the bracket belongs on this side of the call.
const GATE_RETURN = 0x2017;

export function advanceRollingBarrel(
  m,
  slopeStep = m.regs.b /* default: both entry arms leave the selector in this register */,
) {
  const { mem8, regs } = m;
  const record = regs.ix;

  const x = mem8[record + OBJ_X];

  // One X in eight goes straight out to the ladder detour, before any of the work below. That
  // continuation reads both coordinates out of the registers, so they are handed over there.
  if ((x & 7) === 3) {
    regs.h = x;
    regs.l = mem8[record + OBJ_Y];
    return m.call(0x215f);
  }

  // Re-glue the barrel to the girder slope it just stepped along.
  mem8[record + OBJ_Y] = u8(
    snapYToGirder(x, u8(mem8[record + OBJ_Y] - SNAP_OFFSET), slopeStep) + SNAP_OFFSET,
  );

  // Refresh the sprite's orientation bits for this barrel; the refresh takes the record base
  // and the entry arm's direction code off the machine.
  advanceBarrelSpriteOrientation(m);

  // The bottom-of-playfield gate. On its own last arm it discards the return address pushed
  // here and carries the walk on itself, so there is nothing further to do on this record.
  m.push16(GATE_RETURN);
  if (!m.call(0x24b4)) return;

  // Re-read X rather than reuse the value from the top: the gate writes that field itself,
  // though only on the arm that never comes back here.
  const xNow = mem8[record + OBJ_X];
  if (xNow < X_LOW_EDGE) return m.call(0x202f);
  if (xNow < X_HIGH_EDGE) return m.call(0x21ba);

  // Past the high edge: stamp the rightward horizontal step and hand the record to the shared
  // writer that sets the rest of the motion fields.
  mem8[record + STEP_X_HI] = STEP_X_RIGHT >> 8;
  mem8[record + STEP_X_LO] = STEP_X_RIGHT;
  regs.a = 0; // the shared motion writer stores the accumulator into four further record bytes
  return m.call(0x2038);
}
