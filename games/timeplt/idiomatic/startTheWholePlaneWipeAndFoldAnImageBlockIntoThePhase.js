// SPDX-License-Identifier: GPL-3.0-only
/** startTheWholePlaneWipeAndFoldAnImageBlockIntoThePhase — run one setup-and-guard entry, seat the inner sequence index at a fixed step, then fold a
 * block of the program image into the outer phase. Neither number lands as an immediate: the index is READ
 * from a program byte that is the low half of an address inside an instruction, so moving that instruction
 * moves the index, and the phase is not assigned at all — a 256-byte block is subtracted from whatever it
 * already holds and a fixed key exclusive-ored into the difference. That leaves some phases standing and
 * moves others, so it is a tamper test that CORRUPTS the sequence rather than refusing to run. LIVE-OUT: memory. */

import { u8, u16 } from "../../../core/int.js";
import { armWholePlaneWipeThenDerailOnATamperedImage } from "./armWholePlaneWipeThenDerailOnATamperedImage.js";
import { SEQUENCE_PHASE, SEQUENCE_SUBSTEP, loc_1749, loc_5648 } from "./names.js";

const FOLD_BYTES = 256;
const FOLD_KEY = 0x4e;

export function startTheWholePlaneWipeAndFoldAnImageBlockIntoThePhase(m) {
  const { mem8 } = m;
  armWholePlaneWipeThenDerailOnATamperedImage(m);

  mem8[SEQUENCE_SUBSTEP] = mem8[loc_1749];

  let folded = mem8[SEQUENCE_PHASE];
  for (let i = 0; i < FOLD_BYTES; i++) folded = u8(folded - mem8[u16(loc_5648 + i)]);
  mem8[SEQUENCE_PHASE] = folded ^ FOLD_KEY;
}
