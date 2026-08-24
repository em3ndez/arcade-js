// SPDX-License-Identifier: GPL-3.0-only
import { loc_0038 } from "./loc_0038.js";
/**
 * loc_5a97 — queue the score-drip display command.
 *
 * The fixed command word is passed through DE, the register the dispatcher reads it from.
 * LIVE-OUT: memory only — the display-command ring the rst-0x38 handler writes.
 */
const DISPLAY_CMD = 0x0701; // display-command word consumed by the rst-0x38 dispatcher

export function loc_5a97(m) {
  loc_0038(m, DISPLAY_CMD); // enqueue the display-command word via rst-0x38
}
