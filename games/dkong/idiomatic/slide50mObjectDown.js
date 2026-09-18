// SPDX-License-Identifier: GPL-3.0-only
/**
 * slide50mObjectDown — the descend arm of a conveyor-board object's state machine: tick the
 * object's timer, step its position counter UP (which moves it DOWN the screen, larger Y being
 * lower), mirror the new position to its sprite, advance the state at the bottom of travel, then,
 * while Mario is on the object's column, settle his climb one pixel at a time. The exact mirror of
 * the sibling raise arm, which steps DOWN toward the counter's minimum and resets the record.
 * Record fields: +0 state, +2 the object's column (fed to the hit test), +3 the position counter,
 * +4 a per-tick timer. LIVE-OUT: memory-only.
 */

import { MARIO_Y } from "./names.js";
import { publish50mObjectYToSprite } from "./publish50mObjectYToSprite.js";
import { marioReachedTargetColumn } from "./marioReachedTargetColumn.js";
import { stepMarioDownInClimbPose } from "./stepMarioDownInClimbPose.js";

// The counter's maximum — the object's lowest point on screen; at it the state advances.
const COUNTER_BOTTOM = 120;
const TIMER_RELOAD = 4;
// The climb's settle line as a screen Y: while Mario's Y is smaller he is still above it.
const CENTRING_BAND = 104;
// Shared climb-centring toggle; file-local because no reader settles its meaning.
const CLIMB_CENTRING_TOGGLE = 0x6222;

export function slide50mObjectDown(m, recordBase) {
  const { regs, mem8 } = m;

  // Address of record field N, kept on the record's own page (the pointer walk steps only the
  // low byte, so a field address never crosses a page boundary).
  const field = (n) => (recordBase & 0xff00) | ((recordBase + n) & 0xff);

  const timer = (mem8[field(4)] - 1) & 0xff;
  mem8[field(4)] = timer;
  if (timer !== 0) return;

  mem8[field(4)] = TIMER_RELOAD;
  const counter = (mem8[field(3)] + 1) & 0xff;
  mem8[field(3)] = counter;

  publish50mObjectYToSprite(m, field(3));

  if (counter === COUNTER_BOTTOM) {
    mem8[field(0)] = mem8[field(0)] + 1;
  }

  // Is Mario on this object's column (+2)? On a miss the shared caller-skip unwinds two levels.
  if (!marioReachedTargetColumn(m, field(2))) return;

  // Above the settle line (smaller Y) or on an odd row: keep stepping him down in the climb pose.
  const marioY = mem8[MARIO_Y];
  if (marioY < CENTRING_BAND || (marioY & 1) !== 0) {
    stepMarioDownInClimbPose(m);
    return;
  }

  // Settled, on an even row: publish the centring toggle from bit 1 of his screen Y.
  mem8[CLIMB_CENTRING_TOGGLE] = (marioY >> 1) & 1;
}
