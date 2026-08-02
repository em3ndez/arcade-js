// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_2c4b — one entry of the bonus-event slot-claim cluster (0x2C41): record the caller's
 * mode byte, then hand off to the shared slot-claim body with that byte bumped by one.
 * ROM 0x2C4B.
 *
 * This entry stores the caller's mode byte into BARREL_CLAIM_MODE and then runs the shared body
 * (loc_2c4f) with the mode byte incremented — so the body records 0x638F as the mode byte PLUS
 * ONE while BARREL_CLAIM_MODE keeps the un-incremented value. The two bytes therefore always
 * differ by one (the increment sits between the two stores), which is this entry's whole
 * distinguishing move versus its sibling entries.
 *
 * The shared body then runs the periodic-event gate against the bonus value passed through from
 * the caller: on a hit it steps the event mark down and claims the first free object slot,
 * raising bit 7 on that same BARREL_CLAIM_MODE byte (so a claimed slot leaves it as the mode
 * value with bit 7 set); on a miss it does just the two writes.
 *
 * GROUNDED — observed live in MAME 0.288 on the real dkong ROM (understanding pass 12,
 * scratchpad/pass12-grounding.md): bit 7 of BARREL_CLAIM_MODE is the 25m BARREL-KIND select. One
 * frame after a bit-7-set claim, loc_2cf6 stamps the freshly-released OBJ_ARRAY_67 barrel record
 * with sprite code/attr/mode 0x19 / 0x0C / 0x01 instead of the default 0x15 / 0x0B / 0x00 — 46/46
 * agreement over every captured dispatch, no exceptions (38 clear, 8 set), all of them ordinary
 * board-1 25m gameplay (ZERO in the opening Kong-climb cutscene). The bit-7-SET (attr 0x0C) kind
 * DROPS with its X pinned at 59; the bit-7-CLEAR (attr 0x0B) kind ROLLS along the girders.
 * Grounding deliberately did NOT establish which NAMED Donkey Kong object either kind is. So the
 * "mode byte" this entry stores is genuinely a mode VALUE in the low bits (observed 1, and 0x81
 * after a claim), not a bare flag.
 *
 * Memory-equivalent to the frozen oracle — equivalence-2c4b.test.js.
 * GATE:     exhaustive over the mode byte (all 256 values, gate closed) isolating the two stores
 *           and the +1 between them; + crafted gate-open entries across every first-free
 *           slot position and the all-occupied case, incl. a low mark whose step wraps and the
 *           slot-claim bit landing on the mode byte; + real captured 0x2C4B dispatches from
 *           attract (which span both the slot-claim and gate-closed arms). Teeth: a dropped
 *           increment, a first-store using the incremented value, and a mis-forwarded bonus.
 * LIVE-OUT: memory-only — BARREL_CLAIM_MODE, and through the shared body 0x638F, 0x6392,
 *           BONUS_EVENT_MARK, and bit 7 on BARREL_CLAIM_MODE. The oracle threads residual
 *           registers/flags out and its callers reload; nothing reads a register the routine
 *           leaves behind.
 * NAMES:    loc_2c4f (ROM 0x2C4F) direct-called; BONUS_EVENT_MARK / OBJ_ARRAY_64 live inside it.
 *           BARREL_CLAIM_MODE (0x6382) from ram.js — the barrel slot-claim mode byte, whose low
 *           bits hold the mode value this routine stores and whose bit 7 is the barrel-kind select.
 */

import { BARREL_CLAIM_MODE } from "./ram.js"; // ROM 0x6382 — the barrel slot-claim mode byte
import { loc_2c4f } from "./loc_2c4f.js"; // ROM 0x2C4F — the shared slot-claim body

/**
 * @param {object} m         the machine (uses m.mem only).
 * @param {number} modeByte  the caller's mode byte: stored at BARREL_CLAIM_MODE, then handed on
 *                           incremented.
 * @param {number} bonus     the current bonus value the shared body's event gate tests against.
 * @returns {void}
 */
export function loc_2c4b(m, modeByte, bonus) {
  const { mem } = m;

  // Record the mode byte, then run the shared body with it bumped by one — so 0x638F ends up one
  // above BARREL_CLAIM_MODE (the increment sits between the two stores).
  mem.write8(BARREL_CLAIM_MODE, modeByte);
  loc_2c4f(m, modeByte + 1, bonus);
}
