// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_1ceb — hand-optimized rewrite of the translated routine at ROM 0x1CEB,
 * proven equal to its oracle by the equivalence harness.
 *
 * One routine per file. Its single tail (0x1da6 = entry_1da6, the player-sprite ->
 * draw-buffer copy, reached by the tail jump) is invoked through `m.call`, the routine
 * registry (games/dkong/routines.js), so it resolves to the oracle or to entry_1da6's
 * own optimized rewrite — never a copied implementation here. The RAM *name*
 * MARIO_MOVE_STEP_TIMER (0x620F) is imported from ram.js.
 */

import { MARIO_MOVE_STEP_TIMER } from "./ram.js";

/**
 * loc_1ceb -- decrement Mario's walk/climb sub-step timer, then hand off to the
 * player-sprite copy.  [ROM 0x1CEB-0x1CF1, then jp entry_1da6 @ 0x1da6]
 *
 *   1ceb  21 0f 62     ld   hl,0x620f     ; HL -> MARIO_MOVE_STEP_TIMER
 *   1cee  35           dec  (hl)          ; (0x620f) -= 1
 *   1cef  c3 a6 1d     jp   0x1da6        ; TAIL jump into entry_1da6 (no push)
 *
 * WHAT IT DOES.  The shared tail of the ground-move step. loc_1c8f (+dir) / loc_1cab
 * (-dir) start a move only when the step timer is 0; while it is nonzero they jump
 * straight to loc_1cd2, which shifts Mario 1px in X (0x6203 += ±1) and then reaches
 * here on BOTH of its arms (the `jp nz,0x1ceb` mid-routine, and the fall-through at
 * its end). loc_1ceb consumes one frame of that in-progress move: it decrements the
 * sub-step timer at 0x620F, then tail-jumps to entry_1da6, which copies the four
 * player sprite fields (0x6203/0x6207/0x6208/0x6205) into the draw buffer (0x694C..F)
 * and returns to the per-frame update cascade (loc_197a, the exit `ret` lands at
 * 0x1983 in live play). When the timer reaches 0 on a later frame, loc_1c8f/loc_1cab
 * advance the walk animation and reload it (2 walk / 3-4 climb).
 *
 * INPUTS  : RAM 0x620F (the current sub-step timer). The stack (a caller return
 *           address for entry_1da6's `ret` to land on).
 * OUTPUTS : RAM (0x620F) := (0x620F) - 1 (mod 256; 1 -> 0 on the natural attract
 *           entry). Then entry_1da6's effects (the four sprite-field copies). Register
 *           file on return: entry_1da6 sets HL, A, and F itself, so those match the
 *           oracle via the identical tail; BC/DE/IX/IY are untouched by both loc_1ceb
 *           and entry_1da6, and carry is preserved throughout (see FLAGS). PC/SP move
 *           via the tail call + entry_1da6's ret. `return` forwards entry_1da6's
 *           (inert) result.
 *
 * NAME.  0x620F is MARIO_MOVE_STEP_TIMER (ram.js): the ground walk/climb sub-step
 *   timer, control-proven ("poking 20 gives 20 frames of 1px/frame"), decremented by
 *   the move code at loc_1c8f/loc_1cab (0x1C94/0x1CB0) and reloaded there. The frozen
 *   oracle's one-line comment calls this a "jump-phase" byte, but that descriptor is
 *   STALE: a jump never touches 0x620F (ram.js records this explicitly). No new naming
 *   candidate — the address is already evidenced and named.
 *
 * FLAGS.  DROPPED. The oracle's `dec (hl)` sets S/Z/H/P-V/N (not carry). Those flags
 *   are DEAD: the only control transfer out of loc_1ceb is the UNCONDITIONAL `jp
 *   0x1da6`, which reads no flag, and entry_1da6 is straight-line ld/inc/ret with NO
 *   conditional branch, so it never reads the incoming F -- and its three `inc l`
 *   instructions OVERWRITE S/Z/H/P-V/N before the routine exits. Carry is never
 *   touched by `dec`, by this rewrite, or by entry_1da6's `inc`, so it is carried
 *   through unchanged on both sides. The exit F is therefore whatever entry_1da6
 *   leaves, IDENTICAL on the oracle and this rewrite regardless of the dropped `dec`
 *   flags -- proven by the unit gate, which compares the whole register file (incl.
 *   F and the undocumented F3/F5 bits) after the full routine + tail. A plain
 *   `(timer - 1) & 0xff` reproduces `dec8`'s VALUE exactly (0 -> 0xFF wraps like the
 *   Z80).
 *
 * REGISTER CHURN.  The oracle loads HL := 0x620F only to address the `dec (hl)`. This
 *   rewrite writes 0x620F directly, so HL is never set here -- and it need not be:
 *   entry_1da6's first instruction (`ld hl,0x694c`) overwrites HL before reading it,
 *   so loc_1ceb's HL is dead across the tail. Dropped.
 *
 * CYCLES -- COLLAPSED to ONE m.step for the whole straight-line block (no branch): ld
 *   hl[10] + dec (hl)[11] + jp[10] = 31 t, folded into a single charge at the block-exit
 *   PC 0x1da6, exactly the oracle's total. total-preservation keeps the main loop's spin
 *   count (0x6019, the PRNG entropy) deterministic. The one RAM write (0x620F) is WORK
 *   RAM -- NOT a tagged hardware latch (0x7800-0f / 0x7c00 / 0x7c80 / 0x7d00-07 /
 *   0x7d80-87) -- so no hardware bus cycle is hidden inside the block and the full
 *   collapse across it is safe; there is NO write-trace test to add.
 *
 * loc_1ceb is NOT atomic: it is reached from loc_1cd2 <- loc_1c8f/loc_1cab, which the
 *   interruptible per-frame update cascade loc_197a dispatches (measured: 221 dispatches
 *   over a 1200-frame attract run, exit `ret` landing at 0x1983 in the cascade), so the
 *   vblank NMI can land inside its 31 t window. The collapse is therefore LICENSED by
 *   the CONVERGENT gate (docs/decompiler-pipeline; equivalence-1ceb.test.js uses convergentGate, not the
 *   strict whole-machine gate): a mistimed NMI pushes the coarse block-exit PC into the
 *   DEAD stack (excluded) and can leave a single-frame raster tear that heals next frame;
 *   non-stack RAM stays byte-identical and nothing persistent survives.
 *
 * The `jp 0x1da6` is a TAIL jump with NO push16: entry_1da6's own `ret` returns to
 * loc_1ceb's caller, not to here. entry_1da6 is reached via `m.call(0x1da6)` so it
 * resolves to the oracle or to its own optimized rewrite; `return` forwards its answer.
 */
export function loc_1ceb(m) {
  const { mem } = m;

  // Consume one frame of the in-progress 1px move: decrement the walk/climb sub-step
  // timer. `& 0xff` reproduces the Z80 `dec` wrap (0 -> 0xFF). No flags needed (dropped;
  // see FLAGS), and HL is not set (entry_1da6 overwrites it -- see REGISTER CHURN).
  const timer = mem.read8(MARIO_MOVE_STEP_TIMER);
  mem.write8(MARIO_MOVE_STEP_TIMER, (timer - 1) & 0xff);

  // One collapsed charge for the whole block incl. the tail jp: ld hl[10] + dec(hl)[11]
  // + jp[10] = 31 t, exit PC 0x1da6 (interruptible; convergent gate licenses the collapse).
  m.step(0x1da6, 31);
  // TAIL jump (jp, NO push16): entry_1da6's ret returns to OUR caller.
  return m.call(0x1da6);
}
