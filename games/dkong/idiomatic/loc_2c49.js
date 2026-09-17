// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_2c49 — the "mode byte 1" door into the bonus-event slot-claim body: stash mode byte 1, then
 * run the shared claim with the caller's bonus value (leaving claim mode 1, scratch 2).
 * LIVE-OUT: memory-only — BARREL_CLAIM_MODE, its two companion scratch bytes, and BONUS_EVENT_MARK.
 */

import { loc_2c4b } from "./loc_2c4b.js"; // the shared slot-claim body

const MODE_BYTE = 0x01; // the mode byte this door stashes into BARREL_CLAIM_MODE

export function loc_2c49(m, c = m.regs.c) {
  loc_2c4b(m, MODE_BYTE, c);
}
