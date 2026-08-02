// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_2c7b — pick a bonus-event slot-claim cluster entry by testing the caller's stepped
 * value against the bonus.  ROM 0x2C7B.
 *
 * One of the entry points that resolve into the bonus-event slot-claim cluster (0x2C41). The
 * caller — still the frozen oracle (entry_2c03, reached by a tail jump) — hands in two register
 * live-ins: a small stepped value and the current bonus value. This routine steps that value up
 * by two and compares it with the bonus, and the outcome selects which cluster entry runs and
 * therefore which mode byte the cluster records:
 *
 *   - stepped+2 == bonus  -> the mode-byte-1 entry (loc_2c49): records BARREL_CLAIM_MODE = 1,
 *                            0x638F = 2 and forwards the bonus (the same live-in) so the shared
 *                            body's event gate can run.
 *   - otherwise           -> the shared entry with mode byte 2 (loc_2c4b): records
 *                            BARREL_CLAIM_MODE = 2, 0x638F = 3, again forwarding the bonus.
 *
 * Both arms tail into the same slot-claim chain (loc_2c4f -> loc_2c72); nothing here consumes a
 * return value, so this is void. The comparison is taken at byte width because the step-up wraps
 * (a stepped value of 254/255 lands on 0/1), and that wrap flips the branch when the bonus is 0/1.
 *
 * GROUNDED — observed live in MAME 0.288 on the real dkong ROM (understanding pass 12,
 * scratchpad/pass12-grounding.md): what the chain below ultimately tags is a 25m BARREL. On a
 * claim, loc_2c72 raises bit 7 of BARREL_CLAIM_MODE, and one frame later loc_2cf6 reads that bit
 * to choose which of two barrel kinds it stamps into the freshly-released OBJ_ARRAY_67 record —
 * bit 7 CLEAR -> sprite code/attr/mode 0x15 / 0x0B / 0x00, bit 7 SET -> 0x19 / 0x0C / 0x01,
 * agreeing 46/46 with no exceptions (38 clear, 8 set), every dispatch ordinary board-1 25m
 * gameplay and ZERO in the opening Kong-climb cutscene. The bit-7-SET (attr 0x0C) kind DROPS with
 * its X pinned at 59; the bit-7-CLEAR (attr 0x0B) kind ROLLS along the girders. Grounding
 * deliberately did NOT establish which NAMED Donkey Kong object either kind is.
 *
 * Memory-equivalent to the frozen oracle — equivalence-2c7b.test.js.
 * GATE:     crafted-entry — this entry is NOT reached during attract (only from the still-translated
 *           entry_2c03/entry_2c41 path), so there are no real captured dispatches. Instead: exhaustive
 *           over the branch decision (all 256 stepped-value inputs x taken/not-taken, incl. the +2
 *           wrap) with the event gate held closed to isolate the mode-byte writes, plus a gate-open
 *           slot cross-product in BOTH branches (every first-free-slot position and the all-occupied
 *           case, at several marks incl. a low one whose -8 step wraps). Teeth: a compare that drops
 *           the byte-width wrap, a wrong constant mode byte, and a mis-forwarded bonus.
 * LIVE-OUT: memory-only — everything the chosen cluster entry writes (BARREL_CLAIM_MODE, 0x638F,
 *           0x6392, BONUS_EVENT_MARK, and a slot claim's bit 7 on BARREL_CLAIM_MODE). The
 *           still-oracle caller reloads its registers; nothing reads a register or flag this
 *           routine leaves behind.
 * NAMES:    loc_2c49 (ROM 0x2C49) and loc_2c4b (ROM 0x2C4B) direct-called with honest args (the
 *           constant mode byte 2 that the oracle loads before the mode-byte-2 arm becomes loc_2c4b's
 *           mode argument). This routine writes no RAM itself. The bonus live-in it forwards is the
 *           value BONUS (0x62B1) holds, read here from a register at the still-translated caller
 *           boundary. BARREL_CLAIM_MODE (0x6382) — the barrel slot-claim mode byte whose low bits
 *           carry the mode value and whose bit 7 selects the barrel kind — is named in ram.js and
 *           imported inside the callees; 0x638F/0x6392 stay unnamed 0x63xx engine scratch and carry
 *           their comments there too.
 */

import { u8 } from "../../../core/int.js";
import { loc_2c49 } from "./loc_2c49.js"; // ROM 0x2C49 — the mode-byte-1 entry (forwards the bonus)
import { loc_2c4b } from "./loc_2c4b.js"; // ROM 0x2C4B — the shared entry (mode byte taken as an arg)

const MODE_BYTE_2 = 0x02; // the constant mode byte the oracle loads before the mode-byte-2 arm

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
