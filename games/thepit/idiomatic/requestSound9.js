// SPDX-License-Identifier: GPL-3.0-only
/**
 * requestSound9 — ask the sound driver to play sound-command 9.
 * One of a fan of tiny sound-trigger stubs, each hard-wired to a single sound-command
 * index. This one requests command 9, handing that index to the shared sound-ring
 * enqueue, which marks it pending (high bit) and drops it into the next free ring slot
 * for the driver to drain later. Which real effect command 9 selects is not identified
 * here, so the name states the command it requests, not the noise that plays.
 */
import { enqueueSoundCommand } from "./enqueueSoundCommand.js";

export function requestSound9(m) {
  // Queue sound command 9; the shared enqueue fills the ring slot and advances the pointer.
  enqueueSoundCommand(m, 9);
}
