// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { loc_3, loc_39, loc_60c0, loc_60c1, loc_dbd5, loc_dbd6, loc_dfdc } from "./names.js";
import { loc_df39 } from "./loc_df39.js";
import { loc_df6c } from "./loc_df6c.js";

// Advance a phase counter (skipped while the frame gate is set), pick a slot from three
// parallel tables to seed its two output cells, then emit three header words.
export function loc_db9a(m) {
  const { mem8 } = m;
  if ((mem8[loc_3] & 0x3f) === 0) mem8[loc_39] = mem8[loc_39] + 1;
  const idx = mem8[loc_39] & 0x07;
  const slotA = mem8[u16(loc_dbd5 + idx)];
  mem8[u16(loc_60c1 + slotA)] = 0x00;
  const slotB = mem8[u16(loc_dbd6 + idx)];
  mem8[u16(loc_60c0 + slotB)] = mem8[u16(loc_dfdc + idx)];
  mem8[u16(loc_60c1 + slotB)] = 0xa8;
  loc_df39(m, 0x34, 0x56);
  loc_df6c(m, 0x01, mem8[loc_3] & 0x7f);
  return loc_df39(m, 0x34, 0xaa);
}
