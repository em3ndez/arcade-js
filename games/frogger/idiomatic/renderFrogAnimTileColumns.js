// SPDX-License-Identifier: GPL-3.0-only
/**
 * renderFrogAnimTileColumns  —  ROM 0x0ff1  ·  grounding: [code]
 *
 * WHAT IT IS
 *   The shared inner render loop of Frogger's frog-animation pipeline. Every one of the eleven
 *   render arms (renderFrogAnimArm0..10) sets up a small parameter block for its lane, then falls
 *   straight into THIS routine to do the actual work. For each of C columns it does two things at
 *   once: it stamps a vertical run of tiles into VRAM (the picture the player sees) and it plots the
 *   matching sprite-object entry (the hitbox the collision code reads). So this is the single point
 *   where "draw the lane" and "tell the move resolver where the lane objects are" happen together —
 *   the two ends of one data structure, filled in lockstep.
 *
 * WHERE IT SITS
 *   Entered by all eleven arms of the frog-animation dispatcher (dispatchFrogAnimationArm, ROM
 *   0x0faf), never called from anywhere else. Each arm has already parked its column stride in
 *   SCROLL_COPY_COLUMN_STRIDE (0x81b1) and its tile-source base in SCROLL_COPY_SRC_PTR (0x8001), and
 *   hands this loop its row-count, column-count, VRAM destination, tile source, and a pair of plot
 *   cursors. When the columns are exhausted the loop tail-calls advanceFrogAnimIndexAndRedispatch
 *   (0x1029), which bumps the animation index and either renders the next arm or wraps the index to 0
 *   — so a single entry sweeps every arm from the current index up through arm 10.
 *
 * LIVE-IN (all supplied by the calling arm via the Z80 registers; params default to those registers)
 *   B  = rowCount     — tile-rows (two-byte pairs) to copy down each column
 *   C  = columnCount  — number of columns to render; C == 0 means the full 256 (it decrements first)
 *   HL = dest         — VRAM destination of the first column's top cell
 *   DE = source       — tile-source pointer for the first column (== SCROLL_COPY_SRC_PTR base)
 *   IX = ixCursor     — plot cursor for the arm's sprite-X slots (the [count, x0, x1, …] object list)
 *   IY = iyCursor     — plot cursor pointing at that same list's leading count byte
 *   carry = borrow    — incoming 16-bit borrow for the first column-index computation
 *
 * LIVE-OUT
 *   Memory only. It writes VRAM tile cells, the arm's sprite-object list (count byte + negated-column
 *   X slots), and the two scroll-copy scratch cells it reloads per column. It returns whatever the
 *   tail-called index-advance returns (memory-only); no register the caller reads survives.
 */
import {
  TWO_PLAYER_START_FLAG,
  SCROLL_COPY_ROWCOUNT,
  SCROLL_COPY_SRC_PTR,
  SCROLL_COPY_COLUMN_STRIDE,
} from "./names.js";
import { computeVramColumnIndex } from "./computeVramColumnIndex.js";
import { advanceFrogAnimIndexAndRedispatch } from "./advanceFrogAnimIndexAndRedispatch.js";
import { u16 } from "../../../core/int.js";

// One tilemap row is 0x20 (32) cells wide, so stepping a VRAM pointer by 0x20 moves it straight down
// one screen row — the pitch used both to copy a column's tiles and (implicitly) to advance columns.
const TILE_ROW_STRIDE = 0x20;

