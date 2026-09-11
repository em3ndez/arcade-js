// SPDX-License-Identifier: GPL-3.0-only
import { u8, u16 } from "../../../core/int.js";
import { loc_c098 } from "./loc_c098.js";
import {
  loc_37, loc_38, loc_56, loc_57, loc_58, loc_59,
  loc_61, loc_62, loc_63, loc_64,
  loc_31a, loc_32a, loc_33a, loc_34a, loc_3ce, loc_3de,
} from "./names.js";

// Sixteen passes: feed each column pair through the delta integrator, then clamp both
// signed results into [-4..+3] (0xfc..0x03), writing the value/sign arrays indexed by
// $38 and tallying every clamp in $59; hands back the clamp count.
export function loc_c473(m, a = m.regs.a, x = m.regs.x) {
  const { mem8 } = m;
  mem8[loc_57] = a;
  mem8[loc_38] = x;
  mem8[loc_59] = 0x00;
  mem8[loc_37] = 0x0f;

  for (;;) {
    const col = mem8[loc_37];
    mem8[loc_56] = mem8[u16(loc_3ce + col)];
    mem8[loc_58] = mem8[u16(loc_3de + col)];
    loc_c098(m);

    const out = mem8[loc_38];
    const [v1, s1, c1] = clamp(mem8[loc_62], mem8[loc_61]);
    if (c1) mem8[loc_59] = u8(mem8[loc_59] + 1);
    mem8[u16(loc_31a + out)] = v1;
    mem8[u16(loc_32a + out)] = s1;

    const [v2, s2, c2] = clamp(mem8[loc_64], mem8[loc_63]);
    if (c2) mem8[loc_59] = u8(mem8[loc_59] + 1);
    mem8[u16(loc_33a + out)] = v2;
    mem8[u16(loc_34a + out)] = s2;

    mem8[loc_38] = u8(mem8[loc_38] - 1);
    const next = u8(mem8[loc_37] - 1);
    mem8[loc_37] = next;
    if (next & 0x80) break;
  }

  return (m.regs.a = mem8[loc_59]);
}

// Saturate a signed value/sign pair to the [-4..+3] window, reporting whether it clamped.
function clamp(value, sign) {
  if (value & 0x80) {
    if (value < 0xfc) return [0xfc, 0x01, true];
  } else if (value >= 0x04) {
    return [0x03, 0xff, true];
  }
  return [value, sign, false];
}
