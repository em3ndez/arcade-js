// SPDX-License-Identifier: GPL-3.0-only
import { requestEaromBlankWrite } from "./requestEaromBlankWrite.js";

/**
 * queueEaromRegionErase — queue a blanked (erase) EAROM write of the region on bit 0x04. ROM 0xdde9.
 *
 * Role in the machine: the EAROM is Tempest's non-volatile store for the high-score table and the
 * bookkeeping the cabinet keeps across power cycles. Writing it is deferred: routines don't touch the
 * chip directly, they raise request bits that a serial-shift service later drains. This entry is the
 * "erase" flavour — it asks for the single region flagged by bit 0x04 to be written back blanked (all
 * cells cleared) rather than with live data, the path used when a score record is being wiped.
 *
 * Behaviour: a one-line trampoline. It calls the shared blank-mode merge with the fixed region mask
 * 0x04. That callee forces the blank-flag cell 0x1c6 to 0xff (arming blank mode) and then ORs the 0x04
 * mask into the region-pending cell 0x1c7 and the direction cell 0x1c8, so the drain routine knows both
 * which region to touch and that it should be erased.
 *
 * Live-out: the EAROM blank-flag 0x1c6, region-pending 0x1c7, and direction 0x1c8 cells (all set via the
 * callee). It performs no I/O itself. Grounding: [code].
 */
export function queueEaromRegionErase(m) {
  // Fixed mask 0x04 selects the single region; the callee arms blank mode + ORs the mask into the queue.
  requestEaromBlankWrite(m, 0x04);
}
