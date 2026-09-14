// SPDX-License-Identifier: GPL-3.0-only
import { requestSoundIfEnabled } from "./requestSoundIfEnabled.js";

/**
 * gateSound1f -- cue the fixed sound id 0x1f through the sound gate. ROM 0xccc1.
 *
 * Role in the machine: Tempest emits sound effects by handing a sound id to the enable-gated request
 * routine, which only registers the effect when the sound-enable flag is set. Several call sites want a
 * specific, hard-coded effect and would otherwise have to load the id inline; this trampoline is the
 * named entry point for effect 0x1f (the enemy-spawn cue used by spawnEnemyInSlot), keeping the id in one
 * place. It carries the caller's X and Y through untouched, since requestSoundIfEnabled forwards them to
 * the voice-slot loader.
 *
 * Behavior: tail-call requestSoundIfEnabled with A = 0x1f and the incoming X/Y, and return its result.
 *
 * Live-out: none directly here; requestSoundIfEnabled writes the sound request (only if enabled).
 *
 * Grounding: [seen].
 */
export function gateSound1f(m, x = m.regs.x, y = m.regs.y) {
  return requestSoundIfEnabled(m, 0x1f, x, y);
}
