// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_27cb — arm a four-cell block with the caller's lead byte plus a fixed tail.
 * LIVE-OUT: memory-only.
 */
import { loc_8040, loc_8340 } from "./names.js";

const TAIL = [25, 3, 16];
const ARM_VALUE = 160;

export function loc_27cb(m, leadByte = m.regs.b) {
  const { mem8 } = m;
  mem8[loc_8040] = leadByte;
  mem8[(loc_8040 + 1) & 0xffff] = TAIL[0];
  mem8[(loc_8040 + 2) & 0xffff] = TAIL[1];
  mem8[(loc_8040 + 3) & 0xffff] = TAIL[2];
  mem8[loc_8340] = ARM_VALUE;
}
