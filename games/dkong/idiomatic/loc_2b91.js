// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_2b91 — commit Mario's adjusted X (in A) to MARIO_X and to his sprite record's X field, so
 * the on-screen sprite tracks the new position on the same frame.
 *
 * THE RETURN IS A PROTOCOL: `false` means the accept happened and the caller must unwind two
 * levels, not one. A is left holding 1, the accept signal read back up the chain.
 *
 * LIVE-OUT: memory (MARIO_X and the sprite record's X), A, and the protocol return.
 */
import { u16 } from "../../../core/int.js";
import { MARIO_X, MARIO_SPRITE_RECORD, SPRITE_X } from "./names.js";

export function loc_2b91(m, x = m.regs.a) {
  const { regs, mem8 } = m;
  mem8[MARIO_X] = x;
  mem8[u16(MARIO_SPRITE_RECORD + SPRITE_X)] = x;
  regs.a = 0x01; // accept signal
  return false; // caller-skip: unwind two levels
}
