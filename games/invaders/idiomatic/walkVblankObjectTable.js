// SPDX-License-Identifier: GPL-3.0-only
import { walkObjectTable } from "./walkObjectTable.js";
import { GAME_OBJECT_TABLE } from "./names.js";

/**
 * walkVblankObjectTable — dispatch the main (vblank-half) object table.
 *
 * WHAT IT IS
 *   A one-line front door that seats the base of the in-game object table and hands off to the general
 *   object-table walker. The walker then runs each active record's handler for this frame.
 *
 * ROLE IN THE MACHINE
 *   The vblank interrupt body reaches the dispatcher through here (the ROM seats the vblank object table
 *   base and calls the walker — mechanisms.md, in-game main loop / round restarts). GAME_OBJECT_TABLE
 *   (0x2010) is the five-record, 16-byte-per-record table for the live game; walkObjectTable counts each
 *   record's timers down, dispatches to the record's fixed handler (player ship, player shot, the two
 *   alien-shot slots, the saucer) when it fires, and stops the walk if a handler arms a warm restart. The
 *   mid-screen half instead calls walkObjectTable with the mid table base directly, so this seater is the
 *   vblank-half entry specifically. ROM 0x0248 is the base-seat that falls into the shared walker at 0x024b.
 *
 * ROM 0x0248.  Grounding: [seen].
 *
 * LIVE-OUT: whatever walkObjectTable leaves; the records it services are edited in place.
 */
export function walkVblankObjectTable(m) {
  // Seat the vblank object-table base (GAME_OBJECT_TABLE) and run the shared walker over it.
  return walkObjectTable(m, GAME_OBJECT_TABLE);
}
