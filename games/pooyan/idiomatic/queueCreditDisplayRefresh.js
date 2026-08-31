// SPDX-License-Identifier: GPL-3.0-only
import { CREDIT_DISPLAY_COMMAND } from "./names.js";
import { enqueueDisplayCommand } from "./enqueueDisplayCommand.js";
/**
 * queueCreditDisplayRefresh — queue the credit-display refresh command.
 *
 * The fixed command word is passed through DE, the register the dispatcher reads it from.
 * LIVE-OUT: memory only — the display-command ring the rst-0x38 handler writes.
 */

export function queueCreditDisplayRefresh(m) {
  enqueueDisplayCommand(m, CREDIT_DISPLAY_COMMAND); // enqueue the display-command word via rst-0x38
}
