// SPDX-License-Identifier: GPL-3.0-only
/** enableInterruptAndEnterForegroundLoop — hand the machine over to its foreground loop: drive the interrupt-enable bit of the
 * output latch from the value the caller carries, of which only the low bit reaches the latch;
 * pet the watchdog, whose data the hardware ignores; then fall into the loop, which never comes
 * back. Neither store reaches work RAM. LIVE-OUT: the latch bit, the watchdog, then the loop's. */

const WRITE_BUS_OFFSET_OF_A_FIXED_ADDRESS_STORE = 10;
const INTERRUPT_ENABLE_LATCH = 0xc300;
const WATCHDOG = 0xc200;
const FOREGROUND_LOOP = 0x0b93;

export function enableInterruptAndEnterForegroundLoop(m, value = m.regs.a) {
  m.mem.write8(INTERRUPT_ENABLE_LATCH, value, WRITE_BUS_OFFSET_OF_A_FIXED_ADDRESS_STORE);
  m.mem.write8(WATCHDOG, value, WRITE_BUS_OFFSET_OF_A_FIXED_ADDRESS_STORE);
  return m.call(FOREGROUND_LOOP);
}
