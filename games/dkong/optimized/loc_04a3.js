// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_04a3 — hand-optimized rewrite of the translated routine at ROM 0x04A3,
 * proven equal to its oracle by the equivalence harness.
 *
 * One routine per file. Its two callees (0x0514 sub_0514, 0x04ac loc_04ac) are
 * reached through `m.call`, the routine registry (games/dkong/routines.js), so
 * each resolves to the oracle or to a future optimized rewrite — never a copy.
 * No RAM names are imported: neither address this routine touches (0x75C4 colour
 * RAM, 0x6905 the blink-state byte) is evidenced in ram.js, so both stay hex.
 */

/**
 * loc_04a3 -- write one colour column, then load the blink-state byte.
 * [ROM 0x04A3-0x04AB, then falls into loc_04ac @ 0x04AC]
 *
 *   04a3  21 c4 75   ld   hl,0x75c4    ; colour-RAM column base
 *   04a6  cd 14 05   call 0x0514       ; sub_0514: descending 3-cell fill (A,DE live-in)
 *   04a9  3a 05 69   ld   a,(0x6905)   ; A = blink-state byte
 *   04ac             (falls into loc_04ac)
 *
 * WHAT IT DOES. A small tail helper in the ATTRACT / intro colour-cycle tree
 * (entry_03fb, dispatched every frame by the loc_197a update cascade). It is the
 * shared convergence point loc_0486 routes into -- directly (`jp nz,0x04a3` when
 * bit 6 of the frame counter C is set, A already = 0xEF) or via loc_04a1 (which
 * first sets A = 0x10 and falls straight in). It:
 *   1. points HL at colour-RAM column 0x75C4 and calls sub_0514, which writes
 *      three cells stride DE with values A, A-1, A-2 (the colour bytes for one
 *      column); A and DE are LIVE-IN from the caller (0xEF or 0x10, and 0x0020)
 *      and this routine deliberately does not touch them before the call, then
 *   2. loads the blink-state byte (0x6905) into A and falls into loc_04ac, the
 *      shared store-and-blink-flip tail that writes it back (possibly bit-flipped).
 *
 * INPUTS:  HL is set here; A and DE are consumed by sub_0514 and come from the
 *          caller (via loc_0486: A=0xEF, DE=0x0020; via loc_04a1: A=0x10). C (the
 *          frame counter) is passed through untouched for loc_04ac's bit6 / &7 test.
 * OUTPUTS: three colour-RAM cells from 0x75C4 (via sub_0514); A := (0x6905). The
 *          write-back of 0x6905 and the conditional blink flip happen in loc_04ac.
 *
 * NO HARDWARE-LATCH WRITE of its own. 0x75C4 is colour RAM (0x7400-0x77FF, part of
 * the compared state dump) written by the sub_0514 callee via m.call, and 0x6905 is
 * work RAM only READ here. So there is no bus-cycle-positioned latch write and no
 * write-trace concern in this routine (README hardware-write caveat does not apply).
 *
 * FLAGS. loc_04a3 sets no flag itself; it tail-calls loc_04ac, so its observable
 * "return" is whatever loc_04ac leaves (loc_04ac ends in `ret z` / `ret nz` /
 * `ret`, whose Z/carry the caller of the whole colour tree consumes). sub_0514's
 * call/ret is flag-transparent from loc_04a3's point of view, and the flags it
 * leaves are immediately dead -- overwritten by loc_04ac's `bit 6,c`. Nothing here
 * needs a flag preserved beyond what m.call(0x04ac) already reproduces exactly.
 *
 * CYCLES -- COLLAPSED to one m.step per basic block. loc_04a3 is a LEAF reached via
 * m.call, and by the atomicity-is-per-call-path rule it is NOT atomic: its live
 * caller path is loc_0486 <- loc_0413 <- entry_03fb <- loc_197a, the interruptible
 * per-frame update cascade (NMI mask ENABLED). It also spans a `call` into sub_0514.
 * The vblank NMI can therefore land INSIDE this routine and push a live PC into the
 * diffed stack RAM -- so the collapse is LICENSED by the CONVERGENT gate (docs/decompiler-pipeline),
 * not the strict whole-machine gate. Each block's TOTAL is the oracle's, EXACTLY:
 * Block 1 (ld hl,0x75c4 [10] + call 0x0514's own charge [17]) = 27 t, ending right at
 * the call; Block 2 (ld a,(0x6905) [13], falling into loc_04ac) = 13 t. No writes of
 * its own to fold across (0x75C4 is written by the sub_0514 callee, not here).
 */
export function loc_04a3(m) {
  const { regs, mem } = m;

  // Block 1: ld hl,0x75c4 (10) + call 0x0514's own charge (17) = 27 t, target 0x0514.
  regs.hl = 0x75c4;
  m.push16(0x04a9);
  m.step(0x0514, 27);
  m.call(0x0514);

  // Block 2: ld a,(0x6905) = 13 t -- falls into loc_04ac (store + blink flip).
  regs.a = mem.read8(0x6905);
  m.step(0x04ac, 13);

  return m.call(0x04ac);
}
