// SPDX-License-Identifier: GPL-3.0-only
/**
 * killMarioOnObjectCollision — kill Mario when a board object overlaps his hitbox. Runs once
 * per frame from the object-update cascade: asks the board collision handler whether any active
 * object overlaps Mario's box (half-extents 4 wide, 7 tall), and on a report of 1 clears
 * MARIO_ACTIVE. A report of 0 does nothing.
 *
 * LIVE-OUT: memory-only — MARIO_ACTIVE.
 */

import {
  MARIO_ACTIVE,
  MARIO_HITBOX,
  MARIO_Y,
} from "./names.js";
import { dispatchBoardCollision } from "./dispatchBoardCollision.js";

// Packed hitbox: high byte = 4 (half-width), low byte = 7 (half-height). Not an address.

export function killMarioOnObjectCollision(m) {
  const { regs, mem8 } = m;

  regs.iy = MARIO_ACTIVE; // base of Mario's context block (handler reads MARIO_X from it)
  regs.c = mem8[MARIO_Y];
  dispatchBoardCollision(m, MARIO_HITBOX);

  if (regs.a === 0) return;

  mem8[MARIO_ACTIVE] = regs.a - 1;
}
