// SPDX-License-Identifier: GPL-3.0-only
/**
 * requestSound5 — ask the sound driver to play sound-command 5.
 *
 * One of a fan of tiny sound-trigger stubs, each hard-wired to a single sound-command
 * index. This one hands index 5 to the shared sound-ring enqueue, which drops it into
 * the next free ring slot (marked pending) for the driver to pick up later. The index
 * is the stub's whole payload; which real effect command 5 selects is not identified,
 * so the name states the command requested, not the noise that plays.
 */
import { enqueueSoundCommand } from "./enqueueSoundCommand.js";

export function requestSound5(m) {
  // Queue sound command 5; the shared enqueue fills the ring slot and advances the pointer.
  enqueueSoundCommand(m, 5);
}
