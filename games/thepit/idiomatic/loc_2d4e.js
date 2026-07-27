// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_2d4e — land the descending dig/capture target when it reaches terrain.  ROM 0x2d4e.
 *
 * The caller (loc_2d06) steps the target object one row down each frame, works out the
 * map cell it now sits in, and checks the tile just ahead of it. When that tile is one of
 * the "solid terrain" codes, control arrives here: the target has hit ground and stops.
 * This routine settles it:
 *   - sounds the arrival cue,
 *   - stamps the finished-target tile into the map cell just ahead of where it stopped,
 *   - resets the target's small state block to its finished configuration: the spawn gate
 *     reopens to idle (a fresh target may now be seeded), the target X clears, the state
 *     byte takes the done/target code, and the attribute byte takes its fixed colour,
 *   - then hands off to the record builder, which composes the target's 4-byte sprite
 *     record from that block and carries on with the rest of the frame's object work.
 *
 * The target's map-cell pointer arrives in a register from the still-oracle caller (the
 * one genuine boundary), so it is surfaced as a parameter defaulting to that register; a
 * fully-decompiled caller can pass the cell directly. The stamp lands one cell before the
 * pointer, matching the caller's own "one cell ahead" probe offset.
 *
 * Memory-equivalent to the frozen oracle — equivalence-2d4e.test.js.
 * GATE:     crafted-entry — this arm never runs in attract (it requests a sound attract
 *           never asks for), so the gate runs it from a real captured attract state with
 *           the target cell pointer placed in video RAM; both arms then run the full
 *           downstream record-build/animation tail, so the diff isolates this routine's
 *           own writes. Teeth catch a wrong stamped tile and a wrong state code.
 * LIVE-OUT: memory-only — the queued sound, the stamped tile, and the four reset
 *           state-block bytes (everything the shared downstream tail writes is identical
 *           on both sides). The tail return just propagates the downstream result; no
 *           register or flag is a live-out.
 * NAMES:    TARGET_X, DIG_OBJ_STATE, DIG_OBJ_ATTR, SPAWN_STATE from ram.js. The stamped
 *           tile code and the two seed values stay literal; the record builder at 0x2bd3
 *           has no idiomatic form yet, so the tail hands off to the frozen oracle.
 */

import { requestSound17 } from "./requestSound17.js";
import { stageDigObjectSpriteRecord } from "./stageDigObjectSpriteRecord.js";
import { TARGET_X, DIG_OBJ_STATE, DIG_OBJ_ATTR, SPAWN_STATE } from "./ram.js";

export function loc_2d4e(m, targetCell = m.regs.ix) {
  const { mem8 } = m;

  // Arrival cue for the target reaching terrain.
  requestSound17(m);

  // Stamp the finished-target tile into the map cell one ahead of where the target stopped.
  mem8[targetCell - 31] = 65;

  // Settle the target's state block into its finished configuration.
  mem8[SPAWN_STATE] = 0; // spawn gate reopens: a fresh target may now be seeded
  mem8[TARGET_X] = 0; // clear the target X
  mem8[DIG_OBJ_STATE] = 9; // done/target state code
  mem8[DIG_OBJ_ATTR] = 7; // fixed colour/attribute for the settled target

  // Build the target's sprite record from the block just written, then continue the frame.
  return stageDigObjectSpriteRecord(m);
}
