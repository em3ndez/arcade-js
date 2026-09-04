// SPDX-License-Identifier: GPL-3.0-only
import { drawSpriteList } from "./drawSpriteList.js";
import { fetchNextDrawRecord } from "./fetchNextDrawRecord.js";
import { drawSpriteColumn16 } from "./drawSpriteColumn16.js";
import { typeSecondDrawScript } from "./typeSecondDrawScript.js";
import { TYPE_PACE_COUNT, loc_2810, loc_1ca3, loc_1dbe } from "./names.js";
import { u16 } from "../../../core/int.js";

/**
 * drawScoreAdvanceTable — paint the attract-mode "score advance" table (the point-value screen).
 *
 * WHAT IT IS
 *   One of the attract screens: a header line followed by the table that shows how many points each
 *   alien type and the mystery saucer are worth. It draws in two passes — a header string and a run of
 *   16-row sprite columns laid down instantly (the aliens/values), then a second script that types its
 *   material out with a per-glyph delay for the animated "reveal" feel.
 *
 * ROLE IN THE MACHINE
 *   Part of the attract sequence (mechanisms.md, attract screen). It first draws the header via
 *   drawSpriteList: 0x15 (21) sprite ids from loc_1ca3 to the screen address loc_2810. It sets the typed
 *   cadence TYPE_PACE_COUNT (0x206c) to 0x0a so the later typed script paces at ten frames per glyph.
 *   The first (no-delay) draw script is the 4-byte-record table at loc_1dbe: each record carries a screen
 *   destination and a graphics source, fetched by fetchNextDrawRecord and blitted as a fixed 16-row
 *   column by drawSpriteColumn16, until a 0xff first byte terminates it. Finally it tails into
 *   typeSecondDrawScript (the loc_1dcf script), which types with delays. A generator because the typed
 *   tail yields as it paces. loc_1ca3 / loc_2810 / loc_1dbe keep placeholder names — they are ROM/data
 *   cells (header id string, its screen address, and the column-script data).
 *
 * ROM 0x1815-0x1836 (falling into typeSecondDrawScript at 0x1837).  Grounding: [seen].
 *
 * LIVE-OUT: memory / video RAM only; runs to the second script's terminator.
 */
export function* drawScoreAdvanceTable(m) {
  // Header line: blit 21 consecutive sprite ids from loc_1ca3 to the screen address loc_2810.
  drawSpriteList(m, loc_1ca3, 0x15, loc_2810);
  // Seat the typed-output cadence (ten frames per glyph) that the second, typed script will pace to.
  m.mem8[TYPE_PACE_COUNT] = 0x0a;
  // Walk the first draw script: a table of 4-byte records at loc_1dbe, blitted with no inter-glyph delay.
  let ptr = loc_1dbe;
  for (;;) {
    // A 0xff first byte is the script terminator: the table is fully drawn.
    if (m.mem8[ptr] === 0xff) break;
    fetchNextDrawRecord(m, ptr); // seats the dest/source regs the blit reads
    // Advance past this 4-byte record to the next one.
    ptr = u16(ptr + 4);
    // Blit the record as a fixed 16-row column at the destination fetchNextDrawRecord seated in HL/DE.
    drawSpriteColumn16(m);
  }
  // Tail into the second script (loc_1dcf), which types its material out at the cadence set above.
  yield* typeSecondDrawScript(m);
}
