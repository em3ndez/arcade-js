// SPDX-License-Identifier: GPL-3.0-only
/** seatTheStackAndSettleTheControlLatch — power-on, the first code that decides anything. It probes the
 * expansion socket: an empty socket floats the bus high, never a fitted board's answer, so the question
 * always returns "no" and the rest runs; a "yes" would hand control to the expansion. Then it seats the
 * stack just under sprite memory (growing down through work RAM), quiets the watchdog, drives the control
 * lines low, and enables the picture. The latch takes data from the low bit and its line from the address,
 * TWO ADDRESSES TO A LINE, so the eight-address walk settles FOUR lines (each written twice) and the ninth
 * address is a fifth line, not a ninth; that last setting is read from the program image, not a literal, so
 * patching it can leave the machine dark. No work memory is touched. LIVE-OUT: stack seat, latched lines, accumulator. */

import { EXPANSION_SOCKET_PROBE, SPRITE_RAM_BASE, loc_c200, loc_c300, VIDEO_ENABLE_LATCH, DISPLAY_ON_VALUE, clearWorkRamAndSpriteBanksThenColdInit_ADDR } from "./names.js";

const EXPANSION_FITTED = 0x55;

const CONTROL_LINE_ADDRESSES = 8;

/** Where in the instruction the write bus cycle falls; a recorder of hardware writes wants it. */
const STORE_TO_A_FIXED_ADDRESS = 10;
const STORE_THROUGH_A_POINTER = 7;

export function seatTheStackAndSettleTheControlLatch(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(EXPANSION_SOCKET_PROBE);
  regs.cp(EXPANSION_FITTED);
  if (regs.fZ) {
    throw new Error(
      "the expansion socket answered, so this machine is being asked to run as an expanded one " +
        "and control belongs in the expansion from here. Nothing models that, and a socket with " +
        "nothing in it cannot give this answer.",
    );
  }

  regs.sp = SPRITE_RAM_BASE;
  mem.write8(loc_c200, regs.a, STORE_TO_A_FIXED_ADDRESS);
  for (let i = 0; i < CONTROL_LINE_ADDRESSES; i++) {
    mem.write8(loc_c300 + i, 0, STORE_THROUGH_A_POINTER);
  }

  regs.a = mem.read8(DISPLAY_ON_VALUE);
  mem.write8(VIDEO_ENABLE_LATCH, regs.a, STORE_TO_A_FIXED_ADDRESS);

  return m.call(clearWorkRamAndSpriteBanksThenColdInit_ADDR);
}
