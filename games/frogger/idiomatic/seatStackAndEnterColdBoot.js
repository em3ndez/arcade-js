// SPDX-License-Identifier: GPL-3.0-only
/**
 * seatStackAndEnterColdBoot — the reset vector. A dead self-check arm reads the unmapped self-check
 * source (it floats high, never the value its jump would need), the watchdog is kicked, the stack is
 * seated at the top of work RAM, then the routine tail-calls the cold-boot init. It writes no RAM of
 * its own; the observable work is the cold-boot init reached through the tail. LIVE-OUT: memory via the tail.
 */
const SELF_CHECK_ARM = 0x4000;
const WATCHDOG = 0x8800;
const STACK_TOP = 0x8800;
const COLD_BOOT_INIT = 0x02a3;

export function seatStackAndEnterColdBoot(m) {
  if (m.mem8[SELF_CHECK_ARM] === 0x55) {
    throw new Error("seatStackAndEnterColdBoot: self-check jump armed -- 0x4000 read 0x55 (must float 0xFF)");
  }
  m.mem.read8(WATCHDOG);
  m.regs.sp = STACK_TOP;
  return m.call(COLD_BOOT_INIT);
}
