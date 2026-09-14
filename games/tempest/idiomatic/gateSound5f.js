// SPDX-License-Identifier: GPL-3.0-only
import { requestSoundIfEnabled } from "./requestSoundIfEnabled.js";

/**
 * gateSound5f -- cue the fixed sound id 0x5f through the sound gate. ROM 0xccb0.
 *
 * Role in the machine: Tempest emits sound effects by handing a sound id to the enable-gated request
 * routine, which only registers the effect when the sound-enable flag is set. This trampoline is the
 * named entry point for effect 0x5f: a call site that always wants that one id jumps here instead of
 * loading it inline, so the id lives in exactly one place. The caller's X and Y pass through untouched,
 * because requestSoundIfEnabled forwards them on to the voice-slot loader.
 *
 * Behavior: tail-call requestSoundIfEnabled with A = 0x5f and the incoming X/Y, and return its result.
 *
 * Live-out: none directly here; requestSoundIfEnabled writes the sound request (only if enabled).
 *
 * Grounding: [seen].
 */
export function gateSound5f(m, x = m.regs.x, y = m.regs.y) {
  return requestSoundIfEnabled(m, 0x5f, x, y);
}
