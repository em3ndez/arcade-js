// SPDX-License-Identifier: GPL-3.0-only
/**
 * requestSound17 — ask the sound driver to play sound-command 17.
 *
 * One of a fan of small sound-trigger stubs, each hard-wired to a single command index. This one
 * hands index 17 to the shared enqueue, which drops it into the next free slot of the sound ring
 * (marked pending) for the driver to drain later. Which real effect command 17 selects is not yet
 * identified, so the name states the command it requests, not the noise that plays.
 */
import { enqueueSoundCommand } from "./enqueueSoundCommand.js";

export function requestSound17(m) {
  // Queue sound command 17; the shared enqueue fills the ring slot and advances the pointer.
  enqueueSoundCommand(m, 17);
}
