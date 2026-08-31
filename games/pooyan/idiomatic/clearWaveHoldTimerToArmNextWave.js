// SPDX-License-Identifier: GPL-3.0-only
import { WAVE_HOLD_TIMER } from "./names.js";
/**
 * clearWaveHoldTimerToArmNextWave — hunter-dispatch state 3: reset the inter-wave hold and abort the walk.
 *
 * ROM 0x2d4a–0x2d50. This is the state-3 handler of the hunter (enemy) dispatch: the dispatcher
 * indexes a table of per-state handlers while walking the hunter records, and lands here when a
 * record is in state 3. Its whole effect is to zero WAVE_HOLD_TIMER (0x8f36), the inter-wave
 * hold countdown [seen] that drains to 0 to gate the release of the next attack wave. Zeroing
 * it collapses any remaining hold so the next wave can be armed immediately.
 *
 * It then signals the dispatcher to STOP: on the hardware this handler discards the caller's
 * saved return before returning, so control does not resume the per-record walk — it unwinds a
 * level and abandons the rest of the pass. That control decision surfaces here as a returned
 * `false`, the caller-skip boolean the walk checks to break out.
 *
 * GROUNDING: names.js carries no cert entry for this routine's own address; the cell it writes,
 * WAVE_HOLD_TIMER, is [seen].
 *
 * LIVE-OUT: WAVE_HOLD_TIMER cleared to 0, and the `false` caller-skip that aborts the walk.
 */
export function clearWaveHoldTimerToArmNextWave(m) {
  // Collapse the inter-wave hold so the next attack wave is no longer gated by the countdown.
  m.mem8[WAVE_HOLD_TIMER] = 0;
  // Break out of the per-record hunter walk (the ROM drops the saved return to unwind a level).
  return false; // caller-skip
}
