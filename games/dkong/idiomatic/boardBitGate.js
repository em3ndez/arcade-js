// SPDX-License-Identifier: GPL-3.0-only
/**
 * boardBitGate — the `rst 0x30` vector: a per-board skip gate.  ROM 0x0030.
 *
 * `rst 0x30` (a single 0xF7 opcode) is Donkey Kong's compact "does THIS board want
 * this?" test. The byte in A is a per-board applicability mask — one bit per board
 * (bit0 = 25m, bit1 = 50m, bit2 = 75m, bit3 = 100m) — and this routine selects the
 * bit belonging to the current board and reports it:
 *
 *   - It reads BOARD (1..4) and rotates A right that many times (`rrca` × BOARD).
 *     `rrca` walked B times lands A's bit ((B-1) mod 8) in the carry, so with BOARD
 *     in 1..4 the carry ends up holding bit (BOARD-1) of A — the current board's
 *     mask bit. (BOARD == 0 rotates a full 256 turns via the oracle's `djnz`
 *     underflow, leaving bit 7 in the carry; boards are 1..4 in play.)
 *   - Carry SET  -> the gate is OPEN: the oracle returns normally (this fn -> true)
 *                   and the caller proceeds.
 *   - Carry CLEAR -> the gate is CLOSED: the oracle drops the caller's return
 *                   address (`pop hl` / `ret`) so the caller's next action is
 *                   skipped. Every caller spells that `if (!m.call(0x0030)) return;`;
 *                   this fn returns false.
 *
 * The Z80 stack manipulation that performs the skip (the `pop hl` on the closed arm)
 * IS the caller-skip idiom the idiomatic layer models as a BOOLEAN return (Z80 stack
 * -> JS call stack), so this routine touches no memory and mutates no register a
 * caller reads: the single boolean is its whole contract. A near-pure leaf — it
 * reads A and (BOARD), writes nothing, and calls nothing.
 *
 * Memory-equivalent to the frozen oracle — equivalence-0030.test.js.
 * GATE:     exhaustive — pure total function of (A, BOARD): boolean == oracle over
 *           all 65,536 (A, BOARD) combos, plus real 25m attract dispatches and
 *           crafted boards 2/3/4/0 on genuine captured state. Reached from 20 sites.
 * LIVE-OUT: memory-only (writes nothing) — the boolean skip-flag return is the sole
 *           live value. A (rotated), B (0), HL, and the carry flag are all
 *           overwritten or never read by every one of the 20 callers (verified: each
 *           either reloads A immediately, sets HL/B/IY, or chains rst 0x10 which
 *           itself reloads A from 0x6200), so they are dead; SP/PC are the stack
 *           idiom the boolean replaces and are never compared for this routine.
 * NAMES:    BOARD (0x6227) from ram.js — the rotate count / current board index.
 */
import { BOARD } from "../optimized/ram.js";

export function boardBitGate(m) {
  const { regs, mem } = m;

  // Rotate count = the current board (1..4). A 0 there means a full 256 turns via
  // the oracle's `djnz` underflow — the same carry as selecting bit 7.
  const count = mem.read8(BOARD) || 256;

  // `rrca` count times leaves A's bit ((count-1) mod 8) in the carry: bit (BOARD-1)
  // for a board in 1..8. That bit is the current board's flag in the mask A.
  const boardBit = (regs.a >> ((count - 1) & 7)) & 1;

  // Carry SET -> gate open, caller proceeds (true). Carry CLEAR -> gate closed, the
  // caller's next action is skipped (false).
  return boardBit === 1;
}
