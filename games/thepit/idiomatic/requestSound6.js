// SPDX-License-Identifier: GPL-3.0-only
/**
 * requestSound6 — ask the sound driver to play sound-command 6.  ROM 0x4c67.
 *
 * One of a fan of ~20 tiny sound-trigger stubs, each hard-wired to a single sound-
 * command index. This one requests command 6: it hands that index to the shared
 * sound-ring enqueue, which sets the pending bit and drops it into the next free slot
 * of the 8-slot sound ring for the sound driver to drain later. The index is the
 * stub's whole identity — its neighbours request 5 and 7 from the adjacent addresses.
 *
 * Which real effect command 6 plays is not yet identified, so the name records only
 * what the code does — request that command — not the sound itself.
 *
 * Memory-equivalent to the frozen oracle — equivalence-4c67.test.js.
 * GATE:     real-dispatch — attract requests command 6 once (fired a few hundred
 *           frames into the demo), contract RAM (outside the dead stack scratch) + pc
 *           + SP; plus a crafted ring-full entry pinning the wrap. Teeth: a twin that
 *           requests the wrong command index is caught at the ring slot.
 * LIVE-OUT: memory-only — the filled ring slot (SOUND_RING) and the advanced write
 *           pointer (SOUND_HEAD), written by the shared enqueue. No register or flag
 *           is live out; the command byte and flags the oracle path leaves behind are
 *           dead scratch, as are the register pairs it parks on the stack.
 * NAMES:    none of its own — delegates to enqueueSoundCommand, which owns
 *           SOUND_HEAD / SOUND_RING (from ram.js).
 */
import { enqueueSoundCommand } from "./enqueueSoundCommand.js";

export function requestSound6(m) {
  // Queue sound command 6; the shared enqueue sets the pending bit and files it in
  // the next ring slot, then returns straight to this stub's own caller.
  enqueueSoundCommand(m, 6);
}
