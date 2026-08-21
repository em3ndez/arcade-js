// SPDX-License-Identifier: GPL-3.0-only
import { loc_0010 } from "./loc_0010.js";
import { LAUNCH_STATE, PLAY_MODE_LATCH, HUNTER_SPAWN_COUNTDOWN, HUNTER_RECORD_PTR } from "./names.js";
/**
 * loc_28ad — launch state-3 handler.
 *
 * Runs the state-3 hold countdown: while it is non-zero it just decrements and returns. On
 * expiry it advances the launch state, and — unless the play-mode latch is set — clears the
 * 0x18-byte record addressed by the launch-clear pointer.
 *
 * LIVE-OUT: none consumed (memory only). Scratch is left in A/HL/B; no caller reads them.
 */

const RECORD_LEN = 0x18; // bytes cleared in the pointed-to record

export function loc_28ad(m) {
  const { mem8 } = m;

  if (mem8[HUNTER_SPAWN_COUNTDOWN] !== 0) {
    mem8[HUNTER_SPAWN_COUNTDOWN] = (mem8[HUNTER_SPAWN_COUNTDOWN] - 1);
    return;
  }

  mem8[LAUNCH_STATE] = (mem8[LAUNCH_STATE] + 1);
  if (mem8[PLAY_MODE_LATCH] !== 0) return;

  const record = mem8[HUNTER_RECORD_PTR] | (mem8[HUNTER_RECORD_PTR + 1] << 8);
  loc_0010(m, record, 0, RECORD_LEN);
}
