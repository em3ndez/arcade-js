// SPDX-License-Identifier: GPL-3.0-only
import { u8, u16 } from "../../../core/int.js";
import {
  DSW1_SNAPSHOT, SLOT_LOOP_INDEX, INPUT_DEBOUNCED, DSW_BONUS_CONFIG, DSW_DIFFICULTY, PLAYER_SEGMENT,
  EAROM_BLANK_FLAG, PENDING_WORK_FLAGS, EAROM_MODE,
  VEC_COORD1_LO, VEC_COORD1_HI, VEC_COORD2_LO, VEC_COORD2_HI,
  DIAG_MASK_TABLE, DIAG_VALUE_LO, DIAG_VALUE_HI,
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

  mem8[SLOT_LOOP_INDEX] = mem8[DSW_BONUS_CONFIG];
  loc_df53(m);
  loc_df75(m, 0xe8, 0xc0);
  do {
    loc_df39(m, 0x32, 0x6c);
    mem8[SLOT_LOOP_INDEX] = u8(mem8[SLOT_LOOP_INDEX] - 1);
  } while (mem8[SLOT_LOOP_INDEX] !== 0);

  const y = (mem8[DSW_DIFFICULTY] & 0x03) << 1;
  loc_df39(m, mem8[u16(VEC_COORD2_HI + y)], mem8[u16(VEC_COORD2_LO + y)]);

  const folded = loc_adce(m, mem8[PLAYER_SEGMENT]);
  mem8[PLAYER_SEGMENT] = folded;
  const sel = folded & 0x06;
  loc_df39(m, mem8[u16(VEC_COORD1_HI + sel)], mem8[u16(VEC_COORD1_LO + sel)]);

  let x = sel >> 1;
  const mask = mem8[u16(DIAG_MASK_TABLE + x)];
  const anded = mem8[INPUT_DEBOUNCED] & mask;      // AND then CMP the mask-table entry
  if (anded === mask) {                    // every mask bit present in the status cell
    x = u8(x - 2);
    if ((x & 0x80) === 0) {                // x-2 stayed non-negative
      if (x !== 0) {
        loc_dded(m);
        mem8[PENDING_WORK_FLAGS] = mem8[PENDING_WORK_FLAGS] | 0x03;
      } else {
        loc_dde9(m);                       // clv/bvc merge into the common tail
      }
    } else {
      // Slot-index underflow: the original takes a full RESET here. This is an error arm the draw loop's
      // bound keeps unreachable in normal play; if it ever trips it signals a genuine invariant break.
      throw new Error("loc_d804: draw slot-index underflow — a full RESET, unreachable in normal play");
    }
  }

  if ((mem8[EAROM_MODE] & mem8[EAROM_BLANK_FLAG]) !== 0) {
    loc_df39(m, 0x34, 0x6e);
  }
  loc_df53(m);

  const lo = (mem8[DSW1_SNAPSHOT] & 0x1c) >> 2;
  loc_d8a9(m, mem8[u16(DIAG_VALUE_LO + lo)], 0xee, 0x1b);

  const hi = mem8[DSW1_SNAPSHOT] >> 5;
  return loc_d8a9(m, mem8[u16(DIAG_VALUE_HI + hi)], 0x32, 0xf8);
}
