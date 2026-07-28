// SPDX-License-Identifier: GPL-3.0-only
/**
 * sub_3064 — hand-optimized rewrite of the translated routine at ROM 0x3064,
 * proven equal to its oracle by the equivalence harness.
 *
 * A tiny straight-line LEAF: copy one byte from (HL+BC) to (HL+BC+DE), threading
 * HL through two 16-bit adds. Its lone caller is sub_304a (ROM 0x304A), which
 * calls it twice per invocation to slide two tilemap cells one row up in video
 * RAM (HL=0x7600 / 0x75C0, BC=the 0x638E index, DE=0xFFE0 = -0x20 = one 32-col
 * row). No RAM address literal appears here — every access is register-relative,
 * with the base supplied by the caller — so nothing is imported from ram.js and
 * there is no new naming candidate (sub_304a already documents 0x638E).
 */

/**
 * sub_3064 -- copy one byte from (HL+BC) to (HL+BC+DE).  [ROM 0x3064-0x3068]
 *
 *   3064  09           add  hl,bc        ; HL += BC  -> source address
 *   3065  7e           ld   a,(hl)       ; A = (HL+BC)
 *   3066  19           add  hl,de        ; HL += DE  -> destination address
 *   3067  77           ld   (hl),a       ; (HL+BC+DE) = A
 *   3068  c9           ret
 *
 * WHAT IT DOES. Three live-in registers (HL base, BC source offset, DE dest
 * displacement). It reads the byte at HL+BC and stores it at HL+BC+DE, leaving
 * HL = HL+BC+DE. For sub_304a this is `dst = src - 0x20` (DE wraps as -0x20), i.e.
 * a tilemap cell copied one row up; the reads/writes measured under gameplay all
 * land in video RAM (0x75Ax-0x76xx), never a hardware latch.
 *
 * INPUTS  : registers HL, BC, DE; RAM byte at HL+BC.
 * OUTPUTS : A = (HL+BC); HL = HL+BC+DE; RAM byte at HL+BC+DE := A; F (see below);
 *           PC/SP via ret. BC and DE are PRESERVED (sub_304a relies on this to
 *           reuse them across its second call).
 *
 * FLAGS -- KEPT verbatim, not dropped. The two `add hl,rr` are the real HL
 * arithmetic (HL is load-bearing), and their flag effect comes along for free via
 * regs.addHl (H/N/C set, S/Z/PV preserved). The last flag writer is `add hl,de`,
 * so the exit F is its result -- observable (the unit gate compares the whole
 * register file incl. F, and the NMI pushes AF into diffed RAM). Replacing addHl
 * with a plain 16-bit add would leave F stale, so nothing is dropped: this routine
 * is pure register/flag churn with no droppable slack -- the win is the cycle
 * collapse and the behavioural naming, per docs/decompiler-pipeline ("almost no droppable churn").
 *
 * CYCLES -- COLLAPSED. The four instructions form ONE basic block (no branch, no
 * call, no hardware-latch write -- writes are untagged video RAM) and fold to a
 * single m.step at the block-exit PC 0x3068: 11 + 7 + 11 + 7 = 36 t, the exact
 * oracle sum; the `ret` stays a separate boundary (10 t). Total 46 t == oracle.
 *
 * GATE -- STRICT whole-machine (byte-exact), licensed because the routine is
 * ATOMIC and the collapse is measured non-vacuous. MEASURED: under the driven
 * gameplay scenario (coin@400, start@460, right held@900+) sub_3064 dispatches
 * 42x over 1200 frames (0x in plain attract), and io.nmiMask == 0 at 100% of those
 * 42 dispatches -- it runs mask-cleared inside the vblank NMI (the loc_0ae8 /
 * loc_0b06 game-state cascade, like loc_197a), so the NMI can never fire *inside*
 * it and the collapsed block-exit PC is never the value an interrupt would push.
 * Being atomic + total-preserving, the strict per-frame RAM trace is byte-identical
 * to the oracle (verified: equal over 1200 frames, 42 invocations) -- no need for
 * the convergent gate's tear/dead-stack tolerance.
 *
 * FULL-BRANCH COVERAGE -- trivial: straight-line, no data-dependent branch, so its
 * single path is its only path.
 */
export function sub_3064(m) {
  const { regs, mem } = m;

  // One basic block: add hl,bc (11) / ld a,(hl) (7) / add hl,de (11) / ld (hl),a (7).
  regs.addHl(regs.bc); // HL += BC -> source
  regs.a = mem.read8(regs.hl); // A = (HL+BC)
  regs.addHl(regs.de); // HL += DE -> destination (for sub_304a, source - 0x20)
  mem.write8(regs.hl, regs.a); // (HL+BC+DE) = A  -- video RAM, untagged
  m.step(0x3068, 36); // collapsed block total, exit PC 0x3068

  m.ret(); // 3068 -- 10 t
}
