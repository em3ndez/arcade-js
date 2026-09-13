// SPDX-License-Identifier: GPL-3.0-only
import { DSW2_SNAPSHOT, INPUT_SNAPSHOT_HI, DSW_DIFFICULTY, INPUT_SNAPSHOT_LO } from "./names.js";
import { loc_d6bb } from "./loc_d6bb.js";
import { loc_ac36 } from "./loc_ac36.js";
import { loc_ac3e } from "./loc_ac3e.js";

// Refresh the live control snapshot, then request a rebuild whenever it no longer
// matches the two cached target bytes.
export function loc_ac20(m) {
  const { mem8 } = m;
  loc_d6bb(m);
  const match =
    (mem8[DSW2_SNAPSHOT] & 0xf8) === mem8[INPUT_SNAPSHOT_HI] &&
    (mem8[DSW_DIFFICULTY] & 0x03) === mem8[INPUT_SNAPSHOT_LO];
  if (match) return loc_ac3e();
  return loc_ac36(m);
}
