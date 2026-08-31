// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { PANEL_DIGIT_SOURCE_TABLE, PANEL_DIGIT_VRAM_DEST } from "./names.js";
import { splitBcdByte } from "./splitBcdByte.js";
/**
 * renderPanelBcdDigitRows — paint the panel's packed-BCD digit stack into video RAM. [seen]
 * (ROM 0x0439-0x045f)
 *
 * WHAT IT IS
 * ----------
 * One of the HUD digit primitives that dress the numeric side panel. The machine keeps those
 * panel readouts as PACKED BCD in a small work-RAM table — PANEL_DIGIT_SOURCE_TABLE (0x89c0) —
 * where each byte holds two decimal digits, one per nibble (high nibble = tens, low nibble =
 * units). This routine walks ten groups out of that table and stamps them, as tile codes, into
 * the video-RAM tile plane at PANEL_DIGIT_VRAM_DEST (0x8467). It is one of the finishing passes
 * run when the panel/HUD is composed (paired with the status-panel painter), so what it leaves
 * behind is the column of numbers the player reads off the side of the screen.
 *
 * HOW ONE GROUP LANDS
 * -------------------
 * The tile plane is a 32-cell-wide map, so stepping one cell straight down is a stride of 0x20
 * (ROW_STRIDE) in the address. Each of the ten iterations consumes one source group and paints
 * a short vertical run of tiles, one row apart:
 *   cursor + 0x00   first byte's UNITS digit
 *   cursor + 0x20   first byte's TENS digit
 *   cursor + 0x40   the fixed SEPARATOR tile (0x51) between the two digit pairs
 *   cursor + 0x60   second byte's UNITS digit
 *   cursor + 0x80   second byte's TENS digit — unless it is zero, so a leading zero is left
 *                   blank (leading-zero suppression)
 * Between iterations the destination re-bases two cells to the right, so the ten source groups
 * become ten side-by-side digit columns marching across the panel.
 *
 * HOW THE SOURCE IS WALKED
 * ------------------------
 * The source pointer is bumped once before each of the two reads and once more at the end of the
 * group, so per iteration it consumes a three-byte slot but only reads the offset-1 and offset-2
 * bytes of it — the offset-0 byte of every slot is skipped — and comes to rest already parked on
 * the next group.
 *
 * The per-nibble unpack itself is done by the shared primitive splitBcdByte (ROM 0x0429): it
 * masks the units digit into the current cell, advances the cursor one row down, and hands back
 * the tens digit together with a flag for whether that tens digit is zero. This routine only
 * positions the cursor, drops the separator, and honours the leading-zero flag.
 *
 * LIVE-OUT: memory only — the ten painted digit columns in the tile plane. Nothing is handed
 * back to the caller, which loads fresh pointers for whatever panel it renders next.
 */

// Tilemap geometry and the fixed tiles this panel uses. One cell down is 0x20 in the tile
// plane, so a "row apart" between stacked digits is a step of ROW_STRIDE.
const ROW_STRIDE = 0x20; //         one tile-plane row (one cell straight down)
const NEXT_COLUMN_DELTA = -0x7e; // from the last cell: up four rows, right two cells -> next column base (u16-wrapped)
const SEPARATOR_TILE = 0x51; //     the fixed tile wedged between the two digit pairs of a group
// Ten source groups -> ten side-by-side digit columns.
const ROW_COUNT = 0x0a;

export function renderPanelBcdDigitRows(m) {
  const { mem8 } = m;
  // Source: the packed-BCD panel table in work RAM. Destination: the first digit cell in the
  // video-RAM tile plane. Both walk forward as the ten columns are laid down left to right.
  let src = PANEL_DIGIT_SOURCE_TABLE;
  let dst = PANEL_DIGIT_VRAM_DEST;

  // One iteration paints one group as one vertical digit column, then shifts the base right.
  for (let row = 0; row < ROW_COUNT; row++) {
    // Step past the skipped offset-0 byte to the group's first digit byte (offset 1).
    src = u16(src + 1);
    // Unpack the first byte: its units digit is painted at the cursor, and its tens digit plus
    // the cursor advanced one row down (afterLow1) come back for us to place.
    const [high1, afterLow1] = splitBcdByte(m, src, dst, ROW_STRIDE);
    mem8[afterLow1] = high1; //                    first byte's tens digit, one row below its units digit

    // Drop down one more row to the separator cell and stamp the fixed divider tile.
    let cell = u16(afterLow1 + ROW_STRIDE);
    mem8[cell] = SEPARATOR_TILE;
    // Drop down another row to where the second pair's units digit belongs.
    cell = u16(cell + ROW_STRIDE);

    // Advance to the group's second digit byte (offset 2).
    src = u16(src + 1);
    // Unpack the second byte: units painted at `cell`, tens digit + advanced cursor (afterLow2)
    // + a zero flag come back.
    const [high2, afterLow2, high2IsZero] = splitBcdByte(m, src, cell, ROW_STRIDE);
    if (!high2IsZero) mem8[afterLow2] = high2; //  second byte's tens digit; a zero tens is suppressed (leading zero left blank)

    // Step past the byte just read to the next group's boundary (its offset-0 byte, which the
    // next iteration's first bump skips); then re-base the destination two cells right so the
    // next column starts to the right of this one.
    src = u16(src + 1);
    dst = u16(afterLow2 + NEXT_COLUMN_DELTA);
  }
}
