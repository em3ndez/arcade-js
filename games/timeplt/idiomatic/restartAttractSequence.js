// SPDX-License-Identifier: GPL-3.0-only
/** restartAttractSequence — restart the outer sequence from a standing start.
 * The in-play flag, the inner step index and the active-player index are cleared, then the outer
 * phase is set from a byte of the program image rather than an immediate. A fold over three more
 * program bytes then writes the inner index a SECOND time: an address is stepped by one byte, its
 * low half combined with its high half and a constant taken off. On an unaltered image that fold
 * comes back to zero and the second write agrees with the first; on a moved image it does not, and
 * the sequence restarts at some other step. LIVE-OUT: memory only. */

import { u8 } from "../../../core/int.js";
import { PLAY_ACTIVE, SEQUENCE_PHASE, SEQUENCE_SUBSTEP, ACTIVE_PLAYER, ATTRACT_SEQUENCE_START_PHASE, loc_4901, loc_4902 } from "./names.js";
import { offsetAddress } from "./offsetAddress.js";

const FOLD_BIAS = 155;

export function restartAttractSequence(m) {
  const { regs, mem8, mem16 } = m;
  mem8[PLAY_ACTIVE] = 0;
  mem8[SEQUENCE_SUBSTEP] = 0;
  mem8[ACTIVE_PLAYER] = 0;
  mem8[SEQUENCE_PHASE] = mem8[ATTRACT_SEQUENCE_START_PHASE];

  regs.a = mem8[loc_4901];
  regs.hl = mem16[loc_4902];
  offsetAddress(m);
  mem8[SEQUENCE_SUBSTEP] = u8(regs.a ^ (regs.hl >> 8)) - FOLD_BIAS;
}
