// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_30db — park Mario and six other sprites off screen by zeroing the X byte of each 4-byte
 * sprite record (seven bytes in all). Reads no memory and has no branches.
 *
 * LIVE-OUT: memory-only — those seven zeroed bytes.
 */
import { MARIO_SPRITE_RECORD } from "./names.js";
import { clearStridedBytes } from "./clearStridedBytes.js";

export function loc_30db(m) {
  const { regs, mem8 } = m;

  mem8[MARIO_SPRITE_RECORD] = 0x00;

  // Six more records four bytes apart, starting two slots past Mario's.
  regs.hl = (MARIO_SPRITE_RECORD & 0xff00) | 0x58;
  regs.b = 0x06;
  clearStridedBytes(m);
}
