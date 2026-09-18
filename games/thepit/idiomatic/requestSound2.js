// SPDX-License-Identifier: GPL-3.0-only
/**
 * requestSound2 — ask the sound driver to play effect 2.
 *
 * One of a fan of ~20 tiny sound-trigger stubs, each requesting a single fixed sound effect and
 * sharing the same enqueue tail. This one requests command 2: it hands that index to the shared
 * sound-ring enqueue, which marks it pending and drops it into the next free slot of the 8-slot
 * sound ring for the driver to drain. The siblings are byte-for-byte identical apart from which
 * number they request, and the enqueue returns to the caller with nothing left to do.
 */
import { enqueueSoundCommand } from "./enqueueSoundCommand.js";

export function requestSound2(m) {
  // Queue effect 2; the shared enqueue sets the pending bit and files it in the next ring slot.
  enqueueSoundCommand(m, 2);
}
