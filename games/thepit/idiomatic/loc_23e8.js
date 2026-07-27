// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_23e8 — seed a tilemap write pointer and a countdown, then conditionally cue a
 * sound and stamp a two-tile "cap" into the tilemap.  ROM 0x23e8.
 *
 * Runs during the boot/attract setup. In order it:
 *   1. Stores a fixed tilemap address (0x9104) into the pointer slot COLUMN_ANIM_WRITE_PTR
 *      (0x8065), so later code that walks the tilemap starts from that cell.
 *   2. Writes a countdown into COLUMN_ANIM_TIMER (0x8067): the STEP_TIMER_BASE parameter
 *      (0x804f) minus four counts for every unit of the LEVEL counter (0x8028). The
 *      subtraction wraps within one byte.
 *   3. If the marker cell at tilemap 0x9264 holds the trigger tile (0x32), cues a sound.
 *   4. If the head cell at tilemap 0x90e4 still holds its 0xfe marker, stamps tile 0xae
 *      into it and tile 0xac into the cell one row above it (0x90c4, 32 columns up);
 *      otherwise it leaves the tilemap untouched.
 *
 * Kept as the neutral address name: the game role of the pointer, the countdown, and
 * the tile patch is not yet understood, and a wrong English name would mislead worse
 * than the address. The tile-code and marker bytes (0x32 / 0xae / 0xac / 0xfe) are
 * opaque graphics-ROM indices, kept hex like the other marker bytes in this layer.
 *
 * Memory-equivalent to the frozen oracle — equivalence-23e8.test.js.
 * GATE:     real captured dispatches (8 in a 1500-frame attract run — they cover the
 *           pointer + countdown writes and BOTH head-cell arms) + crafted entries that
 *           force the sound arm (attract never presents the trigger tile) and sweep the
 *           countdown inputs. RAM compared outside the dead stack scratch the oracle's
 *           sound path parks just below the entry stack pointer. Teeth catch a wrong
 *           countdown, a wrong pointer, a dropped tile patch and a dropped sound cue.
 * LIVE-OUT: memory-only — 0x8065 / 0x8067 and the two tilemap cells, plus the sound
 *           ring on the cued arm. The oracle's exit registers, flags and Z80 return
 *           path are dead scratch a plain JS call replaces.
 * NAMES:    LEVEL (0x8028), STEP_TIMER_BASE (0x804f), COLUMN_ANIM_WRITE_PTR (0x8065) and
 *           COLUMN_ANIM_TIMER (0x8067) from ram.js; the tilemap cells (0x9104 / 0x9264 /
 *           0x90e4 / 0x90c4) stay hex. Delegates the sound cue to requestSound21, which
 *           owns the sound-ring addresses.
 */
import { requestSound21 } from "./requestSound21.js";

import { COLUMN_ANIM_TIMER, COLUMN_ANIM_WRITE_PTR, LEVEL, STEP_TIMER_BASE } from "./ram.js";
export function loc_23e8(m) {
  const { mem8, mem16 } = m;

  // 1. Seed the tilemap write pointer for later tilemap walks.
  mem16[COLUMN_ANIM_WRITE_PTR] = 0x9104;

  // 2. Countdown = gameplay parameter minus four per unit of the counter (wraps in a byte).
  mem8[COLUMN_ANIM_TIMER] = mem8[STEP_TIMER_BASE] - 4 * mem8[LEVEL];

  // 3. Cue a sound when the marker cell holds the trigger tile.
  if (mem8[0x9264] === 0x32) requestSound21(m);

  // 4. Stamp the two-tile cap only while the head cell still holds its 0xfe marker.
  if (mem8[0x90e4] !== 0xfe) return;
  mem8[0x90e4] = 0xae; // head cell
  mem8[0x90c4] = 0xac; // the cell one row (32 columns) above it
}
