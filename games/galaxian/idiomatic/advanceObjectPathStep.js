// SPDX-License-Identifier: GPL-3.0-only
/**
 * advanceObjectPathStep -- object-AI state 1: the shared per-object path-walk step.
 *
 * WHAT IT IS
 *   Slot 1 of the sixteen-entry object-AI state table (the driveObjectSlot dispatch table at ROM 0x0ce6,
 *   entered at ROM 0x0d71). It walks one attacker along its scripted launch path by reading delta pairs
 *   from PATH_STEP_TABLE (ROM 0x1e00) through a per-object cursor. State index 11 (advanceObjectPathStepAlias)
 *   forwards straight here, so two states share this body.
 *
 * ROLE IN THE MACHINE
 *   Each call consumes one (Y-delta, X-delta) pair. The first byte is added to the object's Y (ix+3); the
 *   cursor advances and the second byte becomes the X delta applied to X (ix+4), its sign chosen by the
 *   direction bit (ix+6 bit0: set = move toward the far edge, so subtract; clear = add). If the resulting
 *   X (plus a 7px sprite margin) crosses the near edge (< NEAR_EDGE) the object has walked off the near
 *   side: force state (ix+2) = 5, the fall-away state, and return. Otherwise the cursor is stepped past
 *   the pair, the move throttle (ix+16) is ticked, and only when it drains does the leg advance -- reload
 *   the throttle to 4, nudge the cross-step counter (ix+5) one count in the travel direction, and tick the
 *   leg counter (ix+17). When the last leg finishes the dispatch state advances by one.
 *
 * ROM 0x0d71.  Grounding: [seen] (write-tap confirmed; launch path matched vs MAME).
 *
 * LIVE-OUT: object record cells -- Y ix+3, X ix+4, cross-step ix+5, throttle ix+16, legs ix+17,
 * cursor ix+19, state index ix+2.
 */
import { PATH_STEP_TABLE } from "./names.js";

// Field offsets within the object record addressed by `obj`.
const STATE = 2; // path state index
const POS_Y = 3; // takes the first step delta
const POS_X = 4; // takes the second (direction-controlled) step delta; bounds-checked
const CROSS_STEP = 5; // nudged one count per leg
const DIR_FLAG = 6; // bit0: X moves toward the far edge
const THROTTLE = 16; // frames between cursor advances
const LEGS = 17; // legs remaining before the state advances
const CURSOR = 19; // read cursor into the step table

const NEAR_EDGE = 14; // X (plus a 7px margin) below this is off the near side

export function advanceObjectPathStep(m, obj = m.regs.ix) {
  const { mem8 } = m;

  // Read the per-object cursor (ix+19) and add the first byte of the pair (the Y delta) to Y (ix+3).
  let cursor = mem8[obj + CURSOR];
  mem8[obj + POS_Y] = mem8[obj + POS_Y] + mem8[PATH_STEP_TABLE + cursor];

  // Advance the cursor to the pair's second byte and read it as the X delta.
  cursor = (cursor + 1) & 0xff; // second byte of the pair is the X delta
  const xStep = mem8[PATH_STEP_TABLE + cursor];
  // Direction bit (ix+6 bit0): set -> travelling toward the far edge, so subtract; clear -> add.
  const goingFar = mem8[obj + DIR_FLAG] & 0x01;

  // Apply the direction-controlled X delta to X (ix+4), wrapping in a byte.
  const x = (goingFar ? mem8[obj + POS_X] - xStep : mem8[obj + POS_X] + xStep) & 0xff;
  mem8[obj + POS_X] = x;

  // Off the near edge (X + 7px margin < NEAR_EDGE): drop straight to the fall-away state and stop.
  if (((x + 7) & 0xff) < NEAR_EDGE) { mem8[obj + STATE] = 5; return; } // off the near edge

  // Still on screen: persist the advanced cursor past this pair (the byte store wraps).
  mem8[obj + CURSOR] = cursor + 1; // step past the pair (byte store wraps)

  // Tick the move throttle (ix+16); hold in this leg until it drains to zero.
  mem8[obj + THROTTLE] = mem8[obj + THROTTLE] - 1;
  if (mem8[obj + THROTTLE] !== 0) return;
  // Throttle expired: reload it for the next leg.
  mem8[obj + THROTTLE] = 4;

  // Nudge the cross-step counter (ix+5) one count in the travel direction (far = +1, near = -1).
  mem8[obj + CROSS_STEP] = mem8[obj + CROSS_STEP] + (goingFar ? 1 : -1);

  // Tick the leg counter (ix+17); when the last leg finishes, advance the dispatch state (ix+2).
  mem8[obj + LEGS] = mem8[obj + LEGS] - 1;
  if (mem8[obj + LEGS] !== 0) return;
  mem8[obj + STATE] = mem8[obj + STATE] + 1;
}
