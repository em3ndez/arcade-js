// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_2c7b — pick a bonus-event slot-claim entry by testing the caller's stepped value
 * against the bonus.
 *
 * One of the entry points that resolve into the bonus-event slot-claim cluster. The caller
 * hands in two register live-ins: a small stepped value and the current bonus value. This
 * routine steps that value up by two and compares it with the bonus, and the outcome selects
 * which cluster entry runs, and therefore which mode byte the cluster records:
 *
 *   - stepped+2 == bonus  -> the mode-byte-1 entry: records BARREL_CLAIM_MODE = 1 and
 *                            forwards the bonus (the same live-in) so the shared body's
 *                            event gate can run.
 *   - otherwise           -> the shared entry with mode byte 2: records
 *                            BARREL_CLAIM_MODE = 2, again forwarding the bonus.
 *
 * Both arms tail into the same slot-claim chain; nothing here consumes a return value, so
 * this is void. The comparison is taken at BYTE WIDTH because the step-up wraps — a stepped
 * value of 254 or 255 lands on 0 or 1 — and that wrap flips the branch when the bonus is
 * 0 or 1.
 *
 * WHAT THE CLAIM IS FOR: a successful claim raises bit 7 of BARREL_CLAIM_MODE, and the barrel
 * released on the following frame reads that bit to pick which of two kinds it is stamped as
 * — a different sprite code, attribute and family index for each. Which NAMED Donkey Kong
 * object either kind is has not been established.
 *
 * LIVE-OUT: memory-only — everything the chosen cluster entry writes. The caller reloads its
 * registers and reads nothing this routine leaves behind.
 */

import { u8 } from "../../../core/int.js";
import { loc_2c49 } from "./loc_2c49.js";
import { loc_2c4b } from "./loc_2c4b.js";

const MODE_BYTE_2 = 0x02; // the constant mode byte the shared entry records on the miss arm

/**
 * @param {object} m  the machine (reads the stepped value and the bonus from registers).
 * @returns {void}
 */
export function loc_2c7b(m) {
  const { regs } = m;

  // Step the caller's value up by two (at byte width — it wraps) and test it against the bonus.
  const probe = u8(regs.a + 0x02);
  const bonus = regs.c;

  if (probe === bonus) {
    // Match: the mode-byte-1 entry, which forwards the bonus (still in the same register) itself.
    loc_2c49(m);
  } else {
    // Miss: the shared entry with mode byte 2, forwarding the bonus explicitly.
    loc_2c4b(m, MODE_BYTE_2, bonus);
  }
}
