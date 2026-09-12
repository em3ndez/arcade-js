// SPDX-License-Identifier: GPL-3.0-only
import { u8, u16 } from "../../../core/int.js";
import { loc_263, loc_283, loc_2a3, loc_2c3, loc_2e3, loc_303, loc_323, loc_343, loc_363, loc_60ca, loc_60da } from "./names.js";
import { loc_a69b } from "./loc_a69b.js";
import { loc_ccc1 } from "./loc_ccc1.js";

// Spawn an enemy into slot x: mark its three state bytes active, fill three
// velocity/coordinate pairs from the RNG (forcing the middle step non-positive),
// then hand off to the sound cue.
export function loc_a65b(m, x = m.regs.x, y = m.regs.y) {
  const { mem8 } = m;
  mem8[u16(loc_263 + x)] = 0x80;
  mem8[u16(loc_283 + x)] = 0x80;
  mem8[u16(loc_2a3 + x)] = 0x80;

  const r0 = mem8[loc_60da];
  mem8[u16(loc_2c3 + x)] = r0;
  mem8[u16(loc_323 + x)] = loc_a69b(m, r0);

  const r1 = mem8[loc_60ca];
  mem8[u16(loc_2e3 + x)] = r1;
  let step = loc_a69b(m, r1);
  if ((step & 0x80) === 0) step = u8(-step); // keep already-negative, else negate
  mem8[u16(loc_343 + x)] = step;

  const r2 = mem8[loc_60ca];
  mem8[u16(loc_303 + x)] = r2;
  mem8[u16(loc_363 + x)] = loc_a69b(m, r2);

  loc_ccc1(m, x, y);
}
