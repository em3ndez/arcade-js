// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import {
  loc_6000, loc_6040, loc_6050, loc_6060, loc_6070, loc_6080,
  loc_60c0, loc_60d0, loc_60e0,
} from "./names.js";
import { loc_df39 } from "./loc_df39.js";

// Reset a bank of hardware registers, take four settling reads, then march a single set
// bit across a 32-slot table before emitting one framing record.
export function loc_db22(m) {
  const { mem8 } = m;

  mem8[loc_60e0] = 0x00;
  mem8[loc_6080] = 0x00;
  mem8[loc_60c0] = 0x00;
  mem8[loc_60d0] = 0x00;
  mem8[loc_6000] = 0x00;
  mem8[loc_6040] = 0x00;

  void mem8[loc_6040];
  void mem8[loc_6060];
  void mem8[loc_6070];
  void mem8[loc_6050];

  mem8[loc_60e0] = 0x08;

  let bit = 0x01;
  let carry = 0;
  for (let x = 0x1f; x >= 0; x--) {
    mem8[u16(loc_6080 + x)] = bit;
    const nextCarry = (bit >> 7) & 1;
    bit = ((bit << 1) | carry) & 0xff;
    carry = nextCarry;
  }

  loc_df39(m, 0x34, 0xa6);
}
