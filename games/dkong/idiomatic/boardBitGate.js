// SPDX-License-Identifier: GPL-3.0-only
/**
 * boardBitGate — the game's compact "does THIS board want this?" test.
 *
 * The caller supplies a per-board applicability mask in a register: one bit per board, bit 0 for
 * 25m through bit 3 for 100m. This routine picks out the bit belonging to the board currently being
 * played and reports it.
 *
 *   - It reads the board number, 1 to 4, and selects bit (board - 1) of the mask.
 *   - Set   -> the gate is OPEN and the caller carries on. This returns true.
 *   - Clear -> the gate is CLOSED and the caller's NEXT action is skipped. This returns false, and
 *              every caller spells that as an early return.
 *
 * Selecting the bit is a rotate rather than a shift, so a board number of 0 would rotate a full 256
 * turns and land on bit 7. Boards are 1 to 4 in play.
 *
 * The skip is the routine's whole point, and here it IS the boolean: nothing is written, nothing is
 * left in a register a caller reads. A near-pure leaf.
 *
 * LIVE-OUT: the boolean. It writes no memory.
 */
import { BOARD } from "./names.js";

export function boardBitGate(m) {
  const { regs, mem } = m;

  // The board being played, 1..4. A 0 means a full 256 rotations, the same as selecting bit 7.
  const count = mem.read8(BOARD) || 256;

  // Rotating that many times leaves bit ((count - 1) mod 8) of the mask under the test — bit
  // (board - 1) for a board in 1..8, which is this board's flag.
  const boardBit = (regs.a >> ((count - 1) & 7)) & 1;

  // Set -> gate open, the caller proceeds. Clear -> gate closed, the caller's next action is
  // skipped.
  return boardBit === 1;
}
