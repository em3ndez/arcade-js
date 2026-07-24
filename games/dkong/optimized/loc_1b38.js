// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_1b38 — hand-optimized rewrite of the translated routine at ROM 0x1B38,
 * proven equal to its oracle by the equivalence harness (equivalence-1b38.test.js).
 *
 * One routine per file. Its two tail targets (0x1cf2 = loc_1cf2, the jump-phase
 * handler; 0x1b45 = loc_1b45, the on-ladder "climb up" test) are invoked through
 * `m.call`, the routine registry (games/dkong/routines.js), so each resolves to the
 * oracle or to its own optimized rewrite — never a copy here. No RAM name is imported:
 * 0x6010 is an input port and 0x6215 a per-object state byte, both kept hex with a
 * comment (see the naming candidates reported with this rewrite).
 */

/**
 * loc_1b38 -- the on-ladder input DISPATCH: Down -> jump-phase; else, if Mario is on a
 * ladder, hand off to the "climb up" test; otherwise stand pat.  [ROM 0x1B38-0x1B44,
 * falling into 0x1B45]
 *
 *   1b38  3a 10 60     ld   a,(0x6010)   ; A = this frame's cooked control word (input)
 *   1b3b  cb 5f        bit  3,a          ; test bit 3 = Down held?  (Z := NOT Down)
 *   1b3d  c2 f2 1c     jp   nz,0x1cf2    ; Down held -> jump-phase handler (tail jump)
 *   1b40  3a 15 62     ld   a,(0x6215)   ; A = 0x6215 (Mario's on-ladder / climb flag)
 *   1b43  a7           and  a            ; Z := (0x6215 == 0)
 *   1b44  c8           ret  z            ; not on a ladder -> do nothing this frame
 *   (falls through to 0x1b45 = loc_1b45, the "climb up" input test)
 *
 * WHAT IT DOES. This is the head of the on-ladder input chain inside the player-movement
 * cascade (entry_1ac3, reached from loc_197a, the in-game NMI update). It asks two
 * questions in order:
 *
 *   - ARM A -- Down held (0x6010 bit 3 set): tail-jump to loc_1cf2 (0x1CF2), the
 *     jump/fall-phase handler, which reads the climb/jump timer 0x620F and dispatches
 *     to 0x1d8a (timer running) or the shared body at 0x1d11 (timer expired). The
 *     `jp nz` is a TAIL jump: no return address is pushed, so loc_1cf2's own `ret`
 *     returns to loc_1b38's caller, not here -- modelled as `return m.call(0x1cf2)`.
 *   - Down NOT held: read 0x6215 (Mario's on-ladder flag; nonzero == on a ladder).
 *       - ARM B -- 0x6215 == 0 (not on a ladder): `ret z` -- return up the cascade,
 *         doing nothing this frame.
 *       - ARM C -- 0x6215 != 0 (on a ladder): fall through into loc_1b45 (0x1B45), the
 *         "is Up held?" climb-up test. This is a FALL-THROUGH, modelled as a tail call
 *         `return m.call(0x1b45)` (loc_1b45's / its callee's `ret` returns to loc_1b38's
 *         caller). loc_1b38 established here what loc_1b45 relies on: Down is not held
 *         and Mario is on a ladder.
 *
 * INPUTS  : RAM 0x6010 (input port) bit 3 (Down); RAM 0x6215 (on-ladder flag). The stack
 *           (a caller return address; on ARM A/C the callee's own `ret` returns there).
 * OUTPUTS : on ARM A/C only -- whatever the callee (loc_1cf2 / loc_1b45 and below) leaves
 *           in RAM + registers. Register file on every path: A := 0x6010 on ARM A (bit
 *           3,a does not write A) or := 0x6215 on ARM B/C (the last `ld a` before the
 *           branch), F := the deciding op's flags (see FLAGS), plus SP/PC. No boolean is
 *           returned; the caller (up the entry_1ac3 chain to loc_197a) ignores it, so the
 *           tail jumps' results are inert but `return`ed for hygiene (matches the oracle).
 *
 * FLAGS -- both flag-producing ops are KEPT VERBATIM because each is its arm's decider
 * AND its last flag-writer before the transfer, so the F it leaves must reach the
 * register file the unit gate compares byte-for-byte:
 *   - `bit 3,a` -- decides ARM A's `jp nz`; on the fall-through it is the live F only
 *     until `and a` overwrites it, but it IS the exit F of ARM A (jp/call touch no
 *     flags). Kept as `regs.bit(3, regs.a)`; NOT simplified to `a & 0x08`, since the Z80
 *     BIT op's H=1/N=0 and its S/P/F3/F5 side-effects are observable on ARM A's exit.
 *   - `and a` -- decides ARM B/C's `ret z` and is the exit F of both (ret/call touch no
 *     flags). Kept as `regs.and(regs.a)`.
 * A is likewise left = the last byte loaded (BIT/AND-a do not change A), which the unit
 * gate also checks. There is no dead register churn to drop -- the routine's whole job is
 * to read A and set F twice -- so the readability win is names, structure, and the
 * cycle collapse.
 *
 * CYCLES -- COLLAPSED per doc 06: each executed path's straight-line T-states are folded
 * into ONE charge placed immediately before that arm's control transfer, preserving the
 * oracle's per-arm TOTAL exactly. There are NO writes in loc_1b38 (it only reads 0x6010
 * and 0x6215), so no hardware-latch bus cycle is crossed and a full fold is safe.
 * Per-arm totals (own, i.e. excluding the tail callee):
 *   - ARM A (Down): ld 13 + bit 8 + jp-taken 10                       = 31 t -> 0x1cf2
 *   - ARM B (ret):  13 + 8 + jp-not-taken 10 + ld 13 + and 4 + ret-z-taken 11 = 59 t
 *   - ARM C (fall): 13 + 8 + 10 + 13 + 4 + ret-z-not-taken 5          = 53 t -> 0x1b45
 * (Z80: JP cc always 10 t taken or not; RET cc 11 t taken / 5 t not.)
 *
 * GATE / REACHABILITY (MEASURED). loc_1b38 is ATTRACT-REACHABLE: dispatched ~190x over a
 * ~700-frame attract run (the demo plays 25m). It runs inside the loc_197a / entry_1ac3
 * cascade, which is ATOMIC -- it executes mask-cleared inside the vblank NMI (io.nmiMask
 * == 0 at every dispatch), so the NMI cannot re-enter it and no NMI pushed-PC ever lands
 * in loc_1b38's range; both callers (0x1adc `jp z` and the 0x1b2e store-then-jp) are on
 * that same cascade path. An atomic routine whose collapse preserves each arm's TOTAL
 * pushes no mistimed PC and (having no writes) tears no raster, so it passes the STRICT
 * byte-exact whole-machine gate directly -- and that gate, being timing-sensitive
 * (a wrong total forks the spin-count PRNG 0x6019 / a later NMI's pushed PC), pins the
 * naturally-reached arms' cycle totals for free. The unit tests add full-branch coverage
 * of all three arms with explicit per-arm cycle-total teeth (the arms attract may not
 * reach still get pinned). See equivalence-1b38.test.js.
 */
