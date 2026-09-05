// SPDX-License-Identifier: GPL-3.0-only
// Repaint the player-status column(s). B bit 4 clear: paint the active player's column. B bit 4 set:
// blank the active player's column, then (only when the paired-player flag is set) paint the other's.
import { u16 } from "../../../core/int.js";
import { CURRENT_PLAYER, loc_400e } from "./names.js";
import { selectPlayerStatusVram } from "./selectPlayerStatusVram.js";
import { paintPlayerStatusColumn } from "./paintPlayerStatusColumn.js";

const FILL_TILE = 16; // written to blank a column's three cells
const ROW_STRIDE = -32; // one tilemap row up, the column step
const SWAP_BIT = 0x10; // B bit 4: blank-then-alternate mode

export function loc_20ac(m, flags = m.regs.b) {
  const { mem8 } = m;
  const player = mem8[CURRENT_PLAYER];
  const column = selectPlayerStatusVram(m, player);

  // Bit 4 clear: paint the active player's column directly.
  if (!(flags & SWAP_BIT)) return paintPlayerStatusColumn(m, player, column, ROW_STRIDE, flags);

  // Bit 4 set: blank the active column's three cells.
  let cell = column;
  mem8[cell] = FILL_TILE;
  cell = u16(cell + ROW_STRIDE);
  mem8[cell] = FILL_TILE;
  cell = u16(cell + ROW_STRIDE);
  mem8[cell] = FILL_TILE;

  // Only continue to the other player's column when the paired-player flag is set.
  if (mem8[loc_400e] === 0) return;
  const other = player ^ 1;
  return paintPlayerStatusColumn(m, other, selectPlayerStatusVram(m, other), ROW_STRIDE, flags);
}
