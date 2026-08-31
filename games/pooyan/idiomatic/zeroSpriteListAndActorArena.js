// SPDX-License-Identifier: GPL-3.0-only
import { fillByteRun } from "./fillByteRun.js";
import { SPRITE_DISPLAY_LIST, ACTOR_TABLE } from "./names.js";
/**
 * zeroSpriteListAndActorArena — wipe the two moving-object RAM regions clean at the
 * start of a fresh board.
 *
 * WHAT IT IS
 *   ROM 0x02b9. Grounding: [seen]. This is the board-init scrub for everything that
 *   moves on screen. At the very first board, and again between rounds, the engine has
 *   to throw away every stale sprite coordinate and every stale actor record so the new
 *   board starts from a blank slate: no leftover sprites hanging in the hardware sprite
 *   banks, and no half-alive enemy / projectile / formation records carried across from
 *   the round that just ended. It does that scrub with two byte-fill passes, both
 *   writing the value 0.
 *
 * ITS ROLE IN THE MACHINE
 *   The moving world lives in two separate RAM areas, and this routine clears both:
 *
 *   1. The sprite DISPLAY LIST at 0x8840 — a 24-entry, stride-4 staging table (each
 *      entry is Y / attribute / colour / X) that mirrors the hardware sprite layout.
 *      The engine rebuilds this table every frame and copies it out to the sprite
 *      banks, so it is the single place that decides what appears on screen.
 *
 *   2. The ACTOR ARENA at 0x8a80 — a flat array of fixed-size 0x18-byte object records.
 *      Slot 0 is the player / lead actor; the rest hold the enemies, thrown objects,
 *      projectiles, formation slots and the assorted spawn / target records that make
 *      up the board's object world. Byte 0 of each record is its "slot active" flag.
 *
 *   Clearing both regions to zero drops any surviving sprite off the screen and makes
 *   every "slot active" flag read 0, so the spawners see an empty arena and repopulate
 *   it from scratch for the new board.
 *
 * WHAT IT LEAVES BEHIND (LIVE-OUT)
 *   The scrub is destructive-write only, but the byte-fill primitive also settles its
 *   registers into a known state that the next routine reads back:
 *     A  = 0 — the fill value, still sitting in the accumulator; a caller wanting a
 *              zero constant can take it straight from here.
 *     B  = 0 — the fill loop counter, always drained to zero by the final pass.
 *     HL = the address one past the last byte cleared (the end of the actor-arena run),
 *          ready to be reused as a pointer.
 */

const FILL_ZERO = 0x00;
// Sprite display list = 24 entries of 4 bytes = 0x60 bytes (0x8840..0x889f): one full
// staging table, with Y / attribute / colour / X for every moving object.
const SPRITE_LIST_BYTES = 0x60;
// Actor arena = 0x237 bytes (0x8a80..0x8cb6), the whole object world in one run. The
// length decomposes as two full 256-byte pages plus a 0x37-byte tail, and that span
// covers the player record and every enemy / object / projectile / formation slot.
const ACTOR_ARENA_BYTES = 0x237; // 2x256-byte pages + 0x37, the arena cleared in one run

export function zeroSpriteListAndActorArena(m) {
  // Pass 1 — clear the sprite display list at 0x8840 (0x60 bytes). Zeroing the whole
  // staging table takes every sprite from the previous board off screen: each entry's
  // Y and attribute read 0, and stay that way until the per-frame rebuild refills the
  // table.
  fillByteRun(m, SPRITE_DISPLAY_LIST, FILL_ZERO, SPRITE_LIST_BYTES);
  // Pass 2 — clear the actor arena at 0x8a80 (0x237 bytes) in a single sweep. This
  // wipes slot 0 (the player / lead actor) and every downstream enemy, projectile,
  // formation and spawn record; since byte 0 of each record is its "slot active" flag,
  // the arena reads as fully empty. This pass is also what leaves B = 0 and HL pointing
  // at the end of the run for the caller.
  fillByteRun(m, ACTOR_TABLE, FILL_ZERO, ACTOR_ARENA_BYTES); // sets the B=0 and HL live-outs
  // Hand back the zero fill byte in A: the value last written into the arena is still
  // in the accumulator, and it is the routine's live-out constant.
  return (m.regs.a = FILL_ZERO); // A live-out: the zero fill byte
}
