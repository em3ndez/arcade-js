// SPDX-License-Identifier: GPL-3.0-only
/**
 * boardBitGate — select bit (board - 1) of the caller's per-board mask (A) and report it:
 * set = gate open (true, caller proceeds), clear = gate closed (false, caller skips).
 *
 * LIVE-OUT: the boolean. Writes no memory.
 */
import { BOARD } from "./names.js";

export function boardBitGate(m) {
  const { regs, mem8 } = m;

  const count = mem8[BOARD] || 256; // board 0 -> 256 rotations, same as selecting bit 7
  const boardBit = (regs.a >> ((count - 1) & 7)) & 1;
  return boardBit === 1;
}
