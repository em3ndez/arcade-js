// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { loc_dbe0 } from "./loc_dbe0.js";
import {
  DSW2_SNAPSHOT, DSW1_SNAPSHOT, loc_ac, loc_ad, BONUS_LIFE_INTERVAL, DSW_BONUS_CONFIG, DSW_DIFFICULTY,
  DSW1_COINAGE, DSW2_OPTIONS, DIP_CONFIG_A, DIP_CONFIG_B, DIP_BONUS_INTERVAL, DIP_PARAM_158,
} from "./names.js";

// Slice one input byte into three table lookups plus a toggled copy of a second
// byte, then fold the final pair through the merge and record its result.
export function loc_d6bb(m) {
  const { mem8 } = m;
  const a0 = mem8[DSW2_OPTIONS];
  mem8[DSW2_SNAPSHOT] = a0;
  mem8[BONUS_LIFE_INTERVAL] = mem8[u16(DIP_BONUS_INTERVAL + ((a0 >> 3) & 0x07))];
  mem8[DSW1_SNAPSHOT] = mem8[DSW1_COINAGE] ^ 0x02;
  mem8[DSW_BONUS_CONFIG] = mem8[u16(DIP_PARAM_158 + ((a0 >> 6) & 0x03))];
  const y = a0 & 0x06;
  mem8[loc_ac] = mem8[u16(DIP_CONFIG_A + y)];
  const ad = mem8[u16(DIP_CONFIG_B + y)];
  mem8[loc_ad] = ad;
  mem8[DSW_DIFFICULTY] = loc_dbe0(m, ad);
}
