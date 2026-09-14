// SPDX-License-Identifier: GPL-3.0-only
import { requestSoundIfEnabled } from "./requestSoundIfEnabled.js";

/**
 * gateSound8f -- cue the fixed sound id 0x8f through the sound gate. ROM 0xccbd.
 *
 * Role in the machine: Tempest emits sound effects by handing a sound id to the enable-gated request
 * routine, which only registers the effect when the sound-enable flag is set. This trampoline is the
 * named entry point for effect 0x8f: call sites that always want that one id branch here rather than
 * loading it inline, keeping the id in a single place. The caller's X and Y pass through untouched,
 * because requestSoundIfEnabled forwards them on to the voice-slot loader.
 *
 * Behavior: call requestSoundIfEnabled with A = 0x8f and the incoming X/Y. Unlike the other gate
 * trampolines this one does not return the callee's value -- it falls off the end (the original returned
 * to its own caller with no result of interest).
 *
 * Live-out: none directly here; requestSoundIfEnabled writes the sound request (only if enabled).
 *
 * Grounding: [seen].
 */
export function gateSound8f(m, x = m.regs.x, y = m.regs.y) {
  requestSoundIfEnabled(m, 0x8f, x, y);
}
