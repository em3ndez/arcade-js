// SPDX-License-Identifier: GPL-3.0-only
/**
 * requestSound21 — hand sound-command 21 to the shared sound-ring enqueue.
 *
 * The last of a family of tiny sound-trigger stubs, each hard-wired to one command
 * index. This one marks index 21 pending and drops it into the next free slot of the
 * eight-slot sound ring for the driver to pick up later. Which effect it selects is
 * not identified here — the name states the command requested, not the noise that plays.
 */
import { enqueueSoundCommand } from "./enqueueSoundCommand.js";

export function requestSound21(m) {
  // Queue sound command 21; the shared enqueue fills the ring slot and advances the pointer.
  enqueueSoundCommand(m, 21);
}
