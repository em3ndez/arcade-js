// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_2c86 — one entry of the bonus-event slot-claim cluster (0x2C41): clear the slot-claim
 * request flag, then hand off to the shared slot-claim entry with mode byte 3.  ROM 0x2C86.
 *
 * What sets this entry apart from its siblings is that it CLEARS BARREL_CLAIM_MODE to zero up
 * front, then tails into armBarrelRelease with the mode byte 3 and the caller's bonus value. armBarrelRelease
 * always records the mode byte and, only when the bonus counter has reached its scheduled mark,
 * claims the first free object slot and raises bit 7 of that same byte. So on this entry the byte
 * ends up 0 (no claim this pass) or 0x80 (slot claimed) — never carrying an older value in,
 * because the hand-off is preceded by the clear.
 *
 * GROUNDED — observed live in MAME 0.288 on the real dkong ROM (understanding pass 12,
 * scratchpad/pass12-grounding.md): bit 7 of BARREL_CLAIM_MODE is the 25m BARREL-KIND select. One
 * frame after a bit-7-set claim, stampReleasedBarrelKind stamps the freshly-released OBJ_ARRAY_67 barrel record
 * with sprite code/attr/mode 0x19 / 0x0C / 0x01 instead of the default 0x15 / 0x0B / 0x00 — 46/46
 * agreement over every captured dispatch, no exceptions (38 clear, 8 set), all of them ordinary
 * board-1 25m gameplay (ZERO in the opening Kong-climb cutscene). The bit-7-SET (attr 0x0C) kind
 * DROPS with its X pinned at 59; the bit-7-CLEAR (attr 0x0B) kind ROLLS along the girders.
 * Grounding deliberately did NOT establish which NAMED Donkey Kong object either kind is.
 *
 * The bonus value is the caller's live-in: this entry is still reached from the translated cluster
 * (scheduleBarrelRelease / entry_2c41, via `jp nz,0x2c86`), which pass it in a register, so it is read at that
 * oracle boundary and forwarded as an honest argument.
 *
 * Memory-equivalent to the frozen oracle — equivalence-2c86.test.js.
 * GATE:     exhaustive over the bonus value with a pre-dirtied mode byte (isolating the up-front
 *           clear + the two scratch writes armBarrelRelease always makes, gate mostly closed), plus crafted
 *           gate-open entries over every first-free-slot position (records 0..4) and the all-occupied
 *           case — proving the byte is cleared to 0 then re-raised to 0x80 only on a claim; + real
 *           captured 0x2C86 dispatches from an attract run (which span both gate arms). Teeth: a twin
 *           that skips the clear and a twin that passes the wrong mode byte.
 * LIVE-OUT: memory-only — BARREL_CLAIM_MODE plus everything armBarrelRelease writes (0x638F, 0x6392,
 *           BONUS_EVENT_MARK). The oracle threads residual registers/flags out and its single
 *           terminal pop is dead; the translated callers reload before reading anything back.
 *           Nothing writes the stack, so the gate needs no STACK_SCRATCH exclusion.
 * NAMES:    armBarrelRelease (ROM 0x2C4F) direct-called with honest args. BARREL_CLAIM_MODE (0x6382) from
 *           ram.js — the barrel slot-claim mode byte, whose low bits carry the claim's mode value
 *           and whose bit 7 selects the barrel kind; the cells armBarrelRelease touches carry their names
 *           inside that routine.
 */

import { BARREL_CLAIM_MODE } from "./ram.js"; // ROM 0x6382 — the barrel slot-claim mode byte
import { armBarrelRelease } from "./armBarrelRelease.js"; // ROM 0x2C4F — the shared slot-claim entry

const MODE_BYTE = 0x03; // the mode byte this entry stashes via armBarrelRelease

/**
 * @param {object} m  the machine (reads the bonus live-in from registers, writes memory).
 * @returns {void}
 */
export function loc_2c86(m) {
  const { regs, mem } = m;

  // Clear the slot-claim mode byte before entering the shared slot-claim path.
  mem.write8(BARREL_CLAIM_MODE, 0);

  // Hand off to the shared entry: mode byte 3, and the caller's bonus value (the register live-in
  // from the still-translated cluster callers).
  armBarrelRelease(m, MODE_BYTE, regs.c);
}
