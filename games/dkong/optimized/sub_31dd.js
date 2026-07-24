// SPDX-License-Identifier: GPL-3.0-only
/**
 * sub_31dd — hand-optimized rewrite of the translated routine at ROM 0x31dd,
 * proven equal to its oracle by the equivalence harness. It imports one name
 * from ram.js (DIFFICULTY = 0x6380); its two store targets (0x6439 / 0x6479) are
 * write-only SCRATCH placeholders in ram.js, kept hex with a comment per the
 * sub_2a22 / 0x6600 convention (a placeholder name would dress up an unevidenced
 * address). The callee sub_31f6 is invoked verbatim through m.call, so it resolves
 * to its own oracle (or a future optimized rewrite) via the routine registry.
 */

import { DIFFICULTY } from "./ram.js"; // 0x6380

/**
 * sub_31dd -- gate two SCRATCH fields to 2 when DIFFICULTY is in range AND the
 * RANDOM/FRAME predicate (sub_31f6) says 1.  [ROM 0x31DD-0x31F5]
 *
 *   31dd  3a 80 63     ld   a,(0x6380)    ; A = DIFFICULTY
 *   31e0  fe 03        cp   0x03
 *   31e2  f8           ret  m             ; SIGNED bail: (A-3) minus -> return
 *   31e3  cd f6 31     call 0x31f6        ; sub_31f6 -> A (RANDOM&3, or FRAME)
 *   31e6  fe 01        cp   0x01
 *   31e8  c0           ret  nz            ; A != 1 -> return
 *   31e9  21 39 64     ld   hl,0x6439
 *   31ec  3e 02        ld   a,0x02
 *   31ee  77           ld   (hl),a        ; SCRATCH_6439 = 2
 *   31ef  21 79 64     ld   hl,0x6479
 *   31f2  3e 02        ld   a,0x02
 *   31f4  77           ld   (hl),a        ; SCRATCH_6479 = 2
 *   31f5  c9           ret
 *
 * WHAT IT DOES. A three-part gated write. It bails immediately unless DIFFICULTY
 * (0x6380) is signed-nonnegative-and-< 0x83 (the fall-through window [3, 0x82];
 * realistically [3, 5], since sub_30fa clamps DIFFICULTY to [0,5]). It then asks
 * sub_31f6 for a one-byte verdict -- A = RANDOM(0x6018)&3 (0/2/3), or FRAME(0x601a)
 * when that masked value is exactly 1 -- and writes 2 to BOTH scratch fields 0x6439
 * and 0x6479 only when that verdict is 1. Any other verdict returns without writing.
 *
 * THE `ret m` IS SIGNED, NOT `ret c`. It returns on the SIGN of (A-3), so it bails
 * for A < 3 (A-3 borrows to 0xFD/0xFE/0xFF, bit 7 set) AND for A >= 0x83 (A-3 lands
 * in 0x80..0xFC, bit 7 set) -- the latter is where it diverges from `ret c`. `cp
 * 0x03` is kept verbatim: its flags are read by this branch AND, on the bail arm,
 * are the routine's exit F. Likewise `cp 0x01` is kept: read by `ret nz` and the
 * exit F of both the ret-nz arm and the write arm (A is later overwritten to 2, but
 * F is not). Nothing else here reads a flag (the six `ld` and both `ret` are
 * flag-neutral), so no other flag work is preserved.
 *
 * INPUTS  : RAM DIFFICULTY(0x6380); via sub_31f6, RANDOM(0x6018) & FRAME(0x601a).
 *           The stack carries this routine's return address (the two conditional
 *           rets and the final ret all pop it).
 * OUTPUTS : on the WRITE arm, 0x6439 = 0x6479 = 2, with A=0x02 / HL=0x6479 / F from
 *           `cp 0x01` (Z set). On the two bail arms no RAM changes; A/HL are the
 *           callee's (ret-nz) or untouched (ret-m); F is the last `cp`. pc = the
 *           popped return address on every arm; SP balanced (one frame consumed).
 *
 * GATE -- MEASURED ATOMIC, so the STRICT byte-exact whole-machine gate licenses the
 * collapse (no convergent gate needed). Over a 1400-frame attract run sub_31dd is
 * dispatched 266x (first ~frame 870, deep in loc_197a's NMI object cascade
 * entry_30ed -> entry_31b1 -> here), and at 266/266 dispatches io.nmiMask == 0 --
 * every call is INSIDE the NMI handler, whose entry_0066 cleared the mask so the
 * interrupt cannot re-enter. Correspondingly the NMI's pushed PC NEVER lands in
 * [0x31DD,0x31F5] -- 0 landings over 1394 NMIs, and 0 anywhere in the 0x3000-0x34FF
 * chain (all landings fall in the 0x02BD-0x0372 main-loop band). Atomic + total-
 * preserving => byte-exact, so the strict gate passes over the 266-invocation window.
 *
 * COLLAPSE ACCOUNTING (per-arm OWN totals; sub_31f6's own cycles are charged inside
 * it and excluded here). Two straight-line blocks are folded; the CALL boundary and
 * every `ret`/`cp` are kept:
 *   - Block A  `ld a,(0x6380)` (13) + `cp 0x03` (7)               = 20 t  @0x31E2
 *   - Block W  the six writing/loading ops 10+7+7+10+7+7          = 48 t  @0x31F5
 *     (both stores are WORK RAM 0x60xx, NOT tagged hardware latches, so folding
 *      across them moves no hidden bus cycle.)
 *   - kept verbatim: ret m 11/5, call 0x31f6 (push16 + 17 t + m.call),
 *     cp 0x01 (7), ret nz 11/5, final ret (10).
 *   Per-arm OWN totals: arm1 (ret m) 20+11 = 31 t; arm2 (ret nz) 20+5+17+7+11 = 60 t;
 *   arm3 (write) 20+5+17+7+5+48+10 = 112 t. (Whole-run deltas including the callee:
 *   31 / 98 / 167 t, pinned in the branch tests.)
 *
 * BRANCH COVERAGE. Attract naturally exercises ONLY arm1 (all 266 dispatches take
 * `ret m`, because attract runs DIFFICULTY 0-2). Arms 2 and 3 need DIFFICULTY in
 * [3,5] plus a RANDOM/FRAME state attract never reaches, so they are proven by
 * crafted identical-both-sides seeds (DIFFICULTY=4; RANDOM&3=0 -> arm2; RANDOM&3=1 &
 * FRAME=1 -> arm3), each asserted EQUAL over RAM+regs+pc+SP AND pinned to the oracle
 * cycle total -- the mandatory pin for a collapsed, non-whole-machine-covered arm.
 */
