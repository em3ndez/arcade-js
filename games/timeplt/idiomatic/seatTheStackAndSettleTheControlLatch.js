// SPDX-License-Identifier: GPL-3.0-only
/** seatTheStackAndSettleTheControlLatch — power-on, the first code that decides anything. It probes the
 * expansion socket: an empty socket floats the bus high, never a fitted board's answer, so the question
 * always returns "no" and the rest runs; a "yes" would hand control to the expansion. Then it quiets the
 * watchdog, drives the control lines low, and enables the picture. The original also seats the stack just
 * under sprite memory here; this layer lays no return words (every routine is a direct call and the frame
 * interrupt fires as one), so nothing reads the stack pointer and the seat is not carried. The latch takes data from the low bit and its line from the address,
 * TWO ADDRESSES TO A LINE, so the eight-address walk settles FOUR lines (each written twice) and the ninth
 * address is a fifth line, not a ninth; that last setting is read from the program image, not a literal, so
 * patching it can leave the machine dark. No work memory is touched. LIVE-OUT: latched lines. */

import { clearWorkRamAndSpriteBanksThenColdInit } from "./clearWorkRamAndSpriteBanksThenColdInit.js";
import { EXPANSION_SOCKET_PROBE, WATCHDOG_RESET, NMI_ENABLE_LATCH, VIDEO_ENABLE_LATCH, DISPLAY_ON_VALUE } from "./names.js";

const EXPANSION_FITTED = 0x55;

const CONTROL_LINE_ADDRESSES = 8;

export function seatTheStackAndSettleTheControlLatch(m) {
  const { mem8 } = m;

  const socketAnswer = mem8[EXPANSION_SOCKET_PROBE];
  if (socketAnswer === EXPANSION_FITTED) {
    throw new Error(
      "the expansion socket answered, so this machine is being asked to run as an expanded one " +
        "and control belongs in the expansion from here. Nothing models that, and a socket with " +
        "nothing in it cannot give this answer.",
    );
  }

  mem8[WATCHDOG_RESET] = socketAnswer;
  for (let i = 0; i < CONTROL_LINE_ADDRESSES; i++) mem8[NMI_ENABLE_LATCH + i] = 0;
  mem8[VIDEO_ENABLE_LATCH] = mem8[DISPLAY_ON_VALUE];

  return clearWorkRamAndSpriteBanksThenColdInit(m);
}
