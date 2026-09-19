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

  // iy/c are register arguments the frozen collision handler reads directly.
  regs.iy = MARIO_ACTIVE;
  regs.c = mem8[MARIO_Y];
  dispatchBoardCollision(m, MARIO_HITBOX);

  const collided = regs.a; // the handler's collision result
  if (collided === 0) return;

  mem8[MARIO_ACTIVE] = collided - 1;
}
