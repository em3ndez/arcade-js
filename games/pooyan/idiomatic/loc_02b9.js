// SPDX-License-Identifier: GPL-3.0-only
import { loc_0010 } from "./loc_0010.js";
import { SPRITE_DISPLAY_LIST, ACTOR_TABLE } from "./names.js";
/**
 * loc_02b9 — zero the two board-init RAM regions at a fresh start.
 *
 * Clears the sprite display-list region (a short run from its base) and the whole actor/object
 * arena (a long run from the actor-table base) to zero, reusing the byte-fill helper for each run
 * so the drained counter and advanced pointer fall out of it.
 *
 * LIVE-OUT: A = 0 (the fill byte, not restored across the ret), B = 0 (the fill counter drained
 * to zero) and HL = the end of the actor-arena run; set for a register-dispatched caller.
 */

const FILL_ZERO = 0x00;
const SPRITE_LIST_BYTES = 0x60;
const ACTOR_ARENA_BYTES = 0x237; // 2x256-byte pages + 0x37, the arena cleared in one run

export function loc_02b9(m) {
  loc_0010(m, SPRITE_DISPLAY_LIST, FILL_ZERO, SPRITE_LIST_BYTES);
  loc_0010(m, ACTOR_TABLE, FILL_ZERO, ACTOR_ARENA_BYTES); // sets the B=0 and HL live-outs
  return (m.regs.a = FILL_ZERO); // A live-out: the zero fill byte
}
