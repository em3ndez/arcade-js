// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_30db — park Mario and six other sprites off screen by zeroing their X.
 *
 * A tiny, branch-free preamble. It writes 0 to the X byte of Mario's 4-byte hardware sprite
 * record, then hands off to the shared strided clear, which does the same to the X byte of six
 * further sprite records spaced four bytes apart. Seven bytes go to zero in all.
 *
 * Mario's write is separate rather than part of the run because the run starts two slots further
 * on and would otherwise have to walk over the ones in between.
 *
 * The routine reads NO memory and has NO branches, so every call clears exactly the same seven
 * fixed bytes regardless of the state it is entered in.
 *
 * LIVE-OUT: memory-only — those seven zeroed bytes.
 */
import { MARIO_SPRITE_RECORD } from "./names.js";
import { clearStridedBytes } from "./clearStridedBytes.js";

export function loc_30db(m) {
  const { regs, mem } = m;

  // Zero the X byte of Mario's sprite record.
  mem.write8(MARIO_SPRITE_RECORD, 0x00);

  // Then six more records, four bytes apart, starting two slots past Mario's. The strided clear
  // takes its base and count in registers, and its return is this routine's return.
  regs.hl = (MARIO_SPRITE_RECORD & 0xff00) | 0x58; // same page as Mario's record
  regs.b = 0x06;
  clearStridedBytes(m);
}
