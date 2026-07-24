// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_0450 — hand-optimized rewrite of the translated routine at ROM 0x0450,
 * proven equal to its oracle by the equivalence harness.
 *
 * One routine per file. Every callee (0x0038 the rst-0x38 sprite-offset helper,
 * 0x0478 and 0x0486 the two colour-tail arms) is reached through `m.call(0xADDR)`
 * via the routine registry (games/dkong/routines.js), so each resolves to the
 * oracle — or to its own optimized rewrite once one exists — never a copy. Only
 * the RAM name BOARD is imported (from ram.js).
 */

import { BOARD } from "./ram.js";

/**
 * loc_0450 -- colour-cycle sprite dispatch on BOARD's low two bits.
 * [ROM 0x0450-0x0463; every arm tail-jumps into the colour tail loc_0486]
 *
 *   0450  3a 27 62   ld  a,(0x6227)   ; A = BOARD
 *   0453  0f         rrca             ; C = BOARD bit0
 *   0454  d2 78 04   jp  nc,0x0478    ; bit0 == 0 -> loc_0478 (bit0-clear arm)
 *   0457  0f         rrca             ; C = BOARD bit1
 *   0458  da 86 04   jp  c,0x0486     ; bit1 == 1 -> loc_0486 (straight to colour tail)
 *   045b  21 0b 69   ld  hl,0x690b    ; else (bit0==1,bit1==0): a sprite-record byte
 *   045e  0e fc      ld  c,0xfc       ; C = -4 (the per-record delta rst 0x38 applies)
 *   0460  ff         rst 0x38         ; CALL loc_0038 -- offset 10 sprite records by -4
 *   0461  c3 86 04   jp  0x0486       ; then the colour tail loc_0486
 *
 * WHAT IT DOES. This is one node of Donkey Kong's per-frame colour-cycle / sprite
 * animation tree (0x03FB..0x0513), reached each frame the animation's 0x6390
 * counter crosses a 32-frame boundary (loc_0426 falls in here; loc_0464's cold arm
 * `jp 0x0450` rejoins). It dispatches on the low two bits of BOARD (0x6227,
 * 1=25m 2=50m 3=75m 4=100m) to pick which sprite-record adjustment — if any — to
 * make before running the shared colour tail loc_0486:
 *
 *   - bit0 == 0  (BOARD 2 or 4)  -> loc_0478  : its own rst-0x38 sprite offset arm.
 *   - bit0 == 1, bit1 == 1 (BOARD 3) -> loc_0486 : straight to the colour tail, no shift.
 *   - bit0 == 1, bit1 == 0 (BOARD 1) -> ld hl,0x690b / ld c,-4 / rst 0x38, then loc_0486:
 *       offset 10 sprite records (loc_0038 fixes stride 4, count 10) by -4 at the
 *       0x690b field, then fall into the colour tail. This is the HOT board-1 arm.
 *
 * The dispatch is done the ROM's way: two `rrca`s walk BOARD's bit0 then bit1 into
 * carry. The value in A after the FIRST rrca (ror(BOARD)) is LOAD-BEARING — the
 * bit0-clear arm loc_0478 begins with its own `rrca` on that same A to test bit1 —
 * so the `rrca` is kept VERBATIM (regs.rrca()) rather than replaced by a bit test:
 * both A and F then match the oracle bit-for-bit, which the unit gate compares.
 *
 * 0x690b is a byte inside the sprite shadow buffer (SPRITE_BUFFER 0x6900; three
 * past SPRITE_OBJ_BLOCK 0x6908) -- a specific record field, not a settled name, so
 * it stays a hex literal (same treatment as entry_03fb's 0x6910). C = 0xfc is the
 * signed -4 delta loc_0038's add-loop applies to each record.
 *
 * INPUTS:  BOARD (0x6227) selects the arm. OUTPUTS: no work-RAM write of its own;
 *   the bit0==1/bit1==0 arm's rst 0x38 shifts sprite-buffer bytes (via loc_0038),
 *   and every arm then runs loc_0486, which owns the colour-RAM writes (sub_0514).
 *   No hardware (0x7Dxx) latch is touched -- no write-trace concern.
 *
 * FLAGS. loc_0450 never returns a `cc`; every arm tail-calls, so its observable
 * "return" is whatever loc_0478 / loc_0486 leave. The carry each `rrca` sets is
 * consumed by the immediately following `jp` and then either re-derived by
 * loc_0478 (its own rrca) or overwritten by loc_0486's first compare before
 * anything reads it. The ops are kept verbatim so F (and A) match the oracle
 * exactly at the hand-off.
 *
 * CYCLES -- COLLAPSED to one m.step per basic block (the rst-0x38 push16/m.call
 * scaffold is kept verbatim, never folded across). `jp nc`/`jp c` cost the oracle's
 * 10 t whichever way they go, so each straight-line prefix is folded into whichever
 * arm it lands in rather than split at the branch. Per-arm totals, summed and
 * cross-checked against this file's own prior per-instruction charges (all
 * previously proven equal):
 *   branch A (BOARD bit0==0, -> loc_0478) 27 t; branch B (bit0=1,bit1=1, -> loc_0486
 *   direct) 41 t; branch C (bit0=1,bit1=0, the HOT board-1 arm: ld hl,0x690b + ld
 *   c,0xfc) 58 t before the rst-0x38 scaffold (11 t, kept verbatim) and the final
 *   `jp 0x0486` tail (10 t) -- 79 t total on this arm, matching the oracle exactly.
 *   Total-preservation keeps the caller's cycle clock exact; only the mid-routine PC
 *   snapshot an NMI would observe is coarsened, same as any collapse.
 *
 * Both callers (loc_0426, loc_0464) are in the interruptible per-frame colour
 * cascade (NMI mask ENABLED), and loc_0450 spans rst 0x38 plus the entire
 * interruptible loc_0478/loc_0486 colour tree, so the vblank NMI can land inside
 * it; see the equivalence test for the (convergent, unconditionally) gate this
 * routine runs under.
 */
