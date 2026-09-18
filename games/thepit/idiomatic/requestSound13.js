// SPDX-License-Identifier: GPL-3.0-only
/**
 * requestSound13 — ask the sound driver to play sound-command 13. One of a fan of ~20
 * tiny sound-trigger stubs, each hard-wired to a single sound-command index; this one
 * hands index 13 to the shared sound-ring enqueue, which drops it into the next free
 * ring slot (marked pending) for the driver to pick up later. Which effect command 13
 * selects is not settled, so the name states the command it requests, not the noise.
 */
import { enqueueSoundCommand } from "./enqueueSoundCommand.js";

export function requestSound13(m) {
  // Queue sound command 13; the shared enqueue fills the ring slot and advances the pointer.
  enqueueSoundCommand(m, 13);
}
