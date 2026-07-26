// SPDX-License-Identifier: GPL-3.0-only
/**
 * requestSound2 — ask the sound driver to play effect 2.  ROM 0x4c57.
 *
 * One of a fan of ~20 tiny sound-trigger stubs, each of which requests a single
 * fixed sound effect and shares the same enqueue tail. This one requests command 2:
 * it hands that index to the shared sound-ring enqueue, which marks it pending and
 * drops it into the next free slot of the 8-slot sound ring for the driver to drain.
 * The index is the stub's whole identity — its siblings are byte-for-byte identical
 * apart from which number they request.
 *
 * Since the enqueue runs and then returns straight to this stub's own caller, there
 * is nothing to do after queueing the command: hand off effect 2 and return.
 *
 * Memory-equivalent to the frozen oracle — equivalence-4c57.test.js.
 * GATE:     real-dispatch — the single attract sound request at 0x4c57 (fired once
 *           during boot/round setup), contract RAM (outside the dead stack scratch)
 *           + pc + SP; plus a crafted ring-full entry pinning the wrap. Teeth: a
 *           twin that requests the wrong command index is caught at the ring slot.
 * LIVE-OUT: memory-only — the filled ring slot (SOUND_RING) and the advanced write
 *           pointer (SOUND_HEAD), written by the shared enqueue. No register or flag
 *           is live out; the command byte and flags the oracle path leaves behind are
 *           dead scratch, as are the register pairs it parks on the stack.
 * NAMES:    none of its own — delegates to enqueueSoundCommand, which owns
 *           SOUND_HEAD / SOUND_RING (from ram.js).
 */
import { enqueueSoundCommand } from "./enqueueSoundCommand.js";

export function requestSound2(m) {
  // Queue sound effect 2; the shared enqueue sets the pending bit and files it in
  // the next ring slot.
  enqueueSoundCommand(m, 2);
}
