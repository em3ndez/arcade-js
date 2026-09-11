// SPDX-License-Identifier: GPL-3.0-only
import { u8, u16 } from "../../../core/int.js";
import {
  loc_c0, loc_d0, loc_720,
  loc_60c0, loc_60c8, loc_60ca, loc_60cf,
  loc_60d0, loc_60d8, loc_60da, loc_60df,
} from "./names.js";

// Clear two control cells and a flag, sample two counters across five polls and latch
// the flag with the first sample when either counter changes, then set the controls
// to 7 and zero the paired 8-entry arrays.
export function loc_cd95(m) {
  const { mem8 } = m;
  mem8[loc_60cf] = 0;
  mem8[loc_60df] = 0;
  mem8[loc_720] = 0;

  const a = mem8[loc_60ca];
  const y = mem8[loc_60da];
  for (let x = 4; x >= 0; x--) {
    if (a !== mem8[loc_60ca] || y !== mem8[loc_60da]) {
      mem8[loc_720] = a;
      break;
    }
  }

  mem8[loc_60cf] = 7;
  mem8[loc_60df] = 7;
  for (let x = 7; x >= 0; x--) {
    mem8[u16(loc_60c0 + x)] = 0;
    mem8[u16(loc_60d0 + x)] = 0;
    mem8[u8(loc_c0 + x)] = 0;
    mem8[u8(loc_d0 + x)] = 0;
  }
  mem8[loc_60c8] = 0;
  mem8[loc_60d8] = 0;
}
