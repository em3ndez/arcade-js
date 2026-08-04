// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_2c49 — the "mode byte 1" door into the bonus-event slot-claim body: stash a mode byte of 1,
 * then run the shared claim with the caller's bonus value.
 *
 * The mode byte is a hard CONSTANT at this door. The shared body records it into
 * BARREL_CLAIM_MODE and runs with that byte bumped by one, so entering here always leaves the
 * claim mode at 1 and its companion scratch byte at 2 — nothing the caller holds can change
 * either of those two stored values.
 *
 * The shared body then runs the periodic-event gate against the bonus value: ONLY when the
 * next-event mark (BONUS_EVENT_MARK) equals the bonus does the mark step down by 8 and the first
 * free object slot get claimed, raising bit 7 on that same claim-mode byte — so a claimed slot
 * leaves it at 0x81, mode value 1 with the kind-select bit set. On a miss only the two mode
 * writes happen.
 *
 * BIT 7 IS THE BARREL-KIND SELECT on the girder board. The barrel released on the frame after a
 * bit-7 claim is the DROPPING kind: it falls with its X pinned instead of rolling along the
 * girders, and it carries its own sprite code and colour attribute to match. A claim with bit 7
 * clear releases the ordinary rolling barrel. NOT CLAIMED: which named Donkey Kong hazard the
 * dropping kind is.
 *
 * The bonus value is the caller's live-in — it arrives in a register, is read at entry and
 * forwarded on as an honest argument.
 *
 * LIVE-OUT: memory-only — BARREL_CLAIM_MODE, the two companion scratch bytes, and
 * BONUS_EVENT_MARK. Nothing reads a register this routine leaves behind, and nothing here
 * writes the stack.
 */

import { loc_2c4b } from "./loc_2c4b.js"; // the shared slot-claim body

const MODE_BYTE = 0x01; // the mode byte this door stashes into BARREL_CLAIM_MODE

/**
 * @param {object} m  the machine (reads the bonus live-in from registers, writes memory).
 * @returns {void}
 */
export function loc_2c49(m) {
  const { regs } = m;

  // Mode byte 1, plus the caller's bonus value (the register live-in).
  loc_2c4b(m, MODE_BYTE, regs.c);
}
