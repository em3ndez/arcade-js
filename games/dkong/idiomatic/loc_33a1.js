// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_33a1 — the guard at the head of loc_333d's movement path: a per-board applicability gate,
 * then a height test that abandons loc_333d once the object has climbed past the 89-pixel line.
 * ROM 0x33A1.
 *
 * Twelve ROM bytes, reached from exactly one site in the whole 16K ROM — the `call 0x33a1` at
 * 0x334A, inside the still-oracle movement/collision state machine loc_333d. It reads two bytes
 * and writes none; its entire product is the caller-skip boolean.
 *
 *   1. BOARD GATE — mask 0x07 through boardBitGate (the `rst 0x30` vector): bit0 = 25m, bit1 =
 *      50m, bit2 = 75m, so the gate is OPEN on those three boards and CLOSED on 100m. A closed
 *      gate in the oracle drops the gate's own return address and returns into loc_333d at the
 *      instruction after the call — from loc_333d's point of view an ordinary (just early)
 *      return, so this routine reports TRUE and loc_333d carries on. That is the whole reason
 *      the two skips in these twelve bytes are NOT the same skip: this one abandons loc_33a1,
 *      the one below abandons loc_333d.
 *
 *   2. HEIGHT TEST — with the gate open, compare the object record's Y-axis base (+0x0f) against
 *      89. At or below the line (>= 89, i.e. lower on screen, since larger Y is further down)
 *      loc_333d proceeds normally. Above it (< 89, high on the screen) the oracle discards its
 *      OWN return address and returns past loc_333d to loc_333d's caller: loc_333d is skipped
 *      entirely. That is the caller-skip idiom, and it is the FALSE return here — loc_333d
 *      spells it `if (!loc_33a1(m)) return;`.
 *
 * So the boolean answers "was loc_333d returned to normally?", not "did the board gate fire" —
 * conflating the two would strand loc_333d's continuation on every 100m frame.
 *
 * WHICH BYTE +0x0f IS. names.js names no object-record field at +0x0f, so it stays a raw offset
 * here, but its axis is pinned from outside this routine: loc_3202 builds the record's OBJ_Y
 * (+5) as a table offset PLUS this byte, and loc_333d compares this same byte directly against
 * MARIO_Y — so it is a Y-axis coordinate in Mario's units, the anchor the rendered Y is derived
 * from. The 89 threshold therefore reads as a height on the screen, and every natural dispatch
 * measured sits far below it (203..240).
 *
 * Memory-equivalent to the frozen oracle — equivalence-33a1.test.js.
 * GATE:     captured + crafted + exhaustive. 0x33A1 IS NATURALLY REACHED: 114 real dispatches in
 *           an 8000-frame attract run (406 in 30000), all through loc_333d on the 0x6400 record
 *           while GAME_STATE is 1. But every one of them lands on the SAME arm — board 1, gate
 *           open, +0x0f in 203..240 — so natural capture proves only the at-or-below-the-line
 *           return; the 100m gate-closed arm and the above-the-line splice are carried by
 *           crafted entries and by an EXHAUSTIVE sweep of all 65,536 (BOARD, +0x0f) pairs, since
 *           the routine's whole behaviour is a total function of those two bytes.
 * LIVE-OUT: the caller-skip boolean, and nothing else. The routine writes no memory at all (the
 *           oracle's only stores are the gate's return address and its own splice, both inside
 *           the dead STACK_SCRATCH), and no register or flag survives: loc_333d reloads the
 *           accumulator at 0x334D before touching it, sets BC itself, and its next callee
 *           findOppositeLadderEnd loads its own pointer — while the splice arm returns into loc_3202, which
 *           reloads the accumulator too. pc/SP are the Z80 stack idiom the boolean REPLACES, so
 *           they are deliberately not compared; the gate instead pins the boolean's meaning by
 *           asserting where the ORACLE's own return lands on each arm.
 * NAMES:    no names.js cell is read here directly — BOARD (0x6227) is read inside boardBitGate,
 *           and the object field at +0x0f has no names.js name (the named record offsets are +0,
 *           +3, +5, +7, +8, +9, +0x0a, +0x0d, +0x18, +0x1a/+0x1b), so it is kept as a raw
 *           in-record offset rather than borrowed from another namespace.
 */

import { boardBitGate } from "./boardBitGate.js"; // ROM 0x0030 (rst 0x30) — the per-board skip gate

// One bit per board: 25m | 50m | 75m. boardBitGate selects the current board's bit, so this
// mask leaves the gate open on those three and closed on 100m.
const BOARDS_25M_50M_75M = 0x07;

// The object record's Y-axis base, an offset names.js does not name.
const RECORD_Y_BASE = 0x0f;

// Above this line (numerically below it — larger Y is further down the screen) the movement
// path is abandoned.
const ABANDON_ABOVE_Y = 89;

/**
 * @param {object} m  the machine. Live-in: the object-record pointer (the record whose Y base is
 *   tested) and the current board, read inside the gate.
 * @returns {boolean} true = loc_333d was returned to normally and continues; false = the
 *   caller-skip, so loc_333d must return immediately.
 */
export function loc_33a1(m) {
  const { regs, mem } = m;

  // boardBitGate reads its mask from the accumulator; a closed gate is an early return that
  // loc_333d still sees as normal, hence true.
  regs.a = BOARDS_25M_50M_75M;
  if (!boardBitGate(m)) return true;

  // Still low enough on the screen -> loc_333d runs its movement path; risen above the line ->
  // skip loc_333d altogether.
  return mem.read8(regs.ix + RECORD_Y_BASE) >= ABANDON_ABOVE_Y;
}
