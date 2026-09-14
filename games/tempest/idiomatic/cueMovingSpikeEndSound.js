// SPDX-License-Identifier: GPL-3.0-only
import { requestSoundIfEnabled } from "./requestSoundIfEnabled.js";

/**
 * cueMovingSpikeEndSound — request the moving-spike end cue. ROM 0xccf2.
 *
 * Role in the machine: a Spike is the tail an enemy leaves growing up its tube lane; a moving Spike climbs.
 * When one finishes — its height overflows the ceiling (fired from loc_97f8) — this trampoline asks for the
 * corresponding sound effect. It carries no logic of its own: it names the fixed sound id 0x7f and hands off
 * to the shared enable gate, which drops the request when audio is muted (e.g. attract mode / self-test).
 *
 * Behavior: tail-call requestSoundIfEnabled (loc_ccc3) with sound id 0x7f, passing X/Y through untouched.
 *
 * Live-out: nothing here directly — the enable gate queues the sound id when audio is enabled. Grounding: [seen].
 */
export function cueMovingSpikeEndSound(m, x = m.regs.x, y = m.regs.y) {
  requestSoundIfEnabled(m, 0x7f, x, y); // fixed id 0x7f, through the mute-aware enable gate
}
