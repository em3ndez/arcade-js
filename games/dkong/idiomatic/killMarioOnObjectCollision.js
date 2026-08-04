// SPDX-License-Identifier: GPL-3.0-only
/**
 * killMarioOnObjectCollision — kill Mario when a board object overlaps his hitbox.
 *
 * Runs once per frame from the object-update cascade. It asks the current board's collision
 * handler whether any active board object (barrel, fireball, oil flame, …) overlaps Mario, and if
 * one does it clears Mario's alive flag — which the movement machine reads as death and turns into
 * the death → life-loss → respawn cycle.
 *
 * The overlap test is a bounding box centred on Mario: his Y goes in as the search's compare
 * coordinate, his X is read by the handler out of his context block, and the box half-extents are
 * 4 wide and 7 tall. The handler sweeps its object arrays and reports a single byte: 1 if some
 * object's box overlaps Mario, 0 if none do.
 *
 * A report of 0 means nothing happens this frame. On a report of 1 that byte minus one — i.e. 0 —
 * goes into MARIO_ACTIVE, marking Mario dead. The handler only ever reports 0 or 1, so this is
 * exactly "leave Mario alone, or kill him".
 *
 * LIVE-OUT: memory-only — MARIO_ACTIVE.
 */

import { MARIO_ACTIVE, MARIO_Y } from "./names.js";
import { dispatchBoardCollision } from "./dispatchBoardCollision.js";

// Mario's collision box, packed as the handler wants it: high byte = 4 (half-width, the
// X extent), low byte = 7 (half-height, the Y extent). A packed constant, not an address.
const MARIO_HITBOX = 0x0407;

export function killMarioOnObjectCollision(m) {
  const { regs, mem } = m;

  // Hand the board collision handler Mario's search inputs: the base of his context block (it
  // reads MARIO_X out of that), his Y as the compare coordinate, and the box half-extents. These
  // are exactly the registers the collision handler consumes.
  regs.iy = MARIO_ACTIVE; // the base of Mario's context block
  regs.c = mem.read8(MARIO_Y);
  regs.hl = MARIO_HITBOX;
  dispatchBoardCollision(m);

  // The handler leaves its verdict in the result byte: 0 = nothing overlaps Mario, so
  // there is nothing to do this frame.
  if (regs.a === 0) return;

  // An object overlaps Mario: verdict − 1 (i.e. 0) into MARIO_ACTIVE kills him.
  mem.write8(MARIO_ACTIVE, regs.a - 1);
}
