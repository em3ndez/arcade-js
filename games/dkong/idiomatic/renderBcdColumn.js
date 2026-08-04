// SPDX-License-Identifier: GPL-3.0-only
/**
 * renderBcdColumn — draw a packed 3-byte BCD value as six digits up a video column.
 *
 * A caller-supplied entry into the packed-BCD renderer. The caller hands it a source
 * pointer (the three packed bytes, two BCD digits each) and a destination video cell,
 * and this routine paints the six digits climbing a column, one tilemap row up per
 * digit. It is the same code as the fixed-cell score renderer entered one instruction
 * later, so it skips that entry's hard-wired destination and honours the caller's
 * instead — which is why the score column (a fixed cell) and the on-board bonus-item
 * value (a cell chosen from the item's sprite record) share one renderer.
 *
 * The prologue fixes the standard parameters, then falls into the shared expansion loop:
 *
 *   - the source pointer is exchanged into the register the loop reads it from (it
 *     arrives in a different one). The value displaced by the exchange is overwritten
 *     on the very next line, so it is discarded.
 *   - the per-digit stride is set to -0x20 — back one tilemap row, so successive digits
 *     climb the column.
 *   - the source-byte count is set to 3 (six digits); the byte beside it is a dead
 *     marker the loop never reads.
 *   - the expansion loop then emits, per source byte, the HIGH nibble then the LOW,
 *     walking the source pointer backwards (so descending source bytes render into
 *     ascending display cells) and stepping the destination cursor by the stride.
 *
 * Live-in: the source pointer and the destination video cell. Calls only the shared
 * expansion loop, which owns the loop and the per-digit store.
 *
 * LIVE-OUT: memory-only — the six digit cells written into video RAM.
 */
import { expandBcdDigits } from "./expandBcdDigits.js";

const ROW_STEP = 0xffe0; //  -0x20: back one tilemap row per digit (draws up a column)
const BYTE_COUNT = 0x0304; // 3 source bytes (six digits); the low byte is a dead marker

export function renderBcdColumn(m) {
  const { regs } = m;

  regs.exDeHl();       // the source pointer moves into the register the loop reads it from...
  regs.de = ROW_STEP;  // ...and the register it vacated is immediately taken by the row stride
  regs.bc = BYTE_COUNT; // 3 source bytes; the dead marker beside it

  expandBcdDigits(m);  // fall into the shared expansion loop: six digits up the column
}
