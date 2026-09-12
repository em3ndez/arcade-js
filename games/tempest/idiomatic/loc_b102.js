// SPDX-License-Identifier: GPL-3.0-only
import { loc_b15a } from "./loc_b15a.js";
import { loc_14e, loc_14d, loc_1 } from "./names.js";

// Rebuild the paired cursors, then clamp them: wrap the far cursor upward, and
// once it clears a floor, step the near cursor and pin it at the ceiling.
export function loc_b102(m) {
  const { mem8 } = m;
  loc_b15a(m, 0x34, 0xaa);
  let far = mem8[loc_14e];
  if (far < 0xa0) {
    far = (far + 0x14) & 0xff;
    mem8[loc_14e] = far;
  }
  if (far < 0x50) return;
  const near = (mem8[loc_14d] + 0x08) & 0xff;
  mem8[loc_14d] = near;
  if (near < far) return;
  mem8[loc_14d] = 0xa0;
  mem8[loc_1] = 0x14;
}
