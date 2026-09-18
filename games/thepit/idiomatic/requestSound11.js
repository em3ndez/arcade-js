// SPDX-License-Identifier: GPL-3.0-only
/**
 * requestSound11 — request sound-command 11 from the sound driver.
 *
 * One of a fan of ~20 tiny sound-trigger stubs, each hard-wired to a single sound-command
 * index and sharing one enqueue tail. This one hands index 11 to the shared enqueue, which
 * marks it pending and files it in the next free ring slot for the driver to drain later.
 * Which effect command 11 selects is not identified here, so the name states the request.
 */
import { enqueueSoundCommand } from "./enqueueSoundCommand.js";

export function requestSound11(m) {
  // Queue sound command 11; the shared enqueue sets the pending bit and files it in
  // the next ring slot.
  enqueueSoundCommand(m, 11);
}
