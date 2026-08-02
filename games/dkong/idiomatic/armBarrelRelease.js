// SPDX-License-Identifier: GPL-3.0-only
/**
 * armBarrelRelease — one entry of the bonus-event slot-claim cluster (0x2C41): stash the caller's
 * mode byte, then, when the bonus counter has reached its scheduled mark, step the mark and
 * claim a free object slot.  ROM 0x2C4F.
 *
 * The routine always records two bytes of engine scratch: the caller's mode byte into 0x638F
 * and a 1 into 0x6392. Unlike its sibling entries, THIS entry does not stamp the paired byte
 * BARREL_CLAIM_MODE up front — that byte is only touched later, and only if a slot is claimed.
 *
 * Then the periodic-event gate: it proceeds only when the next-event mark (BONUS_EVENT_MARK)
 * equals the current bonus value passed in; otherwise it returns having done just the two
 * scratch writes. When the mark is hit it schedules the next fire by stepping the mark down by
 * 8, then scans the five records of OBJ_ARRAY_64 (stride 32) for the first one whose active
 * byte is zero — a free slot. On finding one it raises bit 7 of BARREL_CLAIM_MODE (via
 * markNextBarrelAsDroppingKind); if all five are occupied it does nothing further.
 *
 * GROUNDED — observed live in MAME 0.288 on the real dkong ROM (understanding pass 12,
 * scratchpad/pass12-grounding.md): bit 7 of BARREL_CLAIM_MODE is the 25m BARREL-KIND select. One
 * frame after a bit-7-set claim, stampReleasedBarrelKind stamps the freshly-released OBJ_ARRAY_67 barrel record
 * with sprite code/attr/mode 0x19 / 0x0C / 0x01 instead of the default 0x15 / 0x0B / 0x00 — 46/46
 * agreement over every captured dispatch, no exceptions (38 clear, 8 set), all of them ordinary
 * board-1 25m gameplay (ZERO in the opening Kong-climb cutscene). The bit-7-SET (attr 0x0C) kind
 * DROPS with its X pinned at 59; the bit-7-CLEAR (attr 0x0B) kind ROLLS along the girders.
 * Grounding deliberately did NOT establish which NAMED Donkey Kong object either kind is.
 * Note the two arrays are distinct: the free-slot scan here sweeps OBJ_ARRAY_64, while the
 * barrel record stampReleasedBarrelKind later stamps lives in OBJ_ARRAY_67.
 *
 * Memory-equivalent to the frozen oracle — equivalence-2c4f.test.js.
 * GATE:     exhaustive over the stash byte (all 256 caller values, gate closed) + crafted
 *           entries driving the gate-open path across every first-free-slot position (records
 *           0..4) and the all-occupied case, the gate boundary (mark ==/!= bonus), and the
 *           mark step at a low value; + real captured 0x2C4F dispatches from an attract run.
 *           Teeth: a wrong mark step, an inverted gate, and a dropped slot-flag twin.
 * LIVE-OUT: memory-only — 0x638F, 0x6392, BONUS_EVENT_MARK, and (slot-claim only)
 *           BARREL_CLAIM_MODE. The oracle threads residual registers/flags out and its callers
 *           reload; nothing reads a register the routine leaves behind.
 * NAMES:    BONUS_EVENT_MARK (0x62B2), OBJ_ARRAY_64 (0x6400) from ram.js; markNextBarrelAsDroppingKind (ROM 0x2C72)
 *           direct-called. The scratch cells 0x638F/0x6392 are unnamed engine scratch (rejected
 *           in ram.js under "0x63xx engine scratch"), so they stay hex + comment;
 *           BARREL_CLAIM_MODE (0x6382) is named in ram.js and imported inside markNextBarrelAsDroppingKind, which is
 *           where this routine's only write to it happens.
 */

import { BONUS_EVENT_MARK, OBJ_ARRAY_64 } from "./ram.js";
import { markNextBarrelAsDroppingKind } from "./markNextBarrelAsDroppingKind.js"; // ROM 0x2C72 — raise bit 7 of BARREL_CLAIM_MODE

const SCRATCH_MODE = 0x638f; // engine scratch: the caller's mode byte is recorded here
const SCRATCH_FLAG = 0x6392; // engine scratch: raised to 1 on every entry
const RECORDS = 5; // records swept in OBJ_ARRAY_64
const STRIDE = 32; // OBJ_ARRAY_64 record stride (0x20 bytes)
const EVENT_STEP = 8; // amount the event mark drops each time it fires

/**
 * @param {object} m           the machine (uses m.mem only).
 * @param {number} scratchValue  the caller's mode byte, stashed into engine scratch 0x638F.
 * @param {number} bonus         the current bonus value the event mark is tested against.
 * @returns {void}
 */
export function armBarrelRelease(m, scratchValue, bonus) {
  const { mem } = m;

  // Record the caller's mode byte and raise the entry flag (done on every entry).
  mem.write8(SCRATCH_MODE, scratchValue);
  mem.write8(SCRATCH_FLAG, 1);

  // Periodic-event gate: fire only when the bonus counter has reached the scheduled mark.
  const mark = mem.read8(BONUS_EVENT_MARK);
  if (mark !== bonus) return;

  // Schedule the next fire by stepping the mark down.
  mem.write8(BONUS_EVENT_MARK, mark - EVENT_STEP);

  // Claim the first free (zero active-byte) slot; tag the claim on it.
  for (let i = 0; i < RECORDS; i++) {
    if (mem.read8(OBJ_ARRAY_64 + i * STRIDE) === 0) {
      markNextBarrelAsDroppingKind(m); // raise bit 7 (the barrel-kind select) on BARREL_CLAIM_MODE
      return;
    }
  }
  // All five records occupied: nothing further to do.
}
