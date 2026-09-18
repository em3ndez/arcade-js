// SPDX-License-Identifier: GPL-3.0-only
/**
 * requestSound16 — ask the sound driver to play sound-command 16.
 *
 * One of a fan of small sound-trigger stubs, each hard-wired to a single command index and
 * sharing one enqueue tail. This one hands index 16 to the shared enqueue, which marks it pending
 * (high bit) and drops it into the next free slot of the 8-slot sound ring for the driver to drain
 * later. Which real effect command 16 selects is not yet identified, so the name states the
 * command it requests, not the noise that plays.
 */
import { enqueueSoundCommand } from "./enqueueSoundCommand.js";

export function requestSound16(m) {
  // Queue sound command 16; the shared enqueue sets the pending bit and files the ring slot.
  enqueueSoundCommand(m, 16);
}
