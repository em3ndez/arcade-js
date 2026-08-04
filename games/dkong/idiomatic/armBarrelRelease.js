// SPDX-License-Identifier: GPL-3.0-only
/**
 * armBarrelRelease — one entry of the bonus-event slot-claim cluster: stash the caller's mode
 * byte, then, when the bonus counter has reached its scheduled mark, step the mark and claim a
 * free object slot.
 *
 * The routine always records two bytes of engine scratch: the caller's mode byte, and a 1 into
 * a companion flag. Unlike the cluster's other entries, THIS one does not stamp the paired
 * barrel-claim mode byte up front — that byte is touched only later, and only if a slot is
 * claimed.
 *
 * Then the periodic-event gate: it proceeds only when the next-event mark equals the current
 * bonus value passed in; otherwise it returns having done just the two scratch writes. When
 * the mark is hit it schedules the next fire by stepping the mark down by 8, then scans the
 * five records of OBJ_ARRAY_64 for the first one whose active byte is zero — a free slot. On
 * finding one it raises the barrel-kind bit on the claim mode byte; if all five are occupied
 * it does nothing further.
 *
 * That bit selects which KIND of barrel the next release becomes: set, the released barrel
 * gets an alternate sprite code, attribute and mode, and drops straight down with its X pinned;
 * clear, it rolls along the girders. Which named Donkey Kong object either kind is has not
 * been established.
 *
 * LIVE-OUT: memory-only — the two scratch bytes, the event mark, and (on a slot claim only)
 * the barrel-claim mode byte.
 */

import { BONUS_EVENT_MARK, OBJ_ARRAY_64 } from "./names.js";
import { markNextBarrelAsAltKind } from "./markNextBarrelAsAltKind.js";

const SCRATCH_MODE = 0x638f; // engine scratch: the caller's mode byte is recorded here
const SCRATCH_FLAG = 0x6392; // engine scratch: raised to 1 on every entry
const RECORDS = 5; // records swept in OBJ_ARRAY_64
const STRIDE = 32; // OBJ_ARRAY_64 record stride
const EVENT_STEP = 8; // amount the event mark drops each time it fires

/**
 * @param {object} m           the machine (uses m.mem only).
 * @param {number} scratchValue  the caller's mode byte, stashed into engine scratch.
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
      markNextBarrelAsAltKind(m); // raise the barrel-kind select on the claim mode byte
      return;
    }
  }
  // All five records occupied: nothing further to do.
}
