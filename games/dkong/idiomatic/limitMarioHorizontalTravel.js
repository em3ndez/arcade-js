// SPDX-License-Identifier: GPL-3.0-only
/**
 * limitMarioHorizontalTravel — horizontal position gate: classify Mario's X into a two-flag (D,E)
 * verdict the movement code uses to clamp X and gate walk direction.  ROM 0x241f.
 *
 * A read-only leaf. It reads MARIO_X, MARIO_Y and BOARD, writes NO memory, calls
 * nothing, and returns a (D,E) pair. The oracle is five conditional `ret`s that
 * fall through when not taken, mutating (D,E) between them, so the exit reached IS
 * the verdict (all compares are UNSIGNED):
 *
 *   X < 0x16                              -> (D,E) = (1,0)   far-left / default
 *   X >= 0xEA                             -> (D,E) = (0,1)   far-right edge
 *   bit0(BOARD) == 0                      -> (D,E) = (0,0)   blocked (even boards)
 *   Y >= 0x58                             -> (D,E) = (0,0)   blocked (below band)
 *   X >= 0x6C                             -> (D,E) = (0,0)   blocked (past mid col)
 *   else (0x16<=X<0x6C, Y<0x58, odd bd)   -> (D,E) = (1,0)   in-band default
 *
 * (The `rrca` on BOARD is a bit-0 test; BOARD is 1/3 = odd on 25m/75m, 2/4 = even
 * on 50m/100m, so the third arm blocks the gate on the even boards.)
 *
 * Each of the three callers consumes the pair a DIFFERENT way, but all three turn it
 * into the same physical thing — a restraint on Mario's X — which is what the name
 * asserts and all it asserts:
 *   - walkRightWhileHeld (walk/climb dir): `dec e` — E==1 (right edge) blocks a rightward step.
 *   - advanceMarioAirborneFrame (airborne):       `dec d` — D==1 writes MARIO_AIR_VX_HI/LO
 *                                = 0/128, i.e. +0.5 px/frame drift RIGHTWARD, and faces
 *                                right. It is a push back inward, NOT a stop: the velocity
 *                                is not zeroed. (An earlier header here said "zeroes
 *                                horizontal velocity"; that was wrong.)
 *   - move_2b02 (X clamp):       `dec e` then `dec d` — E==1 pushes X left, D==1 pushes
 *                                X right, (0,0) leaves X as moved.
 * So TWO of the three consumers move Mario; only walkRightWhileHeld merely refuses.
 *
 * Memory-equivalent to the frozen oracle — equivalence-241f.test.js.
 * GATE:     exhaustive — total function of (X, Y, bit0(BOARD)): (D,E) == oracle over
 *           the full 256x256 (X,Y) grid for BOTH board parities (131,072 combos),
 *           plus an all-256 BOARD-value breadth sweep proving only bit 0 matters,
 *           plus real captured 25m attract dispatches (which only reach the (0,0)
 *           arm — Y is always >= 0x58 there) and crafted real states for the arms
 *           attract never reaches. Reached via m.call from walkRightWhileHeld/1bb2/2b02.
 * LIVE-OUT: registers D and E (the (D,E) pair; every caller `dec`s and tests them).
 *           Returned as {d, e} AND written to regs.d/regs.e because all three
 *           callers are still the frozen oracle and read regs.d/regs.e directly —
 *           drop the reg writes once they are idiomatic (honest-signature capstone).
 *           Writes NO RAM; A and all flags are dead (every caller reloads/recomputes
 *           before reading them); the Z80 `ret` is just this function returning, so
 *           pc/SP are not modelled or compared.
 * NAMES:    MARIO_X (0x6203), MARIO_Y (0x6205), BOARD (0x6227) — from names.js.
 *
 * @param {object} m  the machine (read-only use of m.mem here).
 * @returns {{d:number, e:number}} the (D,E) verdict, also mirrored into regs.d/regs.e.
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

  // BOUNDARY: the three callers are still the frozen oracle and read regs.d/regs.e,
  // so set them in addition to returning the honest pair.
  regs.d = d;
  regs.e = e;
  return { d, e };
}
