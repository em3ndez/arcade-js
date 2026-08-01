// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_2c4b — one entry of the bonus-event slot-claim cluster (0x2C41): record the caller's
 * mode byte, then hand off to the shared slot-claim body with that byte bumped by one.
 * ROM 0x2C4B.
 *
 * This entry stores the caller's mode byte into engine scratch 0x6382 and then runs the shared
 * body (loc_2c4f) with the mode byte incremented — so the body records 0x638F as the mode byte
 * PLUS ONE while 0x6382 keeps the un-incremented value. The two scratch bytes therefore always
 * differ by one (the increment sits between the two stores), which is this entry's whole
 * distinguishing move versus its sibling entries.
 *
 * The shared body then runs the periodic-event gate against the bonus value passed through from
 * the caller: on a hit it steps the event mark down and claims the first free object slot,
 * raising a top-bit request flag on that same 0x6382 byte (so a claimed slot leaves 0x6382 as
 * the mode byte with its top bit set); on a miss it does just the two scratch writes.
 *
 * Memory-equivalent to the frozen oracle — equivalence-2c4b.test.js.
 * GATE:     exhaustive over the mode byte (all 256 values, gate closed) isolating the two scratch
 *           stores and the +1 between them; + crafted gate-open entries across every first-free
 *           slot position and the all-occupied case, incl. a low mark whose step wraps and the
 *           slot-claim flag landing on the mode byte; + real captured 0x2C4B dispatches from
 *           attract (which span both the slot-claim and gate-closed arms). Teeth: a dropped
 *           increment, a first-store using the incremented value, and a mis-forwarded bonus.
 * LIVE-OUT: memory-only — 0x6382, and through the shared body 0x638F, 0x6392, BONUS_EVENT_MARK,
 *           and the request bit on 0x6382. The oracle threads residual registers/flags out and
 *           its callers reload; nothing reads a register the routine leaves behind.
 * NAMES:    loc_2c4f (ROM 0x2C4F) direct-called; BONUS_EVENT_MARK / OBJ_ARRAY_64 live inside it.
 *           0x6382 is unnamed shared engine scratch (rejected in ram.js under "0x63xx engine
 *           scratch"), so it stays hex + comment.
 */

import { loc_2c4f } from "./loc_2c4f.js"; // ROM 0x2C4F — the shared slot-claim body

const SCRATCH_REQ = 0x6382; // shared engine scratch: the mode byte, later OR'd with a request top-bit

/**
 * @param {object} m         the machine (uses m.mem only).
 * @param {number} modeByte  the caller's mode byte: stored at 0x6382, then handed on incremented.
 * @param {number} bonus     the current bonus value the shared body's event gate tests against.
 * @returns {void}
 */
export function loc_2c4b(m, modeByte, bonus) {
  const { mem } = m;

  // Record the mode byte, then run the shared body with it bumped by one — so 0x638F ends up one
  // above 0x6382 (the increment sits between the two stores).
  mem.write8(SCRATCH_REQ, modeByte);
  loc_2c4f(m, modeByte + 1, bonus);
}
