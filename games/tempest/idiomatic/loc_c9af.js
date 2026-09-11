// SPDX-License-Identifier: GPL-3.0-only
import { u8 } from "../../../core/int.js";
import { loc_0, loc_1, loc_2, loc_4, loc_3d, loc_3e, loc_3f, loc_46, loc_48, loc_49 } from "./names.js";
import { loc_c9f1 } from "./loc_c9f1.js";

// Tick the active slot's countdown; when both gate bytes are spent, finalize.
// Otherwise pick the next non-empty slot via the toggle and arm its timers.
export function loc_c9af(m) {
  const { mem8 } = m;
  mem8[loc_4] = 0;
  let x = mem8[loc_3d];
  const cur = u8(loc_48 + x);
  mem8[cur] = mem8[cur] - 1;
  if ((mem8[loc_48] | mem8[loc_49]) === 0) {
    loc_c9f1(m);
    return;
  }
  x = mem8[loc_3d];
  if (mem8[u8(loc_48 + x)] === 0) {
    mem8[loc_1] = 0x0c;
    mem8[loc_4] = 0x28;
  }
  for (;;) {
    if (mem8[loc_3e] !== 0) mem8[loc_3f] ^= 0x01;
    x = mem8[loc_3f];
    if (mem8[u8(loc_48 + x)] !== 0) break;
  }
  const y = u8(mem8[u8(loc_46 + x)] + 1);
  mem8[loc_2] = y === 0 ? 0x1c : 0x02;
  mem8[loc_0] = 0x0a;
}
