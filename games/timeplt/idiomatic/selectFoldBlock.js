// SPDX-License-Identifier: GPL-3.0-only
/** selectFoldBlock — name a block of the program image: where it starts, and how many bytes of it to
 * take. Both are constants chosen here, so the whole content of this entry is WHICH block, and
 * whatever a caller held in the two registers that carry them is discarded. LIVE-OUT: the pair. */

import { seatCaptionPenFromEraFoldingTamperIntoPhase_ADDR } from "./names.js";

const BLOCK_BYTES = 30;

export function selectFoldBlock(m) {
  // both are register-dispatched live-outs the frozen translated caller reads straight back.
  return [m.regs.hl = seatCaptionPenFromEraFoldingTamperIntoPhase_ADDR, m.regs.b = BLOCK_BYTES];
}
