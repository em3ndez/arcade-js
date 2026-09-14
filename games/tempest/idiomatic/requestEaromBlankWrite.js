// SPDX-License-Identifier: GPL-3.0-only
import { queueEaromRequest } from "./queueEaromRegionSave.js";

/**
 * requestEaromBlankWrite — queue a blanked EAROM write of the masked regions. ROM 0xddf3.
 *
 * Role in the machine: the EAROM holds Tempest's persistent high-score / bookkeeping data.
 * This entry forces the EAROM index byte to 0xff — the "blank" sentinel — then hands off to
 * the shared request builder queueEaromRequest (0xddf1 body) so the caller's region mask is
 * merged in. The result is a request that blanks (rather than writes real data into) the
 * regions the mask selects.
 *
 * Behavior: pass the live-in accumulator A (the caller's region mask) and the constant 0xff
 * index into the shared mask-merge. Live-out: the pending EAROM request cells the shared
 * builder updates (index forced to 0xff, mask merged). Grounding: [seen].
 */
export function requestEaromBlankWrite(m, a = m.regs.a) {
  // A = caller's region mask; 0xff = blank-mode index sentinel.
  queueEaromRequest(m, a, 0xff);
}
