// SPDX-License-Identifier: GPL-3.0-only
/**
 * killMarioOnObjectCollision — kill Mario when a board object overlaps his hitbox.
 * ROM 0x2808.
 *
 * Run once per frame from the update cascade (loc_197a, 0x19b6). It asks the current
 * board's collision handler whether any active board object (barrel, fireball, oil
 * flame, …) overlaps Mario, and if one does it clears Mario's alive flag — which the
 * movement machine reads as death and turns into the death → life-loss → respawn cycle.
 *
 * The overlap test is a bounding box centred on Mario: his Y goes in as the search's
 * compare coordinate, his X is read by the handler from the block base (base + 3 =
 * MARIO_X), and the box half-extents are 4 wide and 7 tall. The handler sweeps its
 * object arrays and reports a single byte: 1 if some object's box overlaps Mario, 0 if
 * none do.
 *
 * On a report of 0 (no overlap) the frame does nothing. On a report of 1 (an overlap)
 * that byte minus one — i.e. 0 — is written into MARIO_ACTIVE, marking Mario dead. The
 * handler only ever reports 0 or 1, so this is exactly "leave Mario alone, or kill him".
 *
 * Memory-equivalent to the frozen oracle — equivalence-2808.test.js.
 * GATE:     memory-equivalence (RAM − STACK_SCRATCH, pc, SP) with the FULL oracle
 *           collision handler run on both sides. Real captured attract dispatches cover
 *           the natural 25m distribution; crafted entries pin BOTH arms deterministically
 *           — a hit (one object placed exactly on Mario, all others deactivated) and a
 *           clean miss (every swept record deactivated). Teeth: a no-decrement twin
 *           (writes 1 not 0 on a hit), an always-write twin (writes on a miss), and a
 *           wrong-coordinate twin (feeds Mario's X where his Y belongs, so the box misses).
 * LIVE-OUT: memory-only (MARIO_ACTIVE). The caller issues its next collision call without
 *           reading a register or flag, so the oracle's residual A/flags and its `ret`
 *           chain are dead. pc/SP still line up: the collision handler's own return
 *           consumes the caller's return address directly (this routine pushes nothing of
 *           its own), so dropping the oracle's call/ret bracket leaves only dead stack
 *           scratch, excluded by the memory-equivalence contract.
 * NAMES:    MARIO_ACTIVE (0x6200, also the block base fed to the handler), MARIO_Y
 *           (0x6205) — from ram.js. MARIO_X (0x6203 = base + 3) is read by the handler,
 *           not here. The 0x0407 hitbox is a packed ROM immediate, kept as a local const.
 */

import { MARIO_ACTIVE, MARIO_Y } from "./ram.js";
import { dispatchBoardCollision } from "./dispatchBoardCollision.js"; // ROM 0x286F

// Mario's collision box, packed as the handler wants it: high byte = 4 (half-width, the
// X extent), low byte = 7 (half-height, the Y extent). A ROM immediate, not work RAM.
const MARIO_HITBOX = 0x0407;

export function killMarioOnObjectCollision(m) {
  const { regs, mem } = m;

  // Hand the board collision handler Mario's search inputs: the block base (it reads
  // Mario's X from base + 3 = MARIO_X), his Y as the compare coordinate, and the box
  // half-extents. These are exactly the register loads the collision handler consumes.
  regs.iy = MARIO_ACTIVE; // 0x6200 — base of Mario's context block
  regs.c = mem.read8(MARIO_Y);
  regs.hl = MARIO_HITBOX;
  dispatchBoardCollision(m);

  // The handler leaves its verdict in the result byte: 0 = nothing overlaps Mario, so
  // there is nothing to do this frame.
  if (regs.a === 0) return;

  // An object overlaps Mario: verdict − 1 (i.e. 0) into MARIO_ACTIVE kills him.
  mem.write8(MARIO_ACTIVE, regs.a - 1);
}