export function loc_1b38(m) {
  const { regs, mem } = m;

  // Block 1 [0x1b38-0x1b3d]: read the cooked input word, test Down (bit 3).
  regs.a = mem.read8(0x6010); // input port (this frame's control word)
  regs.bit(3, regs.a); // Z := NOT(Down); decides the jp nz. This is ARM A's exit F.

  if (regs.fNZ) {
    // ARM A -- Down held: tail-jump to the jump-phase handler at 0x1cf2.
    // ld(13) + bit(8) + jp-nz-taken(10) = 31 t, PC -> 0x1cf2. No push16 (tail jump):
    // loc_1cf2's own ret returns to OUR caller.
    m.step(0x1cf2, 31);
    return m.call(0x1cf2);
  }

  // jp nz not taken -> fall to 0x1b40. Block 2 [0x1b40-0x1b44]: is Mario on a ladder?
  regs.a = mem.read8(0x6215); // Mario on-ladder / climb flag (nonzero == on a ladder)
  regs.and(regs.a); // Z := (0x6215 == 0); decides the ret z. This is ARM B/C's exit F.

  if (regs.fZ) {
    // ARM B -- not on a ladder: return up the cascade, nothing to do this frame.
    // 13 + 8 + jp-not-taken 10 + 13 + 4 + ret-z-taken 11 = 59 t.
    m.ret(59);
    return;
  }

  // ARM C -- on a ladder, Down not held: fall through into loc_1b45 (the climb-up test).
  // 13 + 8 + 10 + 13 + 4 + ret-z-not-taken 5 = 53 t, PC -> 0x1b45. Tail call: loc_1b45's
  // (or its callee's) ret returns to OUR caller.
  m.step(0x1b45, 53);
  return m.call(0x1b45);
}
