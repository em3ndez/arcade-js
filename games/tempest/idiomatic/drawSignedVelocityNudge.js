// SPDX-License-Identifier: GPL-3.0-only
import { u8 } from "../../../core/int.js";
import { POKEY2_RANDOM } from "./names.js";

// Signed random step: read a 3-bit random magnitude (0..7) and negate it when the
// caller's incoming value has bit 0 set, giving a signed nudge in [-7, +7].
export function drawSignedVelocityNudge(m, a = m.regs.a) {
  const { mem8 } = m;
  const negate = a & 0x01;
  let out = mem8[POKEY2_RANDOM] & 0x07;
  if (negate) out = u8(-out);
  return (m.regs.a = out);
}
