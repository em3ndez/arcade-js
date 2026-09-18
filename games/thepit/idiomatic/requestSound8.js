// SPDX-License-Identifier: GPL-3.0-only
/**
 * requestSound8 — hand sound-command 8 to the shared sound-ring enqueue.
 *
 * One of a family of tiny sound-trigger stubs, each hard-wired to one command index.
 * This one marks index 8 pending and drops it into the next free slot of the eight-
 * slot sound ring for the driver to pick up later. Which effect it selects is not
 * identified here — the name states the command requested, not the noise that plays.
 */
import { enqueueSoundCommand } from "./enqueueSoundCommand.js";

export function requestSound8(m) {
  // Queue command 8; the shared enqueue sets the pending bit and files it in the ring.
  enqueueSoundCommand(m, 8);
}
