// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_1cd2 — hand-optimized rewrite of the translated routine at ROM 0x1CD2,
 * proven equal to its oracle by the equivalence harness (equivalence-1cd2.test.js).
 *
 * One routine per file. Its two callees — entry_2333 (0x2333, the coordinate
 * clamp/step) and loc_1ceb (0x1CEB, the move-timer decrement + tail-jump to 0x1DA6)
 * — are invoked through `m.call`, the routine registry (games/dkong/routines.js), so
 * each resolves to the oracle or to its own optimized rewrite (loc_1ceb already has
 * one) — never a copy here. RAM names come from ram.js (MARIO_X, MARIO_Y, BOARD);
 * this routine does NOT touch 0x620F, so it imports no move-timer name.
 */

import { MARIO_X, MARIO_Y, BOARD } from "./ram.js";

/**
 * loc_1cd2 -- APPLY the pending horizontal step, then (only on the 25m board) clamp
 * Mario's Y against his X before handing off to the move-timer tail.  [ROM 0x1CD2-0x1CF1,
 * falling into loc_1ceb at 0x1CEB]
 *
 *   1cd2  21 03 62     ld   hl,0x6203    ; HL = &MARIO_X
 *   1cd5  7e           ld   a,(hl)       ; A = MARIO_X
 *   1cd6  80           add  a,b          ; A += B  (signed step: +1 / -1(0xFF) / 0)
 *   1cd7  77           ld   (hl),a       ; MARIO_X = A   (store the new X)
 *   1cd8  3a 27 62     ld   a,(0x6227)   ; A = BOARD
 *   1cdb  3d           dec  a            ; Z := (BOARD == 1)
 *   1cdc  c2 eb 1c     jp   nz,0x1ceb    ; BOARD != 1 -> skip the clamp (tail jump)
 *   1cdf  66           ld   h,(hl)       ; HL=0x6203 -> H = MARIO_X (the new X)
 *   1ce0  3a 05 62     ld   a,(0x6205)   ; A = MARIO_Y
 *   1ce3  6f           ld   l,a          ; HL = (MARIO_X << 8) | MARIO_Y
 *   1ce4  cd 33 23     call 0x2333       ; entry_2333: clamp/step -> modified L
 *   1ce7  7d           ld   a,l          ; A = clamped L
 *   1ce8  32 05 62     ld   (0x6205),a   ; MARIO_Y = A   (store clamped Y)
 *   (falls through to 0x1ceb = loc_1ceb)
 *
 * WHAT IT DOES. This is the "commit the move" step of the walk/climb MOVE cluster
 * (reached from loc_1c8f / loc_1cab @0x1CB1 by `jp nz,0x1cd2` when the move-step timer
 * 0x620F is still running). B holds the frame's signed X delta chosen upstream. loc_1cd2:
 *
 *   1. Always adds B to MARIO_X (0x6203) and stores it -- the actual horizontal step.
 *   2. Reads BOARD (0x6227) and tests BOARD == 1 (the 25m girder board):
 *        - ARM 1 -- BOARD != 1 (dec a nonzero): `jp nz,0x1ceb` -- tail-jump straight to
 *          loc_1ceb, skipping the Y clamp (the sloped-girder clamp only applies on 25m).
 *          A TAIL jump: no return address pushed, so loc_1ceb's tail-jump to 0x1DA6
 *          returns up the cascade to loc_1cd2's caller -- modelled `return m.call(0x1ceb)`.
 *        - ARM 2 -- BOARD == 1: build HL = (MARIO_X << 8) | MARIO_Y and CALL entry_2333
 *          (0x2333), the coordinate clamp/step that snaps Y to the girder slope and
 *          returns a modified L; store L back to MARIO_Y (0x6205); then FALL THROUGH into
 *          loc_1ceb (a fall-through, not a call -- modelled `return m.call(0x1ceb)`, no
 *          push16). loc_1ceb decrements the move-step timer and tail-jumps to 0x1DA6.
 *
 * INPUTS  : register B (this frame's signed X delta). RAM MARIO_X (0x6203), BOARD
 *           (0x6227), and on ARM 2 MARIO_Y (0x6205). The stack (a caller return address;
 *           on both arms the tail chain's final `ret`/jp returns there).
 * OUTPUTS : RAM MARIO_X always updated; MARIO_Y updated on ARM 2 (the clamp). Plus
 *           whatever loc_1ceb (and, on ARM 2, entry_2333) leave -- both run LIVE via
 *           m.call, so their full RAM + register effects are the oracle's. Register file
 *           on exit is the tail callee's; loc_1cd2's own contribution is A (= BOARD-1 at
 *           the branch, then = clamped L on ARM 2) and F (= the `dec a` flags at the
 *           branch on ARM 1, = entry_2333's exit F on ARM 2). No boolean returned; the
 *           caller (loc_1c8f/loc_1cab up the cascade) ignores it, so the tail results are
 *           inert but `return`ed for hygiene (matches the oracle).
 *
 * FLAGS -- both flag-producing ops are KEPT VERBATIM:
 *   - `add a,b` computes the new X. Its flags are DEAD -- overwritten by `dec a` before
 *     any read (only two flag-neutral ops, `ld (hl),a` and `ld a,(0x6227)`, sit between)
 *     -- but the helper computes A and F together, and there is no cheaper idiomatic form
 *     that yields A without also risking a wrap/flag slip, so it is left as `regs.add`.
 *   - `dec a` decides ARM 1's `jp nz` AND is ARM 1's exit F (jp/call touch no flags), so
 *     the F it leaves must reach the register file the unit gate compares -- kept as
 *     `regs.dec8`, NOT simplified to `board === 1`, since the DEC's H/N/S/PV and its
 *     carry-preservation are the observable exit F handed to loc_1ceb on ARM 1.
 * A is likewise left = BOARD-1 at the branch (the DEC result), which loc_1ceb preserves
 * into the register file the unit gate checks; on ARM 2 the later `ld a,l` / `ld a,(...)`
 * legitimately overwrite it, matching the oracle.
 *
 * CYCLES -- COLLAPSED per doc 06: each executed path's straight-line T-states are folded
 * into ONE m.step placed immediately before its control transfer, preserving the oracle's
 * per-arm TOTAL exactly. loc_1cd2 performs NO hardware-latch writes -- MARIO_X (0x6203),
 * MARIO_Y (0x6205) and the stack push are all WORK RAM -- so a fold across them is safe;
 * the one boundary that is NOT folded across is the CALL to entry_2333 (its push16 /
 * m.step / m.call stay verbatim, splitting ARM 2 into a pre-call and a post-call segment).
 * Per-arm OWN totals (excluding the callees entry_2333 and loc_1ceb):
 *   - Prologue (shared) [0x1cd2-0x1cdc]: ld 10 + ld 7 + add 4 + ld 7 + ld 13 + dec 4 = 45 t
 *   - ARM 1 (BOARD!=1): prologue 45 + jp-nz-TAKEN 10                         = 55 t -> 0x1ceb
 *   - ARM 2 (BOARD==1): pre-call  = prologue 45 + jp-nz-NOT-taken 5 + ld 7 + ld 13 + ld 4
 *                                   + call 17                                = 91 t -> 0x2333
 *                       post-call = ld a,l 4 + ld (0x6205),a 13              = 17 t -> 0x1ceb
 *                       (own total 108 t, plus entry_2333 charged inside m.call)
 * (Z80/this oracle: JP cc = 10 t taken, 5 t not-taken -- the oracle's split charge, which
 * is what is preserved, not a nominal 10/10.)
 *
 * GATE / REACHABILITY (MEASURED, 1600 attract frames). loc_1cd2 is ATTRACT-REACHABLE:
 * 376 dispatches, ALL on ARM 2 (BOARD==1 -- the demo plays 25m). It runs inside the
 * loc_197a / entry_1ac3 movement cascade, which is ATOMIC: io.nmiMask == 0 at 376/376
 * dispatches (mask-cleared inside the vblank NMI, so the NMI cannot re-enter) and no NMI
 * pushed-PC ever lands in [0x1cd2,0x1cf2) (0/1594 accepted NMIs). Its collapse preserves
 * each arm's TOTAL exactly, so it pushes no mistimed PC; its only writes are work RAM
 * (no raster tear). It therefore passes the STRICT byte-exact whole-machine gate directly
 * (no convergent gate needed). That gate is timing-sensitive -- a wrong total forks the
 * spin-count PRNG (0x6019) / a later NMI's pushed PC -- so it pins ARM 2's total for free.
 * ARM 1 (BOARD != 1) is NOT reached in 25m attract (0/376), so it is proven by a crafted
 * both-sides poke of BOARD with explicit per-arm cycle-total teeth. See
 * equivalence-1cd2.test.js.
 */
