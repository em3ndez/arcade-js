// SPDX-License-Identifier: GPL-3.0-only

const WRITE_BUS_OFFSET_OF_A_FIXED_ADDRESS_STORE = 10;
const INTERRUPT_ENABLE_LATCH = 0xc300;
const WATCHDOG = 0xc200;
const FOREGROUND_LOOP = 0x0b93;

export function* enableInterruptAndEnterForegroundLoop(m, value = m.regs.a) {
  m.mem.write8(INTERRUPT_ENABLE_LATCH, value, WRITE_BUS_OFFSET_OF_A_FIXED_ADDRESS_STORE);
  m.mem.write8(WATCHDOG, value, WRITE_BUS_OFFSET_OF_A_FIXED_ADDRESS_STORE);
  return yield* m.call(FOREGROUND_LOOP);
}
