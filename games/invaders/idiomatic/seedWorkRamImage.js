// SPDX-License-Identifier: GPL-3.0-only
import { blockCopy } from "./blockCopy.js";
import { WORKRAM_INIT_IMAGE, ALIEN_DRAW_PENDING } from "./names.js";

/**
 * seedWorkRamImage -- stamp the object/sprite work area into existence from a fixed ROM template.
 *
 * WHAT IT IS
 *   At cold start (and again on player hand-off and round resets) work RAM holds nothing usable, so the
 *   machine copies a canned image out of ROM into the base of work RAM in one pass -- laying down the whole
 *   object/sprite state block at once.
 *
 * ROLE IN THE MACHINE
 *   blockCopy 0xc0 (192) bytes from WORKRAM_INIT_IMAGE (ROM 0x1b00) to ALIEN_DRAW_PENDING (0x2000, the base
 *   of work RAM); the 192 bytes cover 0x2000-0x20bf, which includes GAME_OBJECT_TABLE at 0x2010. In ROM this
 *   is loc_01e4, which only presets the count B=0xc0 and falls through into the shared initWorkRam (0x01e6)
 *   that runs the copy; the idiomatic layer folds the preset directly into the blockCopy call. Reached from
 *   the player-handoff / round-reset paths (ROM 0x0302 / 0x07f3 / 0x09fd / 0x0b5d); bootInit does NOT come
 *   through here -- it calls the shared initWorkRam (0x01e6) directly with B=0 (a 256-byte copy).
 *
 * ROM 0x01e4-0x01e5 (falling into initWorkRam at 0x01e6).  Grounding: [seen].
 *
 * LIVE-OUT: memory only (the copied block); no register result the callers read.
 */
export function seedWorkRamImage(m) {
  // One byte-for-byte block move: source = the ROM template, destination = 0x2000; both pointers advance.
  blockCopy(m, WORKRAM_INIT_IMAGE, ALIEN_DRAW_PENDING, 0xc0);
}
