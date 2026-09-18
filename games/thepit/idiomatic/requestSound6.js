// SPDX-License-Identifier: GPL-3.0-only
/**
 * requestSound6 — request sound-command 6 from the sound driver.
 *
 * One of a fan of ~20 tiny sound-trigger stubs, each hard-wired to a single sound-command
 * index. This one hands index 6 to the shared enqueue, which marks it pending and files it
 * in the next free ring slot for the driver to drain later. Which effect command 6 plays is
 * not identified here, so the name records the request, not the sound.
 */
import { enqueueSoundCommand } from "./enqueueSoundCommand.js";

export function requestSound6(m) {
  // Queue sound command 6; the shared enqueue sets the pending bit and files it in
  // the next ring slot, then returns straight to this stub's own caller.
  enqueueSoundCommand(m, 6);
}
