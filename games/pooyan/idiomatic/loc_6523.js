// SPDX-License-Identifier: GPL-3.0-only
import { loc_0038 } from "./loc_0038.js";
import {
  SIGNATURE_MISMATCH_FLAG,
  SHARED_FRAME_DELAY_TIMER,
  ROUND_COUNTER,
  OBJECT_SPAWN_DISPLAY_CMD,
  OBJECT_SPAWN_DISPLAY_CMD_ALT,
} from "./names.js";
/**
 * loc_6523 — seat a fresh object record (based at IX) and enqueue its display command.
 *
 * Bails when the record's id word (IX+0 | IX+1) is odd or the signature-mismatch flag is held.
 * Otherwise it stamps the opening state (active flag, cleared fields, fixed field bytes), snapshots
 * the shared frame-delay counter into IX+6 and steps that counter down by two, then enqueues the
 * object-spawn display command — plus a second variant when the round counter is zero.
 *
 * LIVE-OUT: none — memory-only. The caller preserves its own registers across this call (exx),
 * so the record bytes, the decremented counter and the enqueued display words are the whole effect.
 */

export function loc_6523(m, rec = m.regs.ix) {
  const { mem8 } = m;

  // Bail on an odd id word or while the signature-mismatch gate is held.
  if (((mem8[rec + 0] | mem8[rec + 1]) & 0x01) !== 0) return;
  if (mem8[SIGNATURE_MISMATCH_FLAG] !== 0) return;

  // Seat the fresh record.
  mem8[rec + 0] = 0x01; // active
  mem8[rec + 3] = 0x00;
  mem8[rec + 5] = 0x00;
  mem8[rec + 4] = 0x15;
  mem8[rec + 6] = mem8[SHARED_FRAME_DELAY_TIMER]; // snapshot the shared frame-delay counter
  mem8[SHARED_FRAME_DELAY_TIMER] = mem8[SHARED_FRAME_DELAY_TIMER] - 2; // step it down by two
  mem8[rec + 0x0f] = 0x03;
  mem8[rec + 0x10] = 0xc0;
  mem8[rec + 0x08] = 0x30;
  mem8[rec + 0x09] = 0xf0;

  // Enqueue the object-spawn display command; a second variant on round 0.
  loc_0038(m, OBJECT_SPAWN_DISPLAY_CMD);
  if (mem8[ROUND_COUNTER] !== 0) return;
  loc_0038(m, OBJECT_SPAWN_DISPLAY_CMD_ALT);
}
