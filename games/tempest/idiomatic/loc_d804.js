// SPDX-License-Identifier: GPL-3.0-only
import { u8, u16 } from "../../../core/int.js";
import {
  loc_9, loc_37, loc_4d, loc_158, loc_16a, loc_200,
  loc_1c6, loc_1c9, loc_1ca,
  loc_3f16, loc_3f17, loc_3f1e, loc_3f1f,
  loc_d8b6, loc_d8ba, loc_d8c2,
} from "./names.js";
import { loc_d6bb } from "./loc_d6bb.js";
import { loc_aaa8 } from "./loc_aaa8.js";
import { loc_dd0d } from "./loc_dd0d.js";
import { loc_dd41 } from "./loc_dd41.js";
import { loc_df53 } from "./loc_df53.js";
import { loc_df75 } from "./loc_df75.js";
import { loc_df39 } from "./loc_df39.js";
import { loc_adce } from "./loc_adce.js";
import { loc_dde9 } from "./loc_dde9.js";
import { loc_dded } from "./loc_dded.js";
import { loc_d8a9 } from "./loc_d8a9.js";

// Assemble the frame's vector item list: four setup passes, a header pair, a marker
// emitted a counted number of times, then a run of table-indexed coordinate records selected by a few
// state cells. All records land in vector RAM.
export function loc_d804(m) {
  const { mem8 } = m;
  loc_d6bb(m);
  loc_aaa8(m);
  loc_dd0d(m);
  loc_dd41(m);

  mem8[loc_37] = mem8[loc_158];
  loc_df53(m);
  loc_df75(m, 0xe8, 0xc0);
  do {
    loc_df39(m, 0x32, 0x6c);
    mem8[loc_37] = u8(mem8[loc_37] - 1);
  } while (mem8[loc_37] !== 0);

  const y = (mem8[loc_16a] & 0x03) << 1;
  loc_df39(m, mem8[u16(loc_3f1f + y)], mem8[u16(loc_3f1e + y)]);

  const folded = loc_adce(m, mem8[loc_200]);
  mem8[loc_200] = folded;
  const sel = folded & 0x06;
  loc_df39(m, mem8[u16(loc_3f17 + sel)], mem8[u16(loc_3f16 + sel)]);

  let x = sel >> 1;
  const mask = mem8[u16(loc_d8b6 + x)];
  const anded = mem8[loc_4d] & mask;      // AND then CMP the mask-table entry
  if (anded === mask) {                    // every mask bit present in the status cell
    x = u8(x - 2);
    if ((x & 0x80) === 0) {                // x-2 stayed non-negative
      if (x !== 0) {
        loc_dded(m);
        mem8[loc_1c9] = mem8[loc_1c9] | 0x03;
      } else {
        loc_dde9(m);                       // clv/bvc merge into the common tail
      }
    } else {
      // Slot-index underflow: the original takes a full RESET here. This is an error arm the draw loop's
      // bound keeps unreachable in normal play; if it ever trips it signals a genuine invariant break.
      throw new Error("loc_d804: draw slot-index underflow — a full RESET, unreachable in normal play");
    }
  }

  if ((mem8[loc_1ca] & mem8[loc_1c6]) !== 0) {
    loc_df39(m, 0x34, 0x6e);
  }
  loc_df53(m);

  const lo = (mem8[loc_9] & 0x1c) >> 2;
  loc_d8a9(m, mem8[u16(loc_d8ba + lo)], 0xee, 0x1b);

  const hi = mem8[loc_9] >> 5;
  return loc_d8a9(m, mem8[u16(loc_d8c2 + hi)], 0x32, 0xf8);
}
