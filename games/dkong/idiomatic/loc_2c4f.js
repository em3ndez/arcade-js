// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_2c4f — one entry of the bonus-event slot-claim cluster (0x2C41): stash the caller's
 * mode byte, then, when the bonus counter has reached its scheduled mark, step the mark and
 * claim a free object slot.  ROM 0x2C4F.
 *
 * The routine always records two bytes of engine scratch: the caller's mode byte into 0x638F
 * and a 1 into 0x6392. Unlike its sibling entries, THIS entry does not stamp the paired byte
 * 0x6382 up front — that byte is only touched later, and only if a slot is claimed.
 *
 * Then the periodic-event gate: it proceeds only when the next-event mark (BONUS_EVENT_MARK)
 * equals the current bonus value passed in; otherwise it returns having done just the two
 * scratch writes. When the mark is hit it schedules the next fire by stepping the mark down by
 * 8, then scans the five records of OBJ_ARRAY_64 (stride 32) for the first one whose active
 * byte is zero — a free slot. On finding one it raises the top-bit request flag on engine
 * scratch 0x6382 (via loc_2c72); if all five are occupied it does nothing further.
 *
 * Memory-equivalent to the frozen oracle — equivalence-2c4f.test.js.
 * GATE:     exhaustive over the stash byte (all 256 caller values, gate closed) + crafted
 *           entries driving the gate-open path across every first-free-slot position (records
 *           0..4) and the all-occupied case, the gate boundary (mark ==/!= bonus), and the
 *           mark step at a low value; + real captured 0x2C4F dispatches from an attract run.
 *           Teeth: a wrong mark step, an inverted gate, and a dropped slot-flag twin.
 * LIVE-OUT: memory-only — 0x638F, 0x6392, BONUS_EVENT_MARK, and (slot-claim only) 0x6382. The
 *           oracle threads residual registers/flags out and its callers reload; nothing reads a
 *           register the routine leaves behind.
 * NAMES:    BONUS_EVENT_MARK (0x62B2), OBJ_ARRAY_64 (0x6400) from ram.js; loc_2c72 (ROM 0x2C72)
 *           direct-called. The scratch cells 0x638F/0x6392 are unnamed engine scratch (rejected
 *           in ram.js under "0x63xx engine scratch"), so they stay hex + comment; 0x6382 lives
 *           inside loc_2c72.
 */

import { BONUS_EVENT_MARK, OBJ_ARRAY_64 } from "./ram.js";
import { loc_2c72 } from "./loc_2c72.js"; // ROM 0x2C72 — raise the request flag on scratch 0x6382

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
export function loc_2c4f(m, scratchValue, bonus) {
  const { mem } = m;

  // Record the caller's mode byte and raise the entry flag (done on every entry).
  mem.write8(SCRATCH_MODE, scratchValue);
  mem.write8(SCRATCH_FLAG, 1);

  // Periodic-event gate: fire only when the bonus counter has reached the scheduled mark.
  const mark = mem.read8(BONUS_EVENT_MARK);
  if (mark !== bonus) return;

  // Schedule the next fire by stepping the mark down.
  mem.write8(BONUS_EVENT_MARK, mark - EVENT_STEP);

  // Claim the first free (zero active-byte) slot; flag the request on it.
  for (let i = 0; i < RECORDS; i++) {
    if (mem.read8(OBJ_ARRAY_64 + i * STRIDE) === 0) {
      loc_2c72(m); // raise the top-bit request flag on engine scratch 0x6382
      return;
    }
  }
  // All five records occupied: nothing further to do.
}