export function loc_0450(m) {
  const { regs, mem } = m;

  // ld a,(BOARD) / rrca -- rotate BOARD's bit0 into carry.
  regs.a = mem.read8(BOARD);
  regs.rrca();

  if (regs.fNC) {
    // bit0 == 0 (BOARD 2/4): loc_0478 -- it rrca's the A left here to test bit1.
    // ld a,(0x6227)[13] + rrca[4] + jp nc,0x0478 TAKEN[10] = 27 t
    m.step(0x0478, 27);
    return m.call(0x0478);
  }

  // rrca again -- carry = BOARD bit1.
  regs.rrca();

  if (regs.fC) {
    // bit1 == 1 (BOARD 3): straight to the colour tail, no sprite shift.
    // ...+ jp nc NOT taken[10] + rrca[4] + jp c,0x0486 TAKEN[10] = 41 t
    m.step(0x0486, 41);
    return m.call(0x0486);
  }

  // ld hl,0x690b / ld c,-4 -- offset 10 sprite records by -4 (via rst 0x38 below).
  regs.hl = 0x690b; // sprite-record field inside SPRITE_BUFFER -- stays hex
  regs.c = 0xfc; // -4, the per-record delta loc_0038's add-loop applies
  // ...+ jp c NOT taken[10] + ld hl,0x690b[10] + ld c,0xfc[7] = 58 t (BOARD 1, HOT arm)
  m.step(0x0460, 58);
  m.push16(0x0461); m.step(0x0038, 11); m.call(0x0038); // rst 0x38 = CALL loc_0038

  // jp 0x0486 -- the shared colour tail.
  m.step(0x0486, 10); // jp 0x0486 (total 79 t on this arm)
  return m.call(0x0486);
}
