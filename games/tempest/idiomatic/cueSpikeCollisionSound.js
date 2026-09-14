// SPDX-License-Identifier: GPL-3.0-only
import { requestSoundIfEnabled } from "./requestSoundIfEnabled.js";

/**
 * cueSpikeCollisionSound — request the spike-collision hit sound. ROM 0xcd06.
 *
 * Role in the machine: a moving spike that climbs all the way up its lane can strike the player's
 * blaster on the rim. When advanceMovingSpike (ROM 0x97f8) scans loc_3ac and finds the spike has
 * reached the player's segment lane loc_200, it registers the collision and rings this cue so the
 * fatal hit is heard. This trampoline is that hit sound's entry point.
 *
 * Behavior: hand the fixed sound id 0xcf to requestSoundIfEnabled, the shared sound-enable gate
 * (ROM 0xccc3), which forwards the request to the audio hardware only while sound is turned on. The
 * caller's X/Y thread through unchanged (they default from m.regs) so the gate sees the same register
 * state the 6502 had on entry.
 *
 * Live-out: nothing of its own — the enable gate queues sound id 0xcf when audio is enabled and is
 * otherwise a no-op. Grounding: seen.
 */
export function cueSpikeCollisionSound(m, x = m.regs.x, y = m.regs.y) {
  // Fixed cue id 0xcf (spike-collision hit) through the enable gate; X/Y pass through untouched.
  requestSoundIfEnabled(m, 0xcf, x, y);
}
