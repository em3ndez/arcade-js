// SPDX-License-Identifier: GPL-3.0-only
import { u8 } from "../../../core/int.js";
import { loc_ef, loc_f0, loc_40, loc_70, loc_60, loc_88, loc_ab, loc_80, loc_50, loc_b8, POKEY_RANDOM } from "./names.js";

/**
 * seedWaveState — round/wave-start initializer. Folds the two difficulty seed
 * bytes ($ef,$f0) into working cells $40/$70 via fixed XORs, rejection-samples the
 * RNG for a "large enough" random byte into $60, picks a small count (3 or 2) for
 * $80 from a per-index table, and clears $50 and $b8.  [code]
 */
export function seedWaveState(m) {
  const { mem8 } = m;

  // Fold the two difficulty/seed params into $40/$70 via fixed XOR constants.
  mem8[loc_40] = 0x1c ^ mem8[loc_ef];
  mem8[loc_70] = 0xf8 ^ mem8[loc_f0];

  // Keep bits 7-3 of the RNG and require >= 0x10; store that value minus 4.
  let masked;
  do {
    masked = m.mem8[POKEY_RANDOM] & 0xf8;
  } while (masked < 0x10);
  mem8[loc_60] = masked - 4; // masked is in [0x10,0xf8], so masked-4 is a valid byte

  // $80 := 3 when the per-index byte $ab[$88] >= 6, else 2.
  const sel = mem8[u8(loc_ab + mem8[loc_88])];
  mem8[loc_80] = sel >= 0x06 ? 0x03 : 0x02;

  // Clear the two remaining state cells.
  mem8[loc_50] = 0x00;
  mem8[loc_b8] = 0x00;
}
