// SPDX-License-Identifier: GPL-3.0-only
/**
 * requestSound18 — ask the sound driver to play sound-command 18. One of a fan of ~20
 * tiny sound-trigger stubs, each hard-wired to a single sound-command index; this one
 * hands index 18 to the shared sound-ring enqueue, which drops it into the next free
 * ring slot (marked pending) for the driver to pick up later. Which effect command 18
 * selects is not settled, so the name states the command it requests, not the noise.
 */
import { enqueueSoundCommand } from "./enqueueSoundCommand.js";

export function requestSound18(m) {
  // Queue sound command 18; the shared enqueue fills the ring slot and advances the pointer.
  enqueueSoundCommand(m, 18);
}
