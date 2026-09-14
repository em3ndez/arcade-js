// SPDX-License-Identifier: GPL-3.0-only
import { requestSoundIfEnabled } from "./requestSoundIfEnabled.js";

/**
 * requestMotionFlipSound — voice an enemy direction reversal on the rim. ROM 0xcd02.
 *
 * Role in the machine: a one-line cue that requests fixed sound id 0x3f through the enable
 * gate requestSoundIfEnabled (loc_ccc3), threading the slot index X. Its sole caller (loc_9b1e)
 * fires it as a correction when a per-slot motion accumulator (loc_148) sign-flips — i.e. when
 * an enemy travelling around the rim reverses direction — so this is the sound of that flip.
 *
 * Behavior: forward X (the reversing slot) and the constant id 0x3f into the gated request.
 * Live-out: a queued sound request when the loc_5 enable flag permits it (dropped otherwise).
 * Grounding: [seen].
 */
export function requestMotionFlipSound(m, x = m.regs.x) {
  // id 0x3f, gated by loc_5; X carries the slot whose motion accumulator flipped.
  requestSoundIfEnabled(m, 0x3f, x);
}
