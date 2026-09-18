// SPDX-License-Identifier: GPL-3.0-only
/**
 * requestSound12 — ask the sound driver to play sound-command 12.
 *
 * One of a fan of tiny sound-trigger stubs, each hard-wired to a single sound-command
 * index. This one requests command 12, handing that index to the shared sound-ring
 * enqueue, which drops it into the next free ring slot (marked pending) for the driver
 * to drain later. Which real effect command 12 selects is not identified here, so the
 * name states the command it requests, not the noise that plays.
 */
import { enqueueSoundCommand } from "./enqueueSoundCommand.js";

export function requestSound12(m) {
  // Queue sound command 12; the shared enqueue fills the ring slot and advances the pointer.
  enqueueSoundCommand(m, 12);
}
