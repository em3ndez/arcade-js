// SPDX-License-Identifier: GPL-3.0-only
/**
 * sub_2808 — hand-optimized rewrite of the translated routine at ROM 0x2808,
 * proven equal to its oracle by the equivalence harness. It is a thin wrapper
 * around the board-indexed collision query at 0x286f: set up the subject box,
 * run the query, and — only when it found something — decrement the byte at
 * 0x6200. It imports no name from ram.js (naming rule: absolute addresses stay
 * hex with a comment); the two it touches are already named there
 * (0x6200 = MARIO_ACTIVE, 0x6205 = MARIO_Y), reported below rather than dressed
 * in code.
 */

/**
 * sub_2808 -- run the 0x286f collision query for Mario's record; on a nonzero
 * result decrement 0x6200 (MARIO_ACTIVE).  [ROM 0x2808-0x281C]
 *
 *   2808  fd 21 00 62  ld   iy,0x6200   ; 14  IY = Mario's object-record base
 *   280c  3a 05 62     ld   a,(0x6205)  ; 13  A  = (MARIO_Y) -- subject coord
 *   280f  4f           ld   c,a         ;  4  C  = subject coord for the box test
 *   2810  21 07 04     ld   hl,0x0407   ; 10  H=0x04 (Y half-span), L=0x07 (X half-span)
 *   2813  cd 6f 28     call 0x286f      ; 17  board(0x6227)-indexed collision query -> A
 *   2816  a7           and  a           ;  4  test A (A unchanged), set Z
 *   2817  c8           ret  z           ; 11 taken / 5 not -- A==0: nothing found, return
 *   2818  3d           dec  a           ;  4
 *   2819  32 00 62     ld   (0x6200),a  ; 13  MARIO_ACTIVE = A - 1
 *   281c  c9           ret              ; 10
 *
 * WHAT IT DOES. sub_2808 is one link of loc_197a's per-frame NMI update cascade
 * (dispatched at ROM 0x19B3->0x2808). It presents Mario's record as the collision
 * SUBJECT -- IY = 0x6200 (record base), C = the coord at 0x6205, HL = the box
 * half-spans (H=0x04 Y, L=0x07 X) -- and calls sub_286f (0x286f). sub_286f reads
 * the current BOARD (0x6227) and `rst 0x28`-dispatches through the 0x2874 table to
 * the board's collision handler; on board 1 that is sub_2880, which sweeps the
 * 0x6700/0x6400/0x66A0 object tables via entry_2913 (0x2913). The query returns A:
 *   - A == 0  -> nothing in range: `ret z` immediately, 0x6200 UNTOUCHED.
 *   - A != 0  -> a hit (entry_2913 unwinds to 0x2816 with A=1): store A-1 at 0x6200.
 * On board 1 the only nonzero result is entry_2913's A=1, so the store writes 0;
 * the routine is nonetheless a general "if the query fired, tick 0x6200 down by one".
 *
 * sub_286f IS A PLAIN CALL HERE. The oracle does NOT test m.call(0x286f)'s return
 * value, and neither does this rewrite: although sub_286f's deep callee entry_2913
 * uses the sub_0008 skip idiom, its `inc sp` x2 discards only sub_2880's frame and
 * `ret`s back to 0x2816 INSIDE sub_2808 -- it never unwinds past sub_2808. So both
 * arms re-enter sub_2808's body after the call and control is local; there is no
 * caller-skip boolean to honour (contrast sub_2a22, whose callee CAN unwind past it).
 *
 * INPUTS  : RAM 0x6205 (subject coord) and, through sub_286f, 0x6227 (board select)
 *           plus the swept object tables (0x6700/0x6400/0x66A0) and their +0/+3/+5/
 *           +9/+a box fields. The stack carries sub_2808's own return address.
 * OUTPUTS : A (query result, decremented on the hit arm), C=subject coord, IY=0x6200,
 *           HL (as sub_286f left it), F, and -- on the hit arm only -- work RAM 0x6200
 *           = A-1. F, SP, PC all reproduced. IX/DE/B are whatever the callee left.
 *
 * FLAGS. Two flag-setting ops, both reproduced with the SAME regs helpers as the
 * oracle so F is bit-identical: `and a` (regs.and -- sets S/Z/PV, H=1, N=C=0, A
 * unchanged) drives the `ret z`; `dec a` (regs.dec8 -- S/Z/H/PV, N=1, C preserved)
 * on the store arm. Nothing downstream is assumed about a dropped flag: the unit /
 * crafted-entry gates diff the whole register file incl. F, and the NMI pushes AF
 * into diffed RAM, so a wrong F would surface.
 *
 * CYCLES / COLLAPSE. Total-preserving, two folds, the CALL kept verbatim:
 *   - PROLOGUE (0x2808->0x2813), four flag-neutral loads incl. one work-RAM READ
 *     (no latch, no write) -> ONE m.step at exit 0x2813: 14+13+4+10 = 41 t.
 *   - CALL boundary NOT folded across: push16(0x2816) + m.step(0x286f,17) [the
 *     CALL's own 17 t] + m.call(0x286f) [callee cycles charged inside it].
 *   - `and a` kept as its OWN m.step (4 t @ 0x2817): it precedes the `ret z`
 *     branch point, so it cannot fold into either arm.
 *   - Z ARM: m.ret(11) -- `ret z` taken.
 *   - NZ TAIL (0x2818->0x281c): the ret-z-not-taken fall-through (5 t) + dec a
 *     (4 t) + ld (0x6200),a (13 t) are straight-line with only a work-RAM write
 *     (0x6200, NOT a hardware latch) between them -> ONE m.step at exit 0x281c:
 *     5+4+13 = 22 t; then m.ret() (10 t).
 *   Per-branch OWN totals (excluding the callee): Z = 41+17+4+11 = 73 t; NZ =
 *   41+17+4+22+10 = 94 t -- each the exact oracle sum. No hardware-latch write
 *   occurs, so no bus-cycle boundary is pinned.
 *
 * GATE = STRICT byte-exact whole-machine (the routine is ATOMIC), plus crafted-
 * entry branch coverage. MEASURED, not trusted from prose: over 1400 attract
 * frames sub_2808 is dispatched 816x, and at every one io.nmiMask == 0 (816/816 --
 * it runs INSIDE the NMI, where entry_0066 cleared the mask so the interrupt cannot
 * re-enter), and the NMI's pushed PC NEVER lands in [0x2808,0x281C] (0 landings /
 * 1394 NMIs). Atomic + total-preserving => the collapse pushes no mistimed PC, so
 * the byte-exact gate passes over an 800+-invocation window. All 816 natural
 * dispatches take the Z arm (the attract demo never collides here), so the NZ arm's
 * tail collapse is proven by a synthesised crafted entry whose cycle total is pinned
 * against the oracle directly (its only teeth, since no attract frame reaches it).
 * See equivalence-2808.test.js.
 */
