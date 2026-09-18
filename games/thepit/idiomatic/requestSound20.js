// SPDX-License-Identifier: GPL-3.0-only
/**
 * requestSound20 — ask the sound driver to play sound-command 20.
 *
 * One of a fan of ~20 tiny sound-trigger stubs, each hard-wired to a single sound-command index and
 * sharing one enqueue tail. This one requests command 20: it hands that index to the shared
 * sound-ring enqueue, which marks it pending (high bit) and drops it into the next free slot of the
 * 8-slot sound ring for the driver to drain later. Which real effect command 20 selects is not yet
 * identified, so the name states the command it requests, not the noise that plays.
 */
import { enqueueSoundCommand } from "./enqueueSoundCommand.js";

export function requestSound20(m) {
  // Queue command 20; the shared enqueue sets the pending bit and files it in the next ring slot.
  enqueueSoundCommand(m, 20);
}
