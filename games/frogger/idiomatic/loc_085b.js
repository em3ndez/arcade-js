// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_085b — the no-more-frogs tail. Blits a 4-tile strip then a 5-tile strip up the same VRAM
 * column (the second continues where the first left the destination), then raises the hold flag.
 * LIVE-OUT: memory-only.
 */
import { loc_aa51, loc_2f6e, loc_2f12, loc_8004 } from "./names.js";
import { copyRunUpTileColumn } from "./copyRunUpTileColumn.js";

export function loc_085b(m) {
  const { regs, mem8 } = m;

  copyRunUpTileColumn(m, loc_aa51, loc_2f6e, 4);
  copyRunUpTileColumn(m, regs.hl, loc_2f12, 5);

  mem8[loc_8004] = 1;
}