export function sub_2808(m) {
  const { regs, mem } = m;

  // PROLOGUE (0x2808->0x2813): IY=record base, C=subject coord, HL=box half-spans.
  // Four flag-neutral loads folded to one charge -- 14+13+4+10 = 41 t, exit 0x2813.
  regs.iy = 0x6200; // Mario's object-record base (ram.js MARIO_ACTIVE)
  regs.a = mem.read8(0x6205); // (MARIO_Y) -- subject coord
  regs.c = regs.a;
  regs.hl = 0x0407; // H=0x04 (Y half-span), L=0x07 (X half-span)
  m.step(0x2813, 41);

  // call 0x286f -- pushes 0x2816, charges the CALL's 17 t, then runs the board-
  // indexed collision query. PLAIN call: its deep skip-idiom callee unwinds only to
  // 0x2816 (back inside us), never past sub_2808, so there is no boolean to test.
  m.push16(0x2816);
  m.step(0x286f, 17);
  m.call(0x286f);

  // and a -- A unchanged, sets Z. Its own charge (4 t): it gates the branch below.
  regs.and(regs.a);
  m.step(0x2817, 4);
  if (regs.fZ) {
    m.ret(11); // ret z -- query found nothing; 0x6200 left untouched.
    return;
  }

  // NZ tail (0x2818->0x281c): ret-z-not-taken(5) + dec a(4) + ld(0x6200),a(13) = 22 t.
  regs.a = regs.dec8(regs.a);
  mem.write8(0x6200, regs.a); // MARIO_ACTIVE = A - 1 (work RAM, not a latch)
  m.step(0x281c, 22);
  m.ret();
}
