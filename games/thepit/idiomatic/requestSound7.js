// SPDX-License-Identifier: GPL-3.0-only
/**
 * requestSound7 — request sound-command 7 from the sound driver.
 *
 * One of a fan of ~20 tiny sound-trigger stubs, each hard-wired to a single sound-command
 * index. This one hands index 7 to the shared enqueue, which marks it pending and files it
 * in the next free ring slot for the driver to drain later. Which effect command 7 selects
 * is not identified here, so the name records the command it requests, not the noise played.
 */
import { enqueueSoundCommand } from "./enqueueSoundCommand.js";

export function requestSound7(m) {
  // Queue sound command 7; the shared enqueue sets the pending bit and files it in
  // the next ring slot, wrapping the write pointer after the eighth slot.
  enqueueSoundCommand(m, 7);
}
