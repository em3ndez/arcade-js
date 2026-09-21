// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_30db — park Mario and six other sprites off screen by zeroing the X byte of each 4-byte
 * sprite record (seven bytes in all). Reads no memory and has no branches.
 *
 * LIVE-OUT: memory-only — those seven zeroed bytes.
 */
import { page } from "../../../core/int.js";
import { MARIO_SPRITE_RECORD } from "./names.js";
import { clearStridedBytes } from "./clearStridedBytes.js";

export function loc_30db(m) {
  const { mem8 } = m;

  mem8[MARIO_SPRITE_RECORD] = 0x00;

  // Six more records four bytes apart, starting two slots past Mario's.
  clearStridedBytes(m, page(MARIO_SPRITE_RECORD) | 0x58, 6);
}
