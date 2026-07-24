// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_215f — hand-optimized rewrite of the translated routine at ROM 0x215F,
 * proven equal to its oracle by the equivalence harness. It is a thin PROLOGUE +
 * CALL + TAIL-JUMP: it presets D/A/BC for the difficulty-gated spawn query
 * sub_216d (0x216D), runs it, then unconditionally tail-jumps into the shared
 * object-sprite tail loc_21ba (0x21BA). Both callees dispatch through the routine
 * registry (m.call), so they resolve to the oracle or their own optimized rewrites
 * and are NEVER inlined. No RAM name is imported: loc_215f touches no work RAM of
 * its own (only the CALL's stack push, which m.push16 models) — every address here
 * is a ROM code address, not a data byte, so there is nothing to name.
 */

/**
 * loc_215f -- set up (D = L+5, A = H, BC = 0x0015), call sub_216d, then jp 0x21ba.
 * [ROM 0x215F-0x216C]
 *
 *   215f  7d           ld   a,l          ; A = L
 *   2160  c6 05        add  a,0x05       ; A = L + 5   (sets F -- see FLAGS)
 *   2162  57           ld   d,a          ; D = L + 5
 *   2163  7c           ld   a,h          ; A = H
 *   2164  01 15 00     ld   bc,0x0015    ; BC = 0x0015 (the cpir span sub_216d uses)
 *   2167  cd 6d 21     call 0x216d       ; sub_216d: difficulty/RNG spawn gate
 *   216a  c3 ba 21     jp   0x21ba       ; loc_21ba shared tail (NON-exx'd entry)
 *
 * WHAT IT DOES. loc_215f is one of the object-dispatch branches in the
 * sub_1f72 <-> loc_21ba object-processing SCC. It is reached from shared_1ff6
 * (0x1FF6, the branch_1fe5/1fef tail) on `jp z` when (H & 7) == 3. It hands three
 * live-ins to sub_216d -- D = (L+5), A = H, BC = 0x0015 -- then, whatever sub_216d
 * does, falls into the object-sprite tail loc_21ba.
 *
 * D and A are the search subject for sub_216d's cpir over the 0x6300 table: A (= H)
 * is the byte cpir hunts for; D (= L+5) is the comparison key it laters `cp d`s
 * against the matched record's fields; BC = 0x0015 is both the cpir span (0x15 = 21
 * bytes) and, in the 236e callee, the 0x14->0x15 stride. (The oracle launders A/D/E
 * through sub_236e -- E ends up = H there -- which is why sub_216d reads E for H.)
 *
 * THE 0x216D RETURN CONTRACT -- and why the jp is UNGUARDED. sub_216d is entered
 * with a normal `call` (0x216A pushed as its return). It reaches loc_215f's 0x216A
 * again on BOTH of its outcomes, so the `jp 0x21ba` at 0x216A always runs:
 *   - NORMAL RETURN: any of sub_216d's own `ret`s (ret nz / ret c / ret nc, or the
 *     0x21B2 success tail's ret) pops 0x216A -> PC = 0x216A -> the jp.
 *   - HIDDEN EXIT (the "216d may abort" case): sub_216d first does `call 0x236e`,
 *     and on a cpir MISS sub_236e SPLICES -- `pop hl` discards sub_216d's own return
 *     (0x2170), then its `ret` pops loc_215f's 0x216A -> PC = 0x216A. sub_216d
 *     returns `false`, but loc_215f (like the oracle) does NOT branch on that value:
 *     control is already back at 0x216A, so the jp runs here too.
 * So m.call(0x216d)'s boolean is IGNORED -- this is NOT the caller-skip idiom
 * (`if (!m.call) return`) that entry_30ed uses; here both arms land at the jp and
 * the tail is unconditional. Measured over 1200 attract frames (132 invocations):
 * 101 take the hidden-exit arm, 31 the normal-return arm -- both reach the jp.
 *
 * INPUTS  : registers H, L (the object's packed coords, from shared_1ff6); IX (the
 *           active object record, read by sub_216d and loc_21ba); the object-loop
 *           alternate set (HL'/IX'/DE'/B') that loc_21ba's leading `exx` restores.
 * OUTPUTS : D, A, BC as set here, then whatever sub_216d + loc_21ba + the 0x1f8d
 *           loop continuation leave. loc_215f itself writes NO work RAM (only the
 *           call's stack push). It returns loc_21ba's value up to shared_1ff6, which
 *           threads it through the SCC -- so `return m.call(0x21ba)` is preserved.
 *
 * FLAGS -- the only flag-writer here is `add a,0x05`, and it is kept VERBATIM
 * (`regs.add(0x05)`), which also gives the value D needs -- so keeping the flags is
 * free. Its F is in fact DEAD: the next flag-writer is sub_236e's `cpir`, which
 * overwrites F before any consumer reads it (nothing between the add and the cpir --
 * ld d,a / ld a,h / ld bc / call / push -- reads a flag). But there is no readability
 * win in dropping it, and keeping it makes the routine faithful without leaning on
 * that dead-flag analysis, so it stays. The observable exit F is the callees'.
 *
 * CYCLES -- ONE basic block, ONE collapse. The five straight-line loads
 * (ld a,l 4 + add a,0x05 7 + ld d,a 4 + ld a,h 4 + ld bc,0x0015 10 = 29 t) fold into
 * a single m.step at the block's exit PC 0x2167, the exact oracle sum. loc_215f
 * writes NO memory at all -- no hardware-latch write (0x7800-0f / 0x7c00 / 0x7c80 /
 * 0x7d00-07 / 0x7d80-87) sits anywhere in it -- so there is no bus-cycle boundary to
 * pin and the block folds flat. The CALL and the JP are control-transfer boundaries
 * and are NOT folded across: push16(0x216a) + step(0x216d,17) + call, then
 * step(0x21ba,10) + call, all verbatim. loc_215f has no internal branch, so its OWN
 * charge is a single total: 29 + 17 + 10 = 56 t on every path (the arm difference is
 * entirely inside the callees). Total-preserving, so the main-loop spin count 0x6019
 * (PRNG entropy) is unchanged.
 *
 * GATE / ATOMICITY (MEASURED, not from prose). loc_215f is HOT and ATTRACT-REACHABLE:
 * 132 dispatches over 1200 attract frames (via m.call from shared_1ff6, inside
 * loc_197a's per-frame NMI cascade). It is ATOMIC: io.nmiMask == 0 at 132/132
 * dispatches (the NMI handler cleared the mask, so it cannot re-enter), and the NMI's
 * pushed PC lands in [0x215F,0x216A] 0 times over 1194 NMIs. An atomic routine whose
 * collapse also PRESERVES the exact per-branch total pushes no mistimed PC and tears
 * no raster, so it passes the BYTE-EXACT (STRICT) whole-machine gate directly and does
 * NOT need the convergent gate. The STRICT run exercises BOTH callee arms naturally
 * (101 hidden-exit + 31 normal-return over the 132 invocations); explicit cycle-total
 * teeth (a dropped block charge forks the PRNG) back it up regardless. See
 * equivalence-215f.test.js.
 */
export function loc_215f(m) {
  const { regs } = m;

  // BLOCK [0x215F-0x2166]: ld a,l; add a,0x05; ld d,a; ld a,h; ld bc,0x0015.
  // 4 + 7 + 4 + 4 + 10 = 29 t, exit PC 0x2167 (the `call`). No memory write here,
  // so the block folds flat.
  regs.a = regs.l;
  regs.add(0x05);   // A = L + 5, F set (kept verbatim -- last flag-writer; see FLAGS)
  regs.d = regs.a;  // D = L + 5
  regs.a = regs.h;  // A = H
  regs.bc = 0x0015;
  m.step(0x2167, 29);

  // 2167  call 0x216d -- boundary. Pushes 0x216A (the jp) as sub_216d's return;
  // sub_216d reaches 0x216A on BOTH its normal-return and its 236e hidden-exit,
  // so the boolean is IGNORED (this is NOT a caller-skip guard -- see the header).
  m.push16(0x216a);
  m.step(0x216d, 17);
  m.call(0x216d);

  // 216a  jp 0x21ba -- unconditional tail into the shared object-sprite loop (10 t).
  m.step(0x21ba, 10);
  return m.call(0x21ba);
}
