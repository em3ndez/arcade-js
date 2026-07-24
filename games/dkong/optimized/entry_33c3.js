// SPDX-License-Identifier: GPL-3.0-only
/**
 * entry_33c3 — hand-optimized rewrite of the translated routine at ROM 0x33c3,
 * proven equal to its oracle by the equivalence harness. A tiny BOARD-gated wrapper
 * around entry_2333 (the coordinate clamp/step): on the 25m board it loads a three-byte
 * object field triple into H/L/B, runs entry_2333 (which returns a stepped/clamped L),
 * and stores that L back; on any other board it early-returns untouched. It imports the
 * one evidenced name it uses, BOARD (0x6227); the object-record fields stay hex offsets
 * (the record-offset trap — their meaning is entry_2333's, interpreted there, not here).
 */

import { BOARD } from "./ram.js";

/**
 * entry_33c3 -- if BOARD(0x6227) == 1, step object field (ix+0x0f) via entry_2333
 * and store it; otherwise return with the object untouched.  [ROM 0x33C3-0x33D8]
 *
 *   33c3  3a 27 62     ld   a,(0x6227)    ; A = BOARD
 *   33c6  fe 01        cp   0x01
 *   33c8  c0           ret  nz            ; BOARD != 1 (not 25m) -> return, no field work
 *   33c9  dd 66 0e     ld   h,(ix+0x0e)
 *   33cc  dd 6e 0f     ld   l,(ix+0x0f)   ; HL = (ix+0x0e):(ix+0x0f)
 *   33cf  dd 46 0d     ld   b,(ix+0x0d)
 *   33d2  cd 33 23     call 0x2333        ; entry_2333 -> returns a stepped/clamped L
 *   33d5  dd 75 0f     ld   (ix+0x0f),l   ; store the returned L back into the record
 *   33d8  c9           ret
 *
 * WHAT IT DOES. entry_2333 (ROM 0x2333, a <0x3000 coordinate clamp/step) takes H, L and
 * B and returns a modified L: L is nudged +1/-1 (or left alone) according to (H & 0x0F),
 * B, and L's own position, with special handling at the 0x4C and 0xF0 rails. entry_33c3
 * is the caller that aims that step at ONE object record: it copies the record's +0e/+0f/+0d
 * bytes into H/L/B, calls entry_2333, and writes the returned L back to +0f. So +0f is the
 * stepped coordinate; +0e / +0d are the direction/mode inputs entry_2333 reads. It is BOARD
 * -GATED: the whole field step only runs on BOARD == 1 (25m girders). On any other board it
 * returns immediately with A = BOARD and the object untouched. IX is live-in (the record base,
 * set by the caller); this routine reads three of its bytes and writes one.
 *
 * SHARED TAIL WITH entry_33ad (unchanged by this rewrite). entry_33ad does its own +07/+0e
 * field work, then FALLS THROUGH into 0x33C3 (modelled in the oracle as `return m.call(0x33c3)`
 * with no frame of its own), so THIS routine's `ret` ends both. That fall-through resolves
 * 0x33c3 through the routine registry, so once this optimized version is registered it is what
 * runs on the fall-through path too. entry_33ad is not touched here.
 *
 * INPUTS  : RAM BOARD(0x6227); IX = an object record base, of which +0d/+0e/+0f are read.
 *           The stack carries entry_33c3's caller-return address (the two rets pop it). entry_2333
 *           is invoked through m.call (the registry -> oracle, or its own optimized rewrite).
 * OUTPUTS : BOARD != 1 arm -- no RAM change; A = BOARD, F = flags of `cp 0x01`, HL/B/IX
 *           untouched, pc = the popped caller address, SP balanced (one frame consumed).
 *           BOARD == 1 arm -- (ix+0x0f) := entry_2333's returned L; A/HL/B/F are entry_2333's
 *           (the store is flag-neutral, so exit F = entry_2333's exit F), pc = the popped caller,
 *           SP balanced.
 *
 * FLAGS -- `cp 0x01` is kept VERBATIM (regs.cp): the `ret nz` branch reads its Z bit, and on the
 * early-ret arm it is also the last flag-writer before the exit, so the observable exit F must be
 * exactly its result (the unit gate compares the whole F, incl. F3/F5). `ld a,(0x6227)` is likewise
 * kept: on the early-ret arm A = BOARD is the observable exit A. On the BOARD==1 arm both A and F
 * are overwritten by entry_2333 before any exit, but the ops still run for the branch/early-ret arm,
 * so nothing is dropped. The three `ld` from IX and the store are flag-neutral; entry_2333 sets its
 * own A/F. Net: no flag work is droppable here -- the win is names, structure and the cycle collapse.
 *
 * CYCLES -- COLLAPSED per basic block, EXACT per-arm total; the CALL boundary is NOT folded across
 * and every `ret` is kept. No hardware-latch write occurs anywhere (0x6227 and the +0d/+0e/+0f record
 * bytes are WORK RAM 0x60xx-0x6Fxx, explicitly NOT a tagged latch), so no hidden bus cycle is moved.
 *   - Prologue block  ld a,(0x6227) (13) + cp 0x01 (7)                        = 20 t  @0x33C8
 *   - BOARD != 1 arm  ret nz taken (11)                                       -> OWN total 31 t
 *   - BOARD == 1 arm  ret-nz-not-taken (5) + ld h (19) + ld l (19) + ld b (19) = 62 t  @0x33D2
 *                     then CALL 0x2333 [push16 + m.step(17) + m.call] (boundary, callee excluded),
 *                     then ld (ix+0x0f),l (19) @0x33D8 + ret (10)             -> OWN total 128 t
 *   Per-arm OWN totals (callee entry_2333 excluded, charged inside it): 31 t / 128 t -- the exact
 *   oracle sums (13+7+11 ; 13+7+5+19+19+19+17+19+10). Because the total per arm is preserved, the
 *   main loop's spin count (0x6019, the PRNG entropy) is unchanged.
 *
 * GATE -- STRICT byte-exact whole-machine (no convergent gate needed): entry_33c3 is ATOMIC.
 * MEASURED over a 1400-frame attract run: dispatched 204x, io.nmiMask == 0 at 204/204 (every call
 * INSIDE the vblank NMI, whose entry_0066 cleared the mask so it cannot re-enter; outside-NMI 0),
 * and the NMI's pushed PC NEVER lands in the interleaved 33c3/33ad body [0x33AD,0x33E5] -- 0 landings
 * over 1394 NMIs, and 0 anywhere in the 0x3000-0x34FF chain (all landings fall in the 0x02BD-0x0372
 * main-loop band). Atomic + total-preserving => byte-exact, so the strict gate passes. (The oracle
 * docstring's "not yet wired / nothing invokes it" note is STALE -- it is reached via loc_197a's NMI
 * object cascade: entry_30ed -> entry_31b1 -> entry_3202 -> entry_33ad fall-through -> here.)
 *
 * BRANCH COVERAGE -- attract exercises ONLY the BOARD == 1 (continue) arm (all 204 dispatches see
 * 0x6227 == 1: the demo plays 25m). The BOARD != 1 early-ret arm is proven from a crafted
 * identical-both-sides poke (0x6227 != 1) with its exact 31 t total pinned; see equivalence-33c3.test.js.
 */
