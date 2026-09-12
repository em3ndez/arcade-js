// SPDX-License-Identifier: GPL-3.0-only
import { loc_9e, loc_202, loc_57, loc_2f, loc_201, loc_200, loc_51 } from "./names.js";
import { loc_bda0 } from "./loc_bda0.js";

// Flag a rebuild, then when the gate byte is in range latch it into two slots and,
// unless the marker byte holds the skip value, kick a spread build whose size comes
// from a shifted parameter.
export function loc_b586(m) {
  const { mem8 } = m;
  mem8[loc_9e] = 0x01;
  const gate = mem8[loc_202];
  if (gate === 0 || gate >= 0xf0) return;
  mem8[loc_57] = gate;
  mem8[loc_2f] = gate;
  if (mem8[loc_201] === 0x81) return;
  const y = mem8[loc_200];
  const size = (((mem8[loc_51] >> 1) & 0x07) + 1) & 0xff;
  loc_bda0(m, size, y);
}
