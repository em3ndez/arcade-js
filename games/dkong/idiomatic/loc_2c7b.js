// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_2c7b — pick a bonus-event slot-claim entry by testing the caller's stepped value against
 * the bonus. Steps the value up by two (at byte width — it wraps, which flips the branch when
 * the bonus is 0 or 1) and compares with the bonus: a match takes the mode-byte-1 entry
 * (BARREL_CLAIM_MODE = 1), otherwise the shared entry with mode byte 2. Both tail into the same
 * slot-claim chain; a successful claim raises bit 7 to select the released barrel's kind.
 *
 * LIVE-OUT: memory-only — everything the chosen cluster entry writes.
 */

import { u8 } from "../../../core/int.js";
import { loc_2c49 } from "./loc_2c49.js";
import { loc_2c4b } from "./loc_2c4b.js";

const MODE_BYTE_2 = 0x02; // the constant mode byte the shared entry records on the miss arm

export function loc_2c7b(m, a = m.regs.a, c = m.regs.c) {
  const probe = u8(a + 0x02);
  const bonus = c;

  if (probe === bonus) {
    loc_2c49(m);
  } else {
    loc_2c4b(m, MODE_BYTE_2, bonus);
  }
}
