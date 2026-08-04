// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_33a1 — the guard at the head of the fire's ladder-climb movement path: a per-board
 * applicability gate, then a height test that abandons that path once the object has risen above
 * the 89-pixel line.
 *
 * Twelve bytes with one caller. It reads two bytes and writes none; its entire product is the
 * caller-skip boolean, and the two skips in those twelve bytes are NOT the same skip:
 *
 *   1. BOARD GATE — mask 0x07 through the shared per-board gate: bit 0 = 25m, bit 1 = 50m,
 *      bit 2 = 75m, so the gate is OPEN on those three boards and CLOSED on 100m. A closed gate
 *      abandons THIS routine and returns to the caller at the instruction after the call — from the
 *      caller's point of view an ordinary, merely early, return. So a closed gate reports TRUE and
 *      the caller carries on.
 *   2. HEIGHT TEST — with the gate open, compare the object record's +0x0f against 89. At or above
 *      that value the caller proceeds normally. Below it the CALLER is abandoned entirely: that is
 *      the caller-skip idiom, and it is the FALSE return here.
 *
 * So the boolean answers "was the caller returned to normally?", not "did the board gate fire" —
 * conflating the two would strand the caller's continuation on every 100m frame.
 *
 * WHICH BYTE +0x0f IS, and what is not claimed. It carries no shared name, so it stays a raw
 * in-record offset. All this body derives is that it is compared against a constant 89 and that a
 * smaller value abandons the movement path. Reading it as a Y-axis coordinate — and 89 as a height
 * on the screen, with larger values further down — comes from how the same byte is used elsewhere,
 * and is not proved here.
 *
 * Reads: BOARD, inside the shared gate, and the record's +0x0f. Writes: nothing at all.
 * LIVE-OUT: the caller-skip boolean, and nothing else. No register or flag survives.
 */

import { boardBitGate } from "./boardBitGate.js"; // the shared per-board skip gate

// One bit per board: 25m | 50m | 75m. The gate selects the current board's bit, so this mask
// leaves it open on those three boards and closed on 100m.
const BOARDS_25M_50M_75M = 0x07;

// The object record's Y-axis base — an offset with no shared cell name.
const RECORD_Y_BASE = 0x0f;

// Above this line (numerically below it — larger Y is further down the screen) the movement
// path is abandoned.
const ABANDON_ABOVE_Y = 89;

/**
 * @param {object} m  the machine. Live-in: the object-record pointer, whose Y base is tested, and
 *   the current board, read inside the gate.
 * @returns {boolean} true = the caller was returned to normally and carries on; false = the
 *   caller-skip, so the caller must return immediately.
 */
export function loc_33a1(m) {
  const { regs, mem } = m;

  // The gate reads its mask from the accumulator. A closed gate is an early return the caller
  // still sees as normal, hence true.
  regs.a = BOARDS_25M_50M_75M;
  if (!boardBitGate(m)) return true;

  // At or above the threshold -> the caller runs its movement path; below it -> skip the caller
  // altogether.
  return mem.read8(regs.ix + RECORD_Y_BASE) >= ABANDON_ABOVE_Y;
}