// prettier-ignore
export function renderFrogAnimTileColumns(m, rowCount = m.regs.b, columnCount = m.regs.c, dest = m.regs.hl, source = m.regs.de, ixCursor = m.regs.ix, iyCursor = m.regs.iy, borrow = m.regs.fC ? 1 : 0) {
  const { mem8, mem16 } = m;

  // Working copies of the arm's live-in registers. Only the destination, source, row-count, column
  // counter and the IX cursor mutate as the loop runs; IY stays fixed (its count byte is bumped in
  // place) and `borrow` is re-threaded each column from the destination add's overflow (see below).
  let dst = dest;
  let src = source;
  let rowsPerColumn = rowCount;
  let columnsLeft = columnCount; // outer column counter; C == 0 wraps to 256 (decrement-then-test)
  let ix = ixCursor;

  for (;;) {
    // ── Step 1: destination address → on-screen column index ───────────────────────────────
    // Frogger's tilemap is stored ROTATED, so a linear VRAM offset does not map linearly to a column.
    // computeVramColumnIndex (0x1198) undoes that permutation, reconstructing the logical column
    // (0..31) the current destination sits in. `borrow` is the 16-bit carry-out of the previous
    // column's destination add, threaded in so the index stays correct across an address wrap.
    const screenColumn = computeVramColumnIndex(m, dst, borrow);

    // ── Step 2: plot this column into the arm's sprite-object list (unless suppressed) ─────────
    // TWO_PLAYER_START_FLAG (0x825b), when non-zero, suppresses plotting — the 2-player swap-in path
    // repaints tiles without disturbing the live object lists. When it is zero we write the hardware
    // sprite X and grow the list. The X is the NEGATED column index: the Uint8 store truncates
    // -screenColumn to its two's-complement byte (256 - screenColumn), which is exactly the hardware
    // sprite-X convention. IX advances one slot per plotted column so the X's land in successive
    // slots (ix+1, ix+2, …), while IY's leading count byte is incremented in place — together the
    // [count, x0, x1, …] layout the lane move-resolver later scans.
    if (mem8[TWO_PLAYER_START_FLAG] === 0) {
      mem8[ix + 1] = -screenColumn;
      ix = ix + 1;
      mem8[iyCursor] = mem8[iyCursor] + 1;
    }

    // ── Step 3: copy this column's tile-rows down VRAM ─────────────────────────────────────────
    // Park the row count in SCROLL_COPY_ROWCOUNT (0x8003) so it can be reloaded for the next column
    // (the ROM keeps its live copy here). Then copy `rowsPerColumn` two-byte tile-pairs from `src`
    // into `dst`, stepping the VRAM cell down one screen row (TILE_ROW_STRIDE) per row and the source
    // forward one pair (+2) BETWEEN rows. The source advance is skipped after the final row (the loop
    // breaks first), leaving `src` one pair short — harmless, because the next column reloads it from
    // the arm's tile-source base anyway (Step 5). `rows` is masked to 8 bits so a count of 0 runs the
    // full 256 rows, matching the Z80 `djnz`-style down-counter.
    mem8[SCROLL_COPY_ROWCOUNT] = rowsPerColumn;
    let cell = dst;
    let rows = rowsPerColumn & 0xff;
    for (;;) {
      mem8[cell] = mem8[src];
      mem8[cell + 1] = mem8[src + 1];
      cell = cell + TILE_ROW_STRIDE; // down one screen row
      rows = (rows - 1) & 0xff;
      if (rows === 0) break;
      src = src + 2; // step the source to the next tile-pair
    }

    // ── Step 4: advance the destination to the next column, capturing the borrow ───────────────
    // After the copy `cell` points one row past the bottom of the column; adding the arm's column
    // stride SCROLL_COPY_COLUMN_STRIDE (0x81b1) lands on the next column's top cell. Only the
    // destination is held to 16 bits: `advanced` is the untruncated sum, `dst` is its 16-bit
    // wrap, and if truncation actually dropped a bit (advanced !== dst) that is a 16-bit carry-out,
    // captured as next column's `borrow` into the Step-1 column-index computation.
    const advanced = cell + mem8[SCROLL_COPY_COLUMN_STRIDE];
    dst = u16(advanced);
    borrow = advanced === dst ? 0 : 1;

    // ── Step 5: loop control — stop after the last column, else reload per-column state ────────
    // Decrement-then-test so an initial column count of 0 runs 256 times. On the last column we fall
    // through to the index advance; otherwise reload the tile source from SCROLL_COPY_SRC_PTR (0x8001)
    // — so every column restarts at the arm's tile-source base — and the row count from the scratch
    // cell parked in Step 3.
    columnsLeft = (columnsLeft - 1) & 0xff;
    if (columnsLeft === 0) break;

    src = mem16[SCROLL_COPY_SRC_PTR];
    rowsPerColumn = mem8[SCROLL_COPY_ROWCOUNT];
  }

  // ── Tail: hand off to the animation-index advance / arm-recursion driver ─────────────────────
  // With this arm's columns drawn, step the animation index (0x8000) and either re-dispatch the next
  // arm or wrap the index to 0. This is a direct tail-call (the ROM's `push`/`ret` here is just this
  // routine's own return path), so one entry sweeps every arm from the current index up through 10.
  return advanceFrogAnimIndexAndRedispatch(m);
}
