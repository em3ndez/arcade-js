// SPDX-License-Identifier: GPL-3.0-only
import { u8 } from "../../../core/int.js";
import { TILEMAP_PTR_LO, loc_ef, loc_88, loc_d7 } from "./names.js";

/**
 * stampEmptyTileCell -- the "write one mushroom cell, but only if it is legal to" counterpart to
 * resolveTileCellAtXY (which does the "position and test" half).
 *
 * ROM 0x2XXX (playfield tile subsystem). Grounding: [code] -- read from the routine; the $32/$33
 * working pointer and the palette region are [seen], the bare zero-page cells it shuffles ($ef, $88,
 * the $d7 array) are behavioural placeholders.
 *
 * ROLE IN THE MACHINE. The playfield is a tile-map grid in video RAM addressed through the single
 * 16-bit working pointer at $32/$33 (TILEMAP_PTR_LO / its high companion). A callable that has
 * already positioned that pointer at a target cell calls this to lay a mushroom there. The cell's
 * byte IS the tile: 0 means empty, and a stamped mushroom/solid glyph is written as `0x3f ^ $ef`.
 *
 * THE $ef FOLD MASK. $ef (loc_ef) is the recurring hinge of the whole tile subsystem. It is XORed
 * into every stamped byte AND it selects which column thresholds count, so this one routine paints
 * both the upright and the mirrored (flipped-cabinet) orientation without branching into two copies.
 * When $ef is 0 the cabinet is in one orientation; when non-zero it is mirrored, and the column rules
 * below flip to match.
 *
 * LIVE-OUT: the pointed grid cell (written to `0x3f ^ $ef` only when it was empty and its column is a
 * stampable class), and -- for the columns that qualify -- an incremented per-slot tally in the $d7
 * array indexed by the actor slot $88. Occupied cells and edge/excluded columns leave everything alone.
 */
export function stampEmptyTileCell(m) {
  const { mem8, mem16 } = m;
  // Compose $32/$33 into a 16-bit address and read the tile already there. If it is non-zero the cell
  // already holds a mushroom -- an existing mushroom is NEVER overwritten, so bail untouched.
  const ptr = mem16[TILEMAP_PTR_LO]; // ($32) 16-bit tile-map cell pointer
  if (mem8[ptr] !== 0) return; // cell already occupied -> leave it untouched
  // The pointer's LOW byte encodes the column in its bottom five bits. Pull that column code out; it
  // decides which class of cell this is and therefore which rules apply below.
  const col = mem8[TILEMAP_PTR_LO] & 0x1f; // low-5-bit column code (from the pointer low byte)
  // Columns 0 and 0x1f are the grid's left/right edge columns -- the frame lives there, never a
  // mushroom, so refuse them outright in either orientation.
  if (col === 0 || col === 0x1f) return; // the two edge columns are never stamped
  // Read the orientation/fold mask. It picks BOTH the column thresholds (below) and the stamped byte.
  const ef = mem8[loc_ef]; // fold mask: selects the thresholds AND is XORed into the stamp
  let bump;
  if (ef === 0) {
    // Upright orientation: one further column (col 1) is excluded, and columns left of 0x0c also
    // advance the per-slot counter, while columns at/after 0x0c only get the stamp.
    if (col === 0x01) return; // column 1 excluded in this orientation
    bump = col < 0x0c; // <0x0c bumps the slot counter; >=0x0c writes only
  } else {
    // Mirrored orientation: the excluded/counting columns are the mirror image -- col 0x1e is excluded
    // and it is the RIGHT side (>=0x14) that advances the counter.
    if (col === 0x1e) return; // column 0x1e excluded in the mirrored orientation
    bump = col >= 0x14; // >=0x14 bumps; <0x14 writes only
  }
  if (bump) {
    // Advance this actor's per-column mushroom tally. $88 (loc_88) is the current actor slot index; the
    // $d7 array holds one counter per slot. $d7,X is a 6502 zero-page indexed address, so u8() wraps the
    // sum back into page 0 exactly as the hardware would, and the increment is masked to a byte.
    const x = mem8[loc_88]; // current actor slot index
    const cnt = u8(loc_d7 + x); // $d7,X (zero-page indexed: wraps within page 0)
    mem8[cnt] = u8(mem8[cnt] + 1); // inc $d7,X
  }
  // Finally lay the mushroom: `0x3f ^ $ef` through the ($32) pointer -- the canonical stamped-tile value.
  mem8[ptr] = 0x3f ^ ef; // stamp 0x3f^$ef through ($32)
}
