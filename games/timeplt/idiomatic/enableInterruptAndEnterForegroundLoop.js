// SPDX-License-Identifier: GPL-3.0-only

import { loc_c200, loc_c300 } from "./names.js";

const WRITE_BUS_OFFSET_OF_A_FIXED_ADDRESS_STORE = 10;
const FOREGROUND_LOOP = 0x0b93;

export function* enableInterruptAndEnterForegroundLoop(m, value = m.regs.a) {
  m.mem.write8(loc_c300, value, WRITE_BUS_OFFSET_OF_A_FIXED_ADDRESS_STORE);
  m.mem.write8(loc_c200, value, WRITE_BUS_OFFSET_OF_A_FIXED_ADDRESS_STORE);
  return yield* m.call(FOREGROUND_LOOP);
}
