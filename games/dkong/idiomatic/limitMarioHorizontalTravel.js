// SPDX-License-Identifier: GPL-3.0-only
/**
 * limitMarioHorizontalTravel — horizontal position gate: classify Mario's X into a two-flag
 * verdict the movement code uses to clamp X and gate walk direction.
 *
 * A read-only leaf. It reads MARIO_X, MARIO_Y and BOARD, writes NO memory, calls nothing, and
 * returns a pair of flags. The tests are taken in order and the first that fires decides the
 * verdict; all compares are UNSIGNED:
 *
 *   X < 0x16                             -> (1,0)  far-left / default
 *   X >= 0xEA                            -> (0,1)  far-right edge
 *   BOARD is even                        -> (0,0)  blocked (50m and 100m)
 *   Y >= 0x58                            -> (0,0)  blocked (below the band)
 *   X >= 0x6C                            -> (0,0)  blocked (past the mid column)
 *   else (0x16 <= X < 0x6C, Y < 0x58,    -> (1,0)  in-band default
 *         odd board)
 *
 * Only bit 0 of BOARD is read, so the third test blocks the gate on the two even-numbered
 * boards, 50m and 100m.
 *
 * The three consumers read the pair differently but all turn it into the same physical thing,
 * a restraint on Mario's X — which is what the name asserts and all it asserts:
 *   - the walk/climb direction step treats the second flag as "the right edge blocks a
 *     rightward step" and simply refuses to move.
 *   - the airborne step treats the first flag as a push back inward: it sets a rightward
 *     horizontal drift of half a pixel per frame and faces Mario right. It is NOT a stop —
 *     the velocity is not zeroed.
 *   - the X clamp uses both: the second flag pushes X left, the first pushes X right, and
 *     (0,0) leaves X where the move put it.
 * So two of the three consumers MOVE Mario; only the walk step merely refuses.
 *
 * LIVE-OUT: the verdict pair. It is both returned and mirrored into the D/E registers, because
 * the callers read it from there. Writes NO memory.
 *
 * @param {object} m  the machine (read-only use of m.mem here).
 * @returns {{d:number, e:number}} the verdict pair, also mirrored into regs.d/regs.e.
 */
import { MARIO_X, MARIO_Y, BOARD } from "./names.js";

export function limitMarioHorizontalTravel(m) {
  const { regs, mem } = m;
  const x = mem.read8(MARIO_X);

  let d, e;
  if (x < 0x16) {
    d = 1; e = 0; // far-left / default -> (1,0)
  } else if (x >= 0xea) {
    d = 0; e = 1; // far-right edge -> (0,1)
  } else if ((mem.read8(BOARD) & 0x01) === 0) {
    d = 0; e = 0; // even board (bit 0 clear) -> (0,0)
  } else if (mem.read8(MARIO_Y) >= 0x58) {
    d = 0; e = 0; // below the band -> (0,0)
  } else if (x >= 0x6c) {
    d = 0; e = 0; // past the mid column -> (0,0)
  } else {
    d = 1; e = 0; // in-band default -> (1,0)
  }

  // The callers read the verdict out of the D/E registers, so mirror it there in addition to
  // returning the honest pair.
  regs.d = d;
  regs.e = e;
  return { d, e };
}
