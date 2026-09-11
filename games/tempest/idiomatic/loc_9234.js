// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { loc_15a, loc_15b, loc_3ab, loc_3ac } from "./names.js";

// Seed a 17-byte parameter block: one header cell takes the first source byte,
// then a run of 16 body cells all take the second source byte.
export function loc_9234(m) {
  const { mem8 } = m;
  mem8[loc_3ab] = mem8[loc_15b];
  const fill = mem8[loc_15a];
  for (let x = 0x0f; x >= 0; x--) mem8[u16(loc_3ac + x)] = fill;
}
