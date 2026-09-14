// SPDX-License-Identifier: GPL-3.0-only
import { loadSoundVoiceSlots } from "./loadSoundVoiceSlots.js";

/**
 * requestActiveSoundCue — re-voice the currently-held sound cue every frame. ROM 0xccfa.
 *
 * Role in the machine: a one-line cue that jumps straight into the voice loader
 * loadSoundVoiceSlots (loc_ccc7) for fixed sound id 0xaf, deliberately BYPASSING the
 * loc_5 enable gate the other cues pass through. The frame dispatcher seedFramePhaseAndTick
 * (0xc891) calls it every frame while the loc_c "sound live" flag is set, so it keeps
 * (re)voicing the active held cue regardless of the enable flag's state.
 *
 * Behavior: forward the raw X and Y registers into the loader with the constant id 0xaf.
 * Live-out: whatever the loader writes into the sound voice slots. Grounding: [seen].
 */
export function requestActiveSoundCue(m, x = m.regs.x, y = m.regs.y) {
  // Load fixed id 0xaf directly (no enable gate); X/Y threaded through to the loader.
  loadSoundVoiceSlots(m, 0xaf, x, y);
}
