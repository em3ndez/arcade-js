// SPDX-License-Identifier: GPL-3.0-only
/**
 * requestSound15 — ask the sound driver to play sound-command 15.
 *
 * One of a fan of small sound-trigger stubs, each hard-wired to a single command index. This one
 * hands index 15 to the shared enqueue, which drops it into the next free slot of the sound ring
 * (marked pending) for the driver to drain later. Which real effect command 15 selects is not yet
 * identified, so the name states the command it requests, not the noise that plays.
 */
import { enqueueSoundCommand } from "./enqueueSoundCommand.js";

export function requestSound15(m) {
  // Queue sound command 15; the shared enqueue fills the ring slot and advances the pointer.
  enqueueSoundCommand(m, 15);
}
