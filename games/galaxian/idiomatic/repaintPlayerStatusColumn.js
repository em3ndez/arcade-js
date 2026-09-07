// SPDX-License-Identifier: GPL-3.0-only
//
// repaintPlayerStatusColumn -- ROM 0x20ac, grounding [seen].
//
// WHAT IT IS
//   Repaints the small three-cell player-status indicator column -- the on-screen marker showing whose
//   turn it is. Driven by a flags byte (register B): bit 4 clear paints the active player's column
//   outright; bit 4 set blanks the active player's column and, in a two-player game, paints the other
//   player's column instead.
//
// ROLE IN THE MACHINE
//   The status column lives in tilemap VRAM at a per-player base chosen by selectPlayerStatusVram (0x214e):
//   player 1 -> PLAYER1_STATUS_VRAM (0x5340), else PLAYER2_STATUS_VRAM (0x50e0). CURRENT_PLAYER (0x400d)
//   selects the active player. paintPlayerStatusColumn (0x20cd) does the actual three-cell stamp (an
//   incremented char code on top, then two fixed tiles). This routine is the dispatcher above it; the
//   idle object-figure drain reaches it (via repaintPlayerStatusColumnFromModeGate) on its zeroth grid
//   phase, so the marker is refreshed as part of background drawing.
//
// LIVE-OUT: three VRAM cells of the painted/blanked status column(s); tail-returns paintPlayerStatusColumn's
//   live-outs when it paints.
import { u16 } from "../../../core/int.js";
import { CURRENT_PLAYER, loc_400e } from "./names.js";
import { selectPlayerStatusVram } from "./selectPlayerStatusVram.js";
import { paintPlayerStatusColumn } from "./paintPlayerStatusColumn.js";

const FILL_TILE = 16; // written to blank a column's three cells
const ROW_STRIDE = -32; // one tilemap row up, the column step
const SWAP_BIT = 0x10; // B bit 4: blank-then-alternate mode

export function repaintPlayerStatusColumn(m, flags = m.regs.b) {
  const { mem8 } = m;

  // Resolve the active player and the VRAM base of that player's status column.
  const player = mem8[CURRENT_PLAYER];
  const column = selectPlayerStatusVram(m, player);

  // Bit 4 clear: the ordinary case. Paint the active player's column directly and tail-return; `flags`
  // is passed through because paintPlayerStatusColumn reads its other bits (hide bit, mode-gate clear).
  if (!(flags & SWAP_BIT)) return paintPlayerStatusColumn(m, player, column, ROW_STRIDE, flags);

  // Bit 4 set: blank-then-alternate. First erase the active column's three cells by stamping the blank
  // tile 16 up the column (stride -32 = one tilemap row up), the u16() keeping the address in page range.
  let cell = column;
  mem8[cell] = FILL_TILE;
  cell = u16(cell + ROW_STRIDE);
  mem8[cell] = FILL_TILE;
  cell = u16(cell + ROW_STRIDE);
  mem8[cell] = FILL_TILE;

  // Only continue to the other player's column when the paired-player flag loc_400e is set (a two-player
  // game). A zero flag means there is no second player, so we stop after blanking.
  if (mem8[loc_400e] === 0) return;

  // Paint the OTHER player's column (player XOR 1) at its own VRAM base -- the turn marker moving across.
  const other = player ^ 1;
  return paintPlayerStatusColumn(m, other, selectPlayerStatusVram(m, other), ROW_STRIDE, flags);
}
