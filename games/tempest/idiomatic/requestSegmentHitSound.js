// SPDX-License-Identifier: GPL-3.0-only
import { requestSoundIfEnabled } from "./requestSoundIfEnabled.js";

/**
 * requestSegmentHitSound — cue the segment/enemy-hit chime. ROM 0xccf6.
 *
 * Role in the machine: a one-line named cue that fires Tempest's "a shot connected" voice.
 * Sound id 0x9f is the hit chime; its sole caller is the per-slot hit/award routine
 * loc_a1fa, which fires it the moment a player shot reaches a lane target and registers a
 * hit — so this is the sound of destroying a Flipper/segment on the tube.
 *
 * Behavior: forward the fixed sound id 0x9f, together with the caller's X/Y (the shot slot
 * and lane indices, defaulted from the machine registers), to the shared enable gate
 * requestSoundIfEnabled. The gate voices it only when global sound is enabled (loc_5 bit 7).
 *
 * Live-out: none directly — the queued voice slot is written downstream in the loader.
 * Grounding: [seen].
 */
export function requestSegmentHitSound(m, x = m.regs.x, y = m.regs.y) {
  // Fixed id 0x9f = hit chime; X/Y ride through untouched to the loader below the gate.
  requestSoundIfEnabled(m, 0x9f, x, y);
}
