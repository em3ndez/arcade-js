// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import {
  loc_2e, loc_2f, loc_30, loc_56, loc_57, loc_58, loc_59, loc_5a,
  loc_112, loc_2b9, loc_2cc, loc_3ce, loc_3de,
  loc_b687, loc_b68b, loc_bcdc, loc_bcec,
} from "./names.js";

// Signed-saturating add of a delta to a base value, both offset by a 0x80 bias.
function clampAdd(base, delta) {
  const a = base ^ 0x80;
  const res = (a + delta) & 0xff;
  const overflow = (~(a ^ delta) & (a ^ res) & 0x80) !== 0;
  let out = res;
  if (overflow) out = res & 0x80 ? 0x7f : 0x80;   // clamp toward the sign that overflowed
  return (out ^ 0x80) & 0xff;
}

// Build a screen point (x=$2e, y=$30) for slot x: fetch a base coord pair, offset each by a signed
// table delta with saturation, and load a paired style byte pair into $59/$5a.
export function loc_b634(m, x = m.regs.x) {
  const { mem8 } = m;
  mem8[loc_2f] = mem8[loc_57];
  const coordIdx = mem8[u16(loc_2b9 + x)];
  mem8[loc_56] = mem8[u16(loc_3ce + coordIdx)];
  mem8[loc_58] = mem8[u16(loc_3de + coordIdx)];
  const deltaIdx = mem8[u16(loc_2cc + x)] & 0x0f;
  mem8[loc_2e] = clampAdd(mem8[loc_56], mem8[u16(loc_b68b + deltaIdx)]);
  mem8[loc_30] = clampAdd(mem8[loc_58], mem8[u16(loc_b687 + deltaIdx)]);
  const styleIdx = mem8[loc_112];
  mem8[loc_59] = mem8[u16(loc_bcdc + styleIdx)];
  mem8[loc_5a] = mem8[u16(loc_bcec + styleIdx)];
}
