// SPDX-License-Identifier: GPL-3.0-only

/**
 * readStartingShips — read the starting-lives dip-switch setting.
 *
 * WHAT IT IS
 *   Reads hardware input port 2, keeps its low two bits, and biases the result up by three, yielding a
 *   3..6 selector — the number of ships a game starts with, taken straight off the "ships" dip switch.
 *   (Port 2 on the Space Invaders board carries the ships dip in its low two bits.)
 *
 * ROLE IN THE MACHINE
 *   A tiny setup helper pulled in when a game or round is being armed (startGameFlow, runAttractCycle):
 *   the value it returns seeds the reserve-ship count. It reads hardware IO only and leaves the result
 *   in A.
 *
 * ROM 0x08d1.  Grounding: [seen].
 *
 * LIVE-OUT: A = (port2 & 3) + 3, a value in 3..6 (also the routine's return value).
 */
export function readStartingShips(m) {
  // Sample port 2, mask to its low two bits (0..3), and add 3 to land in the 3..6 starting-lives range.
  return (m.regs.a = (m.io.portIn(0x02) & 0x03) + 0x03);
}
