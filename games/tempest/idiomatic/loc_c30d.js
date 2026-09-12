// SPDX-License-Identifier: GPL-3.0-only
import { loc_37, loc_57, loc_9e, loc_10f, loc_110, loc_113 } from "./names.js";
import { loc_c473 } from "./loc_c473.js";
import { loc_c453 } from "./loc_c453.js";
import { loc_c3ee } from "./loc_c3ee.js";
import { loc_c36e } from "./loc_c36e.js";
import { loc_df6a } from "./loc_df6a.js";
import { loc_df4c } from "./loc_df4c.js";

// First-time setup seeds two counters through the integrator (nudging the low one when
// it lags), always emits a header, and returns unless both counters are live; then it
// clears the record slots and draws each counter's record set.
export function loc_c30d(m) {
  const { mem8 } = m;
  if (mem8[loc_110] === 0) {
    mem8[loc_57] = 0xf0;
    const first = loc_c473(m, 0xf0, 0x4f);
    mem8[loc_110] = first;
    if (first !== 0) mem8[loc_10f] = first;
    if (mem8[loc_10f] === 0) {
      mem8[loc_57] = 0x10;
      loc_c453(m);
      mem8[loc_10f] = loc_c473(m, mem8[loc_57], 0x0f);
    }
  }
  loc_df6a(m, 0x01);
  mem8[loc_9e] = 0x06;
  if (mem8[loc_110] !== 0) return;
  if (mem8[loc_113] === 0) return;
  // Clear the record slots two indices per pass (the callee steps the index too).
  let slot = 0x0f;
  do {
    loc_c3ee(m, slot, 0xc0);
    slot = (mem8[loc_37] - 1) & 0xff;
  } while ((slot & 0x80) === 0);
  mem8[loc_9e] = 0x06;
  loc_df4c(m, 0x08, 0x06);
  loc_c36e(m, mem8[loc_110], 0x4f);
  return loc_c36e(m, mem8[loc_10f], 0x0f);
}
