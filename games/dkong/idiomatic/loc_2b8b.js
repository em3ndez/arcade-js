// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_2b8b — snap the probe's candidate X to its 8-pixel column, then commit it as
 * Mario's position.  ROM 0x2B8B.
 *
 * One arm of the tile-probe's horizontal snap (loc_2b7a picks it when Mario's
 * airborne X-velocity high byte, MARIO_AIR_VX_HI, is zero). It takes the candidate X
 * that loc_2b7a handed in — Mario's current X — aligns it to the containing 8-pixel
 * cell's settled column (net: (X & ~7) + 3), and falls straight into loc_2b91, which
 * stores that X into MARIO_X and Mario's sprite-record X so the sprite tracks the new
 * column at once. loc_2b91 leaves 1 in the result register and raises the two-level
 * caller-skip unwind; this routine returns that signal unchanged.
 *
 * REGISTER-ABI MARSHALLING: loc_2b91 still takes its X in the accumulator (its caller
 * chain is the frozen translation), so the snapped X is left in regs.a exactly where
 * the oracle's fall-through leaves it before entering 0x2b91. The candidate X is a
 * register live-in for the same reason — loc_2b8b's callers (state0, loc_2b7a) are
 * still translated — so it is read from regs.a.
 *
 * Memory-equivalent to the frozen oracle — equivalence-2b8b.test.js.
 * GATE:     crafted, exhaustive over all 256 candidate-X values (the routine's only
 *           input), each on a real attract base with a staged return stack; the RAM
 *           diff excludes the dead STACK_SCRATCH the dissolved two-level unwind pops.
 *           loc_2b8b is not reached in attract, so REALISM records that and crafted
 *           is the gate.
 * LIVE-OUT: memory (MARIO_X + the sprite-record X, written through loc_2b91), the
 *           result register (A=1, consumed by the grandparent's `dec a`), and the
 *           boolean caller-skip signal. HL and the flags are dead ABI.
 * NAMES:    MARIO_X, MARIO_SPRITE_RECORD, SPRITE_X — the cells loc_2b91 writes, from
 *           ram.js. loc_2b8b touches no work-RAM cell directly; the arm selector
 *           MARIO_AIR_VX_HI (0x6210) is read by the caller, not here.
 */

import { loc_2b91 } from "./loc_2b91.js"; // ROM 0x2B91 — commit the X + caller-skip unwind

export function loc_2b8b(m) {
  const { regs } = m;

  // The probe's candidate X (Mario's current X, read from MARIO_X by loc_2b7a).
  const candidateX = regs.a;

  // Snap it to its 8-pixel column: drop into the cell below, force the low three
  // bits, then step up to the settled column — net (candidateX & ~7) + 3. Leave the
  // result in the accumulator, where loc_2b91 reads its X (register-ABI marshalling).
  regs.a = ((candidateX - 8) | 0x07) + 4;

  // Commit the snapped X to MARIO_X and the sprite-record X, and propagate the
  // two-level caller-skip signal loc_2b91 raises.
  return loc_2b91(m);
}