export function sub_31dd(m) {
  const { regs, mem } = m;

  // Block A: ld a,(DIFFICULTY) [13] + cp 0x03 [7] = 20 t, exit pc 0x31E2.
  regs.a = mem.read8(DIFFICULTY); // 0x6380
  regs.cp(0x03); // SIGNED gate for `ret m`; also the bail arm's exit F
  m.step(0x31e2, 20);
  if (regs.fM) {
    // ret m -- (A-3) is minus (A < 3 or A >= 0x83). SIGNED, not carry. 11 t.
    m.ret(11);
    return;
  }
  // ret m NOT taken -- fall through. 5 t.
  m.step(0x31e3, 5);

  // call 0x31f6 -- boundary, kept verbatim: push return 0x31E6, charge the CALL's
  // 17 t, then dispatch through the registry (oracle sub_31f6 or its rewrite).
  m.push16(0x31e6);
  m.step(0x31f6, 17);
  m.call(0x31f6); // A <- sub_31f6's verdict; the `cp 0x01` below re-sets the flags

  // cp 0x01 [7] = 7 t, exit pc 0x31E8. Kept verbatim: read by `ret nz` and the exit
  // F of both remaining arms.
  regs.cp(0x01);
  m.step(0x31e8, 7);
  if (regs.fNZ) {
    // ret nz -- verdict != 1. 11 t.
    m.ret(11);
    return;
  }
  // ret nz NOT taken (verdict == 1) -- fall through. 5 t.
  m.step(0x31e9, 5);

  // Block W: the two gated stores + their loads = 48 t, exit pc 0x31F5.
  //   ld hl,0x6439 (10) + ld a,0x02 (7) + ld (hl),a (7)
  //   + ld hl,0x6479 (10) + ld a,0x02 (7) + ld (hl),a (7)
  // Both targets are WORK RAM (ram.js SCRATCH_6439 / SCRATCH_6479, write-only), not
  // hardware latches, so the fold hides no bus cycle. Leave HL/A as the LAST pair set.
  mem.write8(0x6439, 0x02); // SCRATCH_6439 = 2
  mem.write8(0x6479, 0x02); // SCRATCH_6479 = 2
  regs.hl = 0x6479; // final `ld hl,0x6479`
  regs.a = 0x02; // final `ld a,0x02`
  m.step(0x31f5, 48);
  m.ret(); // 10 t
}
