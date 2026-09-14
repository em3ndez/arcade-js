// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { FRAME_COUNTER, loc_39, POKEY1_AUDF1, POKEY1_AUDC1, ATTRACT_SND_SLOTA, ATTRACT_SND_SLOTB, ATTRACT_SND_VALUE } from "./names.js";
import { emitCoordinateVectorWord } from "./emitCoordinateVectorWord.js";
import { loc_df6c } from "./loc_df6c.js";

// Advance a phase counter (skipped while the frame gate is set), pick a slot from three
// parallel tables to seed its two output cells, then emit three header words.
export function stepVectorPhaseAnimation(m) {
  const { mem8 } = m;
  if ((mem8[FRAME_COUNTER] & 0x3f) === 0) mem8[loc_39] = mem8[loc_39] + 1;
  const idx = mem8[loc_39] & 0x07;
  const slotA = mem8[u16(ATTRACT_SND_SLOTA + idx)];
  mem8[u16(POKEY1_AUDC1 + slotA)] = 0x00;
  const slotB = mem8[u16(ATTRACT_SND_SLOTB + idx)];
  mem8[u16(POKEY1_AUDF1 + slotB)] = mem8[u16(ATTRACT_SND_VALUE + idx)];
  mem8[u16(POKEY1_AUDC1 + slotB)] = 0xa8;
  emitCoordinateVectorWord(m, 0x34, 0x56);
  loc_df6c(m, 0x01, mem8[FRAME_COUNTER] & 0x7f);
  return emitCoordinateVectorWord(m, 0x34, 0xaa);
}
