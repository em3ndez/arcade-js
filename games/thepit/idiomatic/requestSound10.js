// SPDX-License-Identifier: GPL-3.0-only
/**
 * requestSound10 — ask the sound driver to play sound-command 10.
 *
 * One of a fan of tiny sound-trigger stubs, each hard-wired to a single sound-command
 * index and sharing one enqueue tail. This one hands index 10 to the shared enqueue,
 * which marks it pending and files it in the next free slot of the 8-slot sound ring
 * for the driver to drain later; which real effect it selects is not identified.
 */
import { enqueueSoundCommand } from "./enqueueSoundCommand.js";

export function requestSound10(m) {
  // Queue sound command 10; the shared enqueue sets the pending bit and files the slot.
  enqueueSoundCommand(m, 10);
}
