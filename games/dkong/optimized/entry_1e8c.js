// SPDX-License-Identifier: GPL-3.0-only
/**
 * entry_1e8c — hand-optimized rewrite of the translated routine at ROM 0x1E8C,
 * proven equal to its oracle by the equivalence harness. It is the SECOND guard in
 * loc_197a's per-frame update cascade (`if (!m.call(0x1e8c)) return;`), and it is a
 * CALLER-SKIP guard: it returns a boolean the caller checks (the rst-skip idiom).
 *
 * It reads ONE work-RAM byte (0x6350) and, on the active path, dispatches sub_1e96
 * and then unwinds one stack frame. Both addresses it touches (0x6350, 0x6345) are
 * unevidenced SCRATCH_ placeholders in ram.js, so they are kept hex with comments and
 * this file imports no name.
 */

/**
 * entry_1e8c -- the (0x6350) caller-skip guard at the head of loc_197a's cascade.
 * [ROM 0x1E8C-0x1E93, + its private skip-tail entry_1e94 @ 0x1E94-0x1E95]
 *
 *   1e8c  3a 50 63     ld   a,(0x6350)   ; A = the guard byte
 *   1e8f  a7           and  a            ; test it (Z set iff A == 0)
 *   1e90  c8           ret  z            ; ==0 -> NORMAL return (caller continues)
 *   1e91  cd 96 1e     call 0x1e96       ; !=0 -> run the 0x6345 dispatch, ...
 *   ; ... its `ret` lands at 0x1E94 (the skip-tail), which:
 *   1e94  e1           pop  hl           ;   discards loc_197a's 0x1980 continuation
 *   1e95  c9           ret               ;   returns to loc_197a's CALLER (skip)
 *
 * WHAT IT DOES. entry_1e8c gates a per-frame side-branch on the byte at 0x6350:
 *   - 0x6350 == 0 (the common case; measured always 0 in attract 25m): `ret z` taken.
 *     Control returns NORMALLY to loc_197a @0x1980, which then continues its cascade.
 *     Modelled as returning `true` -- the caller's `if (!m.call(0x1e8c)) return;` sees
 *     `!true` and does NOT abort.
 *   - 0x6350 != 0: `call 0x1e96` runs the rst-0x28 dispatch on 0x6345 (-> one of
 *     0x1EA0 / 0x1F09 / 0x1F23). When that subtree returns, it lands on the pushed
 *     address 0x1E94 -- the SKIP-TAIL (`pop hl ; ret`): `pop hl` DISCARDS loc_197a's
 *     own return address 0x1980, and `ret` then returns to loc_197a's CALLER, unwinding
 *     one frame so loc_197a does NOT resume. Modelled as returning `false` -- the caller
 *     sees `!false` and aborts its cascade (it must NOT double-run past 0x1980).
 *
 * This is the same single-frame caller-skip idiom as sub_1e57 / entry_1e94 (docs/02):
 * the callee reaches back over its immediate caller's stack frame and returns to the
 * caller's caller. `call 0x1e96` and the skip-tail are BOTH dispatched through the
 * registry (`m.call`), so they resolve to the oracle or their own optimized rewrites;
 * this routine never inlines them.
 *
 * INPUTS  : RAM 0x6350 (the guard byte); the stack -- loc_197a's return address 0x1980
 *           on top (pushed before the call), and loc_197a's caller's return address
 *           below it (consumed by the skip-tail on the active path). On the active path
 *           also RAM 0x6345 (sub_1e96's dispatch index) and whatever its subtree reads.
 * OUTPUTS : A := (0x6350); F := `and a`'s flags. On the ZERO path: pops 0x1980, PC ->
 *           0x1980, SP += 2 (balanced), returns BOOLEAN true. On the NON-ZERO path: runs
 *           sub_1e96's subtree + the skip-tail (net: two stack frames unwound, PC ->
 *           loc_197a's caller), returns BOOLEAN false. The returned boolean IS the
 *           contract the caller branches on -- it is asserted directly by the tests
 *           (the RAM+reg diff cannot see a JS return value).
 *
 * FLAGS -- nothing droppable; `and a` is KEPT verbatim:
 *   - `ld a,(0x6350)` sets no flags. `and a` writes S/Z/H/P (H:=1, N:=0, C:=0) from A.
 *   - `and a` is BOTH the branch condition (`ret z` reads Z) AND the last flag-writer
 *     before every exit, so its F is the routine's observable exit F on both arms
 *     (the zero-arm `ret` touches no flags; the non-zero arm's `call 0x1e96` sees this
 *     exact F on entry to sub_1e96, which reads none of it before overwriting). It is
 *     therefore observable, not dead -- kept exactly. No flag churn to drop; the
 *     readability win is names, structure, the docstring, and the prologue collapse.
 *
 * CYCLES -- COLLAPSED to one m.step per straight-line run (the routine writes no
 * hardware latch, so no bus cycle pins an intermediate boundary):
 *   - PROLOGUE `ld a,(0x6350)`(13) + `and a`(4) = 17 t, charged once at 0x1E90 (the
 *     `ret z`), immediately before the branch decision.
 *   - ZERO arm: `ret z` taken = 11 t via m.ret -> own total 17 + 11 = 28 t (oracle
 *     13+4+11 = 28).
 *   - NON-ZERO arm: `ret z` not-taken(5) at 0x1E91, then `call 0x1e96`(17) at 0x1E96;
 *     the subtree charges its own total at the identical cumulative cycle (m.call starts
 *     at entry+39 t on both sides), and the skip-tail entry_1e94 charges pop hl(10) +
 *     ret(10) = 20 t. Own (non-subtree) total 17+5+17+20 = 59 t, matching the oracle.
 * Both arm totals equal the oracle's exactly, so the frame's cycle budget -- hence the
 * main-loop spin count 0x6019 (the PRNG entropy) -- is unchanged.
 *
 * REACHABILITY / ATOMICITY (measured -- the oracle docstring's "0x1E96 UNTRANSLATED"
 * note is STALE; sub_1e96 IS translated and the non-zero path runs to completion).
 * entry_1e8c is dispatched by loc_197a from the NMI game-state gameplay path; measured
 * 816x over 1400 attract frames (616x/1200, first entry ~frame 586, once the attract
 * demo starts PLAYING 25m). Every one of those dispatches is on the ZERO path (0x6350
 * is always 0 in attract), so the non-zero arm is covered by SYNTHESIS in the test.
 * It is ATOMIC: every dispatch occurs INSIDE the NMI handler (nmiMask==0 at all 616/616
 * attract entries; outside-NMI 0), where entry_0066 has cleared the NMI mask so the
 * interrupt cannot re-enter -- and correspondingly the NMI's pushed PC NEVER lands in
 * [0x1E8C,0x1E93] (0 landings over 1194 NMIs; 1185 fall in the 0x02BD-0x0372 main-loop
 * band). An atomic byte-exact collapse pushes no mistimed PC and tears no raster, so it
 * passes the STRICT whole-machine gate directly and does NOT need the convergent gate
 * (docs/06: "a byte-exact collapse of an ATOMIC routine passes the ordinary strict
 * gate"). See equivalence-1e8c.test.js.
 *
 * The only stores are the two stack pushes (WORK RAM near the 0x6BFF stack top) -- NOT a
 * tagged hardware latch (0x7800-0f/0x7c00/0x7c80/0x7d00-07/0x7d80-87) -- so no hardware
 * bus cycle is hidden inside the block and there is no write-trace test to add.
 */
