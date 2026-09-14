// SPDX-License-Identifier: GPL-3.0-only
import { requestSoundIfEnabled } from "./requestSoundIfEnabled.js";

/**
 * cueMovingSpikeStartSound — request the moving-spike start cue. ROM 0xccee.
 *
 * Role in the machine: the moving spike is the growing spine that creeps up a tube lane toward the
 * rim. When it first arms and begins its climb the game plays a distinct start jingle so the player
 * hears the threat appear. This trampoline is that cue's entry point — a fixed sound-id request rung
 * by advanceMovingSpike (ROM 0x97f8) the frame the spike's height cell loc_202 hits the trigger
 * height 0x10.
 *
 * Behavior: hand the fixed sound id 0x6f to requestSoundIfEnabled, the shared sound-enable gate
 * (ROM 0xccc3), which forwards the request to the audio hardware only while sound is turned on. The
 * caller's X/Y thread through unchanged (they default from m.regs) so the gate sees the same register
 * state the 6502 had on entry.
 *
 * Live-out: nothing of its own — the enable gate queues sound id 0x6f when audio is enabled and is
 * otherwise a no-op. Grounding: seen.
 */
export function cueMovingSpikeStartSound(m, x = m.regs.x, y = m.regs.y) {
  // Fixed cue id 0x6f (moving-spike start) through the enable gate; X/Y pass through untouched.
  requestSoundIfEnabled(m, 0x6f, x, y);
}
