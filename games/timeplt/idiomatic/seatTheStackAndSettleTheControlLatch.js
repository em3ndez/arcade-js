// SPDX-License-Identifier: GPL-3.0-only
/** seatTheStackAndSettleTheControlLatch — power-on, and the first code the machine runs that decides anything.
 *
 * It asks the expansion socket whether a board is fitted. An empty socket floats the bus high,
 * which is not the answer a fitted board gives, so on this machine the question always comes back
 * "no" and the rest below always runs; answered "yes", control would belong in the expansion and
 * none of it would happen. Then: seat the stack just under sprite memory so it grows down through work RAM, quiet the watchdog,
 * drive every control line the latch carries low, and set the one that lets the picture out. The
 * latch takes its data from the low bit written and its line number from the address, TWO
 * ADDRESSES TO A LINE, so the walk of eight settles four lines, each written twice, and the ninth
 * address is a fifth line and not a ninth. That last setting is read out of the program image
 * rather than written as a literal, so patching the image can leave the machine dark. Nothing here
 * touches work memory: the whole effect is the seated stack and the latched lines. It leaves by a
 * jump, and the cursor and counter its walk leaves behind are not reproduced — the continuation
 * seats both before reading either. LIVE-OUT: the stack seat, the latched lines, the accumulator. */

const EXPANSION_SOCKET = 0x6000;
const EXPANSION_FITTED = 0x55;

const STACK_SEAT = 0xb000;
const WATCHDOG = 0xc200;

const CONTROL_LINES = 0xc300;
const CONTROL_LINE_ADDRESSES = 8;
const PICTURE_ENABLE = 0xc308;
const PICTURE_ENABLE_SETTING = 0x2d4b;

/** Where in the instruction the write bus cycle falls; a recorder of hardware writes wants it. */
const STORE_TO_A_FIXED_ADDRESS = 10;
const STORE_THROUGH_A_POINTER = 7;

const CONTINUATION = 0x0069;

export function seatTheStackAndSettleTheControlLatch(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(EXPANSION_SOCKET);
  regs.cp(EXPANSION_FITTED);
  if (regs.fZ) {
    throw new Error(
      "the expansion socket answered, so this machine is being asked to run as an expanded one " +
        "and control belongs in the expansion from here. Nothing models that, and a socket with " +
        "nothing in it cannot give this answer.",
    );
  }

  regs.sp = STACK_SEAT;
  mem.write8(WATCHDOG, regs.a, STORE_TO_A_FIXED_ADDRESS);
  for (let i = 0; i < CONTROL_LINE_ADDRESSES; i++) {
    mem.write8(CONTROL_LINES + i, 0, STORE_THROUGH_A_POINTER);
  }

  regs.a = mem.read8(PICTURE_ENABLE_SETTING);
  mem.write8(PICTURE_ENABLE, regs.a, STORE_TO_A_FIXED_ADDRESS);

  return m.call(CONTINUATION);
}
