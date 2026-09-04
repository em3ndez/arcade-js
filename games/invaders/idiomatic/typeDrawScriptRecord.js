// SPDX-License-Identifier: GPL-3.0-only
import { typePacedSpriteRun } from "./typePacedSpriteRun.js";
import { TYPE_PACE_COUNT } from "./names.js";

/**
 * typeDrawScriptRecord — type out one draw-script record with the attract "typewriter" cadence.
 *
 * WHAT IT IS
 *   Draws one record's worth of glyphs one at a time, pausing a few vblank frames between each, so the
 *   attract screens' text appears to be typed rather than popping in all at once.
 *
 * ROLE IN THE MACHINE
 *   The per-record glyph count comes from TYPE_PACE_COUNT (0x206c). The source `de` (glyph-id stream) and
 *   destination `hl` (screen address) are the record the caller just pulled from a draw table (e.g.
 *   typeDrawScript's fetchNextDrawRecord loop, or finishAttractCycle) and are threaded in explicitly. It
 *   delegates to typePacedSpriteRun (0x0a93), which blits each 8x8 glyph and paces 7 vblank frames per
 *   byte on the frame counter.
 *
 * ROM 0x184c-0x1855.  Grounding: [seen].  (On the 8080, C is loaded from 0x206c and BC is preserved
 *   across the call via a push/pop bracket.)
 *
 * Generator (yield* forwards each pace step); memory-only.
 */
export function* typeDrawScriptRecord(m, de, hl) {
  // Type `[TYPE_PACE_COUNT]` glyphs from source de onto screen dest hl, paced one glyph at a time.
  yield* typePacedSpriteRun(m, de, m.mem8[TYPE_PACE_COUNT], hl);
}