export function loc_1cd2(m) {
  const { regs, mem } = m;

  // Block prologue [0x1cd2-0x1cdc]: apply the signed X step, then compute BOARD-1.
  regs.hl = MARIO_X; // ld hl,0x6203
  regs.a = mem.read8(regs.hl); // ld a,(hl)  -- current X
  regs.add(regs.b); // add a,b  -- signed delta (+1 / -1 (0xFF) / 0); flags dead (dec a overwrites)
  mem.write8(regs.hl, regs.a); // ld (hl),a  -- store the new X (work RAM, not a latch)
  regs.a = mem.read8(BOARD); // ld a,(0x6227)
  regs.a = regs.dec8(regs.a); // dec a  -- Z := (BOARD == 1); this IS ARM 1's exit F

  if (regs.fNZ) {
    // ARM 1 -- BOARD != 1: skip the Y clamp, tail-jump to loc_1ceb.
    // Fold: prologue 45 + jp-nz-taken 10 = 55 t, PC -> 0x1ceb. No push16 (tail jump):
    // loc_1ceb's chain returns to OUR caller.
    m.step(0x1ceb, 55);
    return m.call(0x1ceb);
  }

  // ARM 2 -- BOARD == 1 (25m): clamp Y against X via entry_2333, then fall into loc_1ceb.
  regs.h = mem.read8(regs.hl); // ld h,(hl)  -- HL=0x6203, so H = the new MARIO_X
  regs.a = mem.read8(MARIO_Y); // ld a,(0x6205)
  regs.l = regs.a; // ld l,a  -- HL = (MARIO_X << 8) | MARIO_Y

  // call 0x2333 -- push the return address 0x1ce7, then charge the pre-call straight
  // line folded into one m.step: prologue 45 + jp-not-taken 5 + ld h 7 + ld a 13 + ld l 4
  // + call 17 = 91 t, PC -> 0x2333.  The CALL boundary itself is kept verbatim.
  m.push16(0x1ce7);
  m.step(0x2333, 91);
  m.call(0x2333); // entry_2333: clamp/step -> modified L (runs live; register-only)

  regs.a = regs.l; // ld a,l  -- A = clamped L
  mem.write8(MARIO_Y, regs.a); // ld (0x6205),a  -- store clamped Y (work RAM, not a latch)
  // Fold post-call: ld a,l 4 + ld (0x6205),a 13 = 17 t, PC -> 0x1ceb. Fall-through into
  // loc_1ceb (no push16): its tail-jump to 0x1DA6 returns to OUR caller.
  m.step(0x1ceb, 17);
  return m.call(0x1ceb);
}
