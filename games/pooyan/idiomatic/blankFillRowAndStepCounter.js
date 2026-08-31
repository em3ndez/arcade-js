// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { fillByteRun } from "./fillByteRun.js";
import { TILE_FILL_PTR, FILL_ROW_COUNTER } from "./names.js";
/**
 * blankFillRowAndStepCounter — fill one row of the row-by-row tilemap fill and step the row counter.
 *
 * WHAT IT IS
 *   The worker for the machine's row-by-row tilemap erase. The picture the player sees sits in a
 *   32x32 grid of tile-code bytes; clearing the whole grid in one shot would be a big blocking
 *   fill, so the machine spreads the work out: it blanks exactly one row per invocation and lets a
 *   down-counter track how many rows are left. Each call blanks a run of cells at the current fill
 *   cursor with the blank tile, snaps the cursor forward to the start of the next row, and ticks
 *   the row counter down by one. When the counter drains, the whole grid has been walked and the
 *   caller moves the machine on.
 *
 * ROLE IN THE MACHINE
 *   This is the shared tail of the erase. A companion cell first arms the fill — it stores the top
 *   of the target region into the fill cursor at TILE_FILL_PTR (0x880b) and seeds the row counter
 *   at FILL_ROW_COUNTER (0x8809) with the row count (0x20 = 32 rows, one per grid row). From then
 *   on a driver calls this worker once per frame and returns early while the counter is still
 *   nonzero, so the erase pours out across many frames instead of stalling a single frame. Boot
 *   uses it to blank the lower tilemap; the round-init path uses it to wipe the playfield before
 *   building a new board.
 *
 * ROM 0x02ce. Grounding: [seen].
 *
 * LIVE-OUT:
 *   - mem[TILE_FILL_PTR] (0x880b): the fill cursor advanced by exactly one row (0x20 cells).
 *   - mem[FILL_ROW_COUNTER] (0x8809): the row counter decremented by one.
 *   - the Z flag: set when the row counter reached zero, i.e. the fill has drained. This is the
 *     only result the callers consume — they loop (returning early) until Z says the erase is done.
 */

const TILE_BLANK = 0x10; // tile code written into every erased cell (the blank/background tile)
const ROW_WIDTH = 0x20;  // 32 cells per grid row — the pitch the cursor steps by each call

export function blankFillRowAndStepCounter(m, count = m.regs.b) {
  const { mem8, mem16 } = m;

  // Blank `count` cells of this row. The fill cursor at TILE_FILL_PTR (0x880b) is a live 16-bit
  // pointer into the tilemap plane; the memset primitive writes the blank tile into `count`
  // consecutive cells from there and hands back the cursor advanced past the last cell it wrote
  // (start + count). `count` is the incoming loop counter — the number of cells this pass touches.
  const afterFill = fillByteRun(m, mem16[TILE_FILL_PTR], TILE_BLANK, count);

  // Finish the row. The memset only moved the cursor `count` cells forward, but a row is ROW_WIDTH
  // (0x20) cells wide, so add back the remainder to land the cursor at the very start of the next
  // row no matter how many cells were blanked. Held to 8 bits: the machine forms this addend with
  // an 8-bit subtract, so a `count` above the row width wraps here exactly as the hardware would.
  const rowAddend = (ROW_WIDTH - count) & 0xff;

  // Store the row-advanced cursor back to TILE_FILL_PTR (0x880b) so the next pass picks up on the
  // following row. u16 keeps it a 16-bit tilemap address, wrapping cleanly if it crosses 0xffff.
  mem16[TILE_FILL_PTR] = u16(afterFill + rowAddend);

  // Tick the row counter down. FILL_ROW_COUNTER (0x8809) was seeded with the row count and counts
  // one row per call; the & 0xff keeps it a single byte so a decrement past zero would wrap rather
  // than go negative — though in normal use the drain is caught at exactly zero below.
  const remaining = (mem8[FILL_ROW_COUNTER] - 1) & 0xff;
  mem8[FILL_ROW_COUNTER] = remaining;

  // Report drain via the Z flag: true once the last row has been blanked. The driver keeps calling
  // this worker (and returning early) while Z is false, and advances the machine's state when Z is
  // true — the whole tilemap has been erased.
  return (m.regs.fZ = remaining === 0);
}
