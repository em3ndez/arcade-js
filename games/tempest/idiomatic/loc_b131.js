// SPDX-License-Identifier: GPL-3.0-only
import { loc_b15a } from "./loc_b15a.js";
import { loc_14d, loc_14e } from "./names.js";

// Rebuild the paired cursors, then squeeze them together: decrement the near
// cursor while above a floor (bail if it wraps high), and pull the far cursor
// down by one but never below the near cursor.
export function loc_b131(m) {
  const { mem8 } = m;
  loc_b15a(m, 0x3f, 0x4e);
  let near = mem8[loc_14d];
  if (near >= 0x30) {
    near = (near - 1) & 0xff;
    mem8[loc_14d] = near;
  }
  if (near >= 0x80) return;
  const stepped = (mem8[loc_14e] - 1) & 0xff;
  mem8[loc_14e] = stepped >= near ? stepped : near;
}