export function entry_33c3(m) {
  const { regs, mem } = m;
  const rec = (off) => (regs.ix + off) & 0xffff; // object record field, IX live-in

  // Prologue: ld a,(BOARD) (13) + cp 0x01 (7) = 20 t, exit pc 0x33C8 (the `ret nz`).
  regs.a = mem.read8(BOARD);
  regs.cp(0x01); // kept verbatim: `ret nz` reads Z, and it is the early-ret arm's exit F
  m.step(0x33c8, 20);

  if (regs.fNZ) {
    // BOARD != 1: not the 25m board -> return untouched. ret nz taken (11). OWN total 31 t.
    m.ret(11);
    return;
  }

  // BOARD == 1: load the record's field triple and step it via entry_2333.
  // Block: ret-nz-not-taken (5) + ld h,(ix+0x0e) (19) + ld l,(ix+0x0f) (19) + ld b,(ix+0x0d) (19)
  // = 62 t, exit pc 0x33D2 (the `call 0x2333`).
  regs.h = mem.read8(rec(0x0e)); // direction/mode input for entry_2333
  regs.l = mem.read8(rec(0x0f)); // the coordinate to be stepped
  regs.b = mem.read8(rec(0x0d)); // mode/counter input for entry_2333
  m.step(0x33d2, 62);

  // call 0x2333 -- entry_2333 returns a stepped/clamped L. Boundary: NOT folded across.
  m.push16(0x33d5);
  m.step(0x2333, 17);
  m.call(0x2333); // registry -> oracle or optimized entry_2333

  // Store the returned L back into the record, then return. ld (ix+0x0f),l (19) + ret (10).
  mem.write8(rec(0x0f), regs.l);
  m.step(0x33d8, 19);
  m.ret(); // 10 t -- OWN total 128 t
}
