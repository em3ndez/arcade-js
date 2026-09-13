// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import {
  EAROM_DATA, MATHBOX_STATUS, EAROM_READ, MATHBOX_RESULT_LO, MATHBOX_RESULT_HI, MATHBOX_LD_R0_LO,
  POKEY1_AUDF1, POKEY2_AUDF1, LED_FLIP_LATCH,
} from "./names.js";
import { loc_df39 } from "./loc_df39.js";

// Reset a bank of hardware registers, take four settling reads, then march a single set
// bit across a 32-slot table before emitting one framing record.
export function loc_db22(m) {
  const { mem8 } = m;

  mem8[LED_FLIP_LATCH] = 0x00;
  mem8[MATHBOX_LD_R0_LO] = 0x00;
  mem8[POKEY1_AUDF1] = 0x00;
  mem8[POKEY2_AUDF1] = 0x00;
  mem8[EAROM_DATA] = 0x00;
  mem8[MATHBOX_STATUS] = 0x00;

  void mem8[MATHBOX_STATUS];
  void mem8[MATHBOX_RESULT_LO];
  void mem8[MATHBOX_RESULT_HI];
  void mem8[EAROM_READ];

  mem8[LED_FLIP_LATCH] = 0x08;

  let bit = 0x01;
  let carry = 0;
  for (let x = 0x1f; x >= 0; x--) {
    mem8[u16(MATHBOX_LD_R0_LO + x)] = bit;
    const nextCarry = (bit >> 7) & 1;
    bit = ((bit << 1) | carry) & 0xff;
    carry = nextCarry;
  }

  loc_df39(m, 0x34, 0xa6);
}