export function entry_1e8c(m) {
  const { regs, mem } = m;

  // ld a,(0x6350) + and a -- read the guard byte and test it. `and a` sets Z iff
  // A == 0 and is the routine's exit-flag writer (kept verbatim).
  regs.a = mem.read8(0x6350); // 0x6350: SCRATCH_6350 (guard byte) -- unevidenced, kept hex
  regs.and(regs.a);
  m.step(0x1e90, 17); // ld a,(0x6350) 13 + and a 4, charged before the `ret z`

  // ret z: guard byte == 0 -> NORMAL return. Pop loc_197a's 0x1980 and hand control
  // back so the cascade CONTINUES (true == "do not abort").
  if (regs.fZ) {
    m.ret(11); // ret z taken (11 t)
    return true;
  }

  // Guard byte != 0 -> run the 0x6345 dispatch, then SKIP past loc_197a's continuation.
  m.step(0x1e91, 5); // ret z NOT taken (5 t), falls through

  // call 0x1e96: pushes the return address 0x1E94 (the skip-tail), then dispatches
  // sub_1e96 -- the rst-0x28 jump on 0x6345. Its subtree's `ret` lands on 0x1E94.
  m.push16(0x1e94);
  m.step(0x1e96, 17);
  m.call(0x1e96); // 0x6345 dispatch (registry -> oracle / optimized); return ignored

  // The skip-tail entry_1e94 (`pop hl ; ret`): discard loc_197a's 0x1980 and return
  // to loc_197a's CALLER, unwinding one frame.
  m.call(0x1e94);
  return false; // CALLER-SKIP: loc_197a must NOT continue past 0x1980
}
