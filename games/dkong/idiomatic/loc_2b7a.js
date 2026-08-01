// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_2b7a — pick the tile-probe's horizontal X-snap arm on the airborne X-velocity,
 * then snap Mario's X to its 8-pixel column and commit it.  ROM 0x2B7A.
 *
 * The head of the tile-probe's horizontal snap, and the sibling of loc_2b8b. It reads
 * the high byte of Mario's airborne horizontal velocity (MARIO_AIR_VX_HI) and Mario's
 * current X (MARIO_X), and splits on whether that velocity high byte is zero:
 *   - velocity high byte zero    -> hand Mario's current X to loc_2b8b, which snaps it to
 *                                   its 8-pixel column and commits it through loc_2b91.
 *   - velocity high byte nonzero -> snap X here (net (X & ~7) + 3, the SAME column snap
 *                                   loc_2b8b applies) and hand the snapped X to loc_2b91.
 * Either arm ends identically: loc_2b91 stores the snapped X into MARIO_X and Mario's
 * sprite-record X so the sprite tracks the new column at once, leaves 1 in the result
 * register, and raises the two-level caller-skip unwind. loc_2b7a returns that signal
 * unchanged. The two arms are memory-equivalent — they compute the same snapped X and
 * commit it the same way — so the arm choice is a faithful-dispatch detail, not an
 * observable difference in the result; the whole memory effect is a pure function of
 * MARIO_X.
 *
 * REGISTER-ABI MARSHALLING: both callees still take the X in the accumulator (their
 * caller chain is the frozen translation), so this routine leaves the X where each reads
 * it — Mario's current X in regs.a before loc_2b8b (which snaps it itself), and the
 * already-snapped X in regs.a before loc_2b91. This is exactly what the oracle leaves in
 * the accumulator at each dispatch; it dissolves once that chain is decompiled.
 *
 * Memory-equivalent to the frozen oracle — equivalence-2b7a.test.js.
 * GATE:     crafted; a factored proof over the whole input — the memory effect is a pure
 *           function of MARIO_X (both arms compute the same snap), so the zero arm swept
 *           over all 256 X, the nonzero arm swept over all 256 X, and the arm selector
 *           swept over all 256 velocity-high-byte values together cover the space. Each on
 *           a real attract base with a staged two-word return frame; the RAM diff excludes
 *           the dead STACK_SCRATCH the dissolved two-level unwind pops. loc_2b7a is not
 *           reached in attract, so REALISM records that and crafted is the gate.
 * LIVE-OUT: memory (MARIO_X + the sprite-record X, written through the callee chain), the
 *           result register (A=1, consumed by the grandparent's `dec a`), and the boolean
 *           caller-skip signal. HL and the flags are dead ABI.
 * NAMES:    MARIO_AIR_VX_HI (0x6210, the arm selector) and MARIO_X (0x6203, the X snapped
 *           and committed) — from ram.js. The sprite-record cells are written inside
 *           loc_2b91, not here.
 */

import { loc_2b8b } from "./loc_2b8b.js"; // ROM 0x2B8B — snap + commit (velocity-high-byte-zero arm)
import { loc_2b91 } from "./loc_2b91.js"; // ROM 0x2B91 — commit the snapped X + caller-skip unwind
import { MARIO_AIR_VX_HI, MARIO_X } from "./ram.js";

/**
 * @param {object} m  the machine.
 * @returns {boolean} false — the caller-skip signal propagated up from loc_2b91 (unwind two levels).
 */
export function loc_2b7a(m) {
  const { regs, mem } = m;

  // The arm selector: the high byte of Mario's airborne horizontal velocity.
  const velocityHiZero = mem.read8(MARIO_AIR_VX_HI) === 0;

  // Mario's current X, the value both arms snap to its 8-pixel column.
  const marioX = mem.read8(MARIO_X);

  if (velocityHiZero) {
    // Hand Mario's current X to loc_2b8b, which snaps it and commits it via loc_2b91.
    // loc_2b8b reads its candidate X from the accumulator (register-ABI marshalling).
    regs.a = marioX;
    return loc_2b8b(m);
  }

  // Snap X to its 8-pixel column here — net (marioX & ~7) + 3 — and hand the snapped X
  // to loc_2b91 in the accumulator, where it reads its X (register-ABI marshalling).
  regs.a = (marioX | 0x07) - 4;
  return loc_2b91(m);
}
