// SPDX-License-Identifier: GPL-3.0-only
/**
 * moveMarioX — advance Mario's X by the current velocity, then hold it inside the
 * horizontal limits.  ROM 0x2B02.
 *
 * Called on the moving-platform boards (via the platform-row mover sub_2ad3 / arm_2af6,
 * which pick the row's drift velocity for Mario riding an elevator/conveyor). The new
 * X is the velocity added to Mario's prior X; it is stamped into BOTH the live position
 * (MARIO_X) and the mirror kept in the hardware sprite record (MARIO_SPRITE_RECORD), so
 * the sprite tracks the move. The horizontal position gate then classifies that new X:
 * if it has run off the far-right edge the position is nudged one pixel back left, if it
 * is at the far-left / in-band default it is nudged one pixel right, and if the gate is
 * blocked the position is left exactly where the velocity put it. The one-pixel nudge is
 * applied to the live position only — the sprite-record mirror keeps the pre-nudge X.
 *
 * Memory-equivalent to the frozen oracle — equivalence-2b02.test.js.
 * GATE:     crafted-entry — attract never rides the moving-platform rows (0 real 0x2B02
 *           dispatches in 3000 frames), so entries are crafted on a real attract base: a
 *           full sweep of all 256 new-X values x both board parities x both Y bands drives
 *           every position-gate verdict and every edge nudge, with a nonzero velocity/X
 *           split so the add is exercised at each X. Reached only via sub_2ad3/arm_2af6.
 *           The dropped push16/ret bracket's dead STACK_SCRATCH is excluded from the RAM
 *           diff. Teeth: a twin that drops the +velocity, a twin that mirrors the nudge
 *           into the sprite record, and a twin that swaps the two edge directions.
 * LIVE-OUT: memory-only (MARIO_X, MARIO_SPRITE_RECORD). The velocity and prior X arrive
 *           in registers at the still-translated caller boundary; nothing downstream reads
 *           a register or flag this routine leaves — the callers tail-return.
 * NAMES:    MARIO_X (0x6203), MARIO_SPRITE_RECORD (0x694C) — from names.js. Callee limitMarioHorizontalTravel
 *           (ROM 0x241F, the horizontal position gate) is direct-called; it reads only
 *           memory, so no register marshalling precedes it.
 */

import { MARIO_X, MARIO_SPRITE_RECORD } from "./names.js";
import { limitMarioHorizontalTravel } from "./limitMarioHorizontalTravel.js"; // ROM 0x241F — horizontal position gate -> (d,e)

/**
 * @param {object} m  the machine. Live-in: regs.a = velocity, regs.b = Mario's prior X.
 * @returns {void}
 */
export function moveMarioX(m) {
  const { regs, mem } = m;

  // New X = current velocity + prior X. Stamp it into the live position and the sprite
  // record's X byte together (the byte store truncates, so this is the 8-bit position).
  const newX = regs.a + regs.b;
  mem.write8(MARIO_X, newX);
  mem.write8(MARIO_SPRITE_RECORD, newX);

  // Classify the new X against the horizontal limits.
  const { d, e } = limitMarioHorizontalTravel(m);

  // Far-right edge -> pull the live position one pixel back left.
  if (e === 1) {
    mem.write8(MARIO_X, mem.read8(MARIO_X) - 1);
    return;
  }

  // Far-left / in-band default -> push the live position one pixel right.
  if (d === 1) {
    mem.write8(MARIO_X, mem.read8(MARIO_X) + 1);
    return;
  }

  // Blocked verdict (0,0) -> leave X exactly where the velocity put it.
}
