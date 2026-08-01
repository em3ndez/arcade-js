// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_2c86 — one entry of the bonus-event slot-claim cluster (0x2C41): clear the slot-claim
 * request flag, then hand off to the shared slot-claim entry with mode byte 3.  ROM 0x2C86.
 *
 * What sets this entry apart from its siblings is that it CLEARS the request-flag scratch byte
 * 0x6382 to zero up front, then tails into loc_2c4f with the mode byte 3 and the caller's bonus
 * value. loc_2c4f always records the mode byte and, only when the bonus counter has reached its
 * scheduled mark, claims the first free object slot and raises the top bit of that same request
 * flag. So on this entry the flag ends up 0 (no claim this pass) or 0x80 (slot claimed) — never
 * carrying an older value in, because the hand-off is preceded by the clear.
 *
 * The bonus value is the caller's live-in: this entry is still reached from the translated cluster
 * (entry_2c03 / entry_2c41, via `jp nz,0x2c86`), which pass it in a register, so it is read at that
 * oracle boundary and forwarded as an honest argument.
 *
 * Memory-equivalent to the frozen oracle — equivalence-2c86.test.js.
 * GATE:     exhaustive over the bonus value with a pre-dirtied request flag (isolating the up-front
 *           clear + the two scratch writes loc_2c4f always makes, gate mostly closed), plus crafted
 *           gate-open entries over every first-free-slot position (records 0..4) and the all-occupied
 *           case — proving the flag is cleared to 0 then re-raised to 0x80 only on a claim; + real
 *           captured 0x2C86 dispatches from an attract run (which span both gate arms). Teeth: a twin
 *           that skips the clear and a twin that passes the wrong mode byte.
 * LIVE-OUT: memory-only — 0x6382 plus everything loc_2c4f writes (0x638F, 0x6392, BONUS_EVENT_MARK).
 *           The oracle threads residual registers/flags out and its single terminal pop is dead; the
 *           translated callers reload before reading anything back. Nothing writes the stack, so the
 *           gate needs no STACK_SCRATCH exclusion.
 * NAMES:    loc_2c4f (ROM 0x2C4F) direct-called with honest args. 0x6382 is unnamed engine scratch
 *           (rejected in ram.js under "0x63xx engine scratch"), so it stays hex + comment; the cells
 *           loc_2c4f touches carry their names inside that routine.
 */

import { loc_2c4f } from "./loc_2c4f.js"; // ROM 0x2C4F — the shared slot-claim entry

const SCRATCH_REQ = 0x6382; // engine scratch: the slot-claim request flag; cleared before the hand-off
const MODE_BYTE = 0x03; // the mode byte this entry stashes via loc_2c4f

/**
 * @param {object} m  the machine (reads the bonus live-in from registers, writes memory).
 * @returns {void}
 */
export function loc_2c86(m) {
  const { regs, mem } = m;

  // Clear the slot-claim request flag before entering the shared slot-claim path.
  mem.write8(SCRATCH_REQ, 0);

  // Hand off to the shared entry: mode byte 3, and the caller's bonus value (the register live-in
  // from the still-translated cluster callers).
  loc_2c4f(m, MODE_BYTE, regs.c);
}
