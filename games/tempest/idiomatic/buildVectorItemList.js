// SPDX-License-Identifier: GPL-3.0-only
import { u8, u16 } from "../../../core/int.js";
import {
  DSW1_SNAPSHOT, SLOT_LOOP_INDEX, INPUT_DEBOUNCED, DSW_BONUS_CONFIG, DSW_DIFFICULTY, PLAYER_SEGMENT,
  EAROM_BLANK_FLAG, PENDING_WORK_FLAGS, EAROM_MODE,
  VEC_COORD1_LO, VEC_COORD1_HI, VEC_COORD2_LO, VEC_COORD2_HI,
  DIAG_MASK_TABLE, DIAG_VALUE_LO, DIAG_VALUE_HI,
} from "./names.js";
import { decodeOptionSwitches } from "./decodeOptionSwitches.js";
import { drawOverlayFrame } from "./drawOverlayFrame.js";
import { loc_dd0d } from "./loc_dd0d.js";
import { buildLargeDecimalNumber } from "./buildLargeDecimalNumber.js";
import { emitVectorHeaderWord } from "./emitVectorHeaderWord.js";
import { emitScaledCoordinateRecord } from "./emitScaledCoordinateRecord.js";
import { emitCoordinateVectorWord } from "./emitCoordinateVectorWord.js";
import { foldStepIntoFraction } from "./foldStepIntoFraction.js";
import { loc_dde9 } from "./loc_dde9.js";
import { loc_dded } from "./loc_dded.js";
import { loc_d8a9 } from "./loc_d8a9.js";

// Assemble the frame's vector item list: four setup passes, a header pair, a marker
// emitted a counted number of times, then a run of table-indexed coordinate records selected by a few
// state cells. All records land in vector RAM.
export function buildVectorItemList(m) {
  const { mem8 } = m;
  decodeOptionSwitches(m);
  drawOverlayFrame(m);
  loc_dd0d(m);
  buildLargeDecimalNumber(m);

  mem8[SLOT_LOOP_INDEX] = mem8[DSW_BONUS_CONFIG];
  emitVectorHeaderWord(m);
  emitScaledCoordinateRecord(m, 0xe8, 0xc0);
  do {
    emitCoordinateVectorWord(m, 0x32, 0x6c);
    mem8[SLOT_LOOP_INDEX] = u8(mem8[SLOT_LOOP_INDEX] - 1);
  } while (mem8[SLOT_LOOP_INDEX] !== 0);

  const y = (mem8[DSW_DIFFICULTY] & 0x03) << 1;
  emitCoordinateVectorWord(m, mem8[u16(VEC_COORD2_HI + y)], mem8[u16(VEC_COORD2_LO + y)]);

  const folded = foldStepIntoFraction(m, mem8[PLAYER_SEGMENT]);
  mem8[PLAYER_SEGMENT] = folded;
  const sel = folded & 0x06;
  emitCoordinateVectorWord(m, mem8[u16(VEC_COORD1_HI + sel)], mem8[u16(VEC_COORD1_LO + sel)]);

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
      throw new Error("buildVectorItemList: draw slot-index underflow — a full RESET, unreachable in normal play");
    }
  }

  if ((mem8[EAROM_MODE] & mem8[EAROM_BLANK_FLAG]) !== 0) {
    emitCoordinateVectorWord(m, 0x34, 0x6e);
  }
  emitVectorHeaderWord(m);

  const lo = (mem8[DSW1_SNAPSHOT] & 0x1c) >> 2;
  loc_d8a9(m, mem8[u16(DIAG_VALUE_LO + lo)], 0xee, 0x1b);

  const hi = mem8[DSW1_SNAPSHOT] >> 5;
  return loc_d8a9(m, mem8[u16(DIAG_VALUE_HI + hi)], 0x32, 0xf8);
}
