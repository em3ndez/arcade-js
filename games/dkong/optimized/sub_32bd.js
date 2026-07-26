// SPDX-License-Identifier: GPL-3.0-only
/**
 * sub_32bd — hand-optimized rewrite of the translated routine at ROM 0x32bd,
 * proven equal to its oracle by the equivalence harness.
 *
 * A 3-WAY BOARD DISPATCH: reads BOARD (0x6227) once and calls one of three
 * handlers — board 1 -> sub_342c (0x342c), board 2 -> sub_3478 (0x3478),
 * everything else (0 and >= 3, no range check) -> sub_34b9 (0x34b9). Each arm is a
 * real `call` followed by sub_32bd's own `ret`, so whatever the handler leaves in
 * A/F passes straight up. The three handlers are invoked through `m.call` — the
 * routine registry (games/dkong/routines.js) — so each resolves to the oracle or to
 * its own optimized rewrite, never a copy here. The one address literal, 0x6227, is
 * BOARD in ram.js; imported below.
 */

import { BOARD } from "./ram.js";

/**
 * sub_32bd -- dispatch a per-object animation step on the current BOARD.
 * [ROM 0x32BD-0x32D5, 25 bytes]
 *
 *   32bd  3a 27 62     ld   a,(0x6227)     ; A = BOARD
 *   32c0  fe 01        cp   0x01
 *   32c2  ca ce 32     jp   z,0x32ce       ; BOARD == 1 -> sub_342c
 *   32c5  fe 02        cp   0x02
 *   32c7  ca d2 32     jp   z,0x32d2       ; BOARD == 2 -> sub_3478
 *   32ca  cd b9 34     call 0x34b9         ; default -> sub_34b9
 *   32cd  c9           ret
 *   32ce  cd 2c 34     call 0x342c         ; loc_32ce
 *   32d1  c9           ret
 *   32d2  cd 78 34     call 0x3478         ; loc_32d2
 *   32d5  c9           ret
 *
 * WHAT IT DOES. A three-target dispatch keyed on BOARD (0x6227). BOARD is loaded
 * ONCE at 0x32BD; the `cp 0x01` / `cp 0x02` chain both test that same value (`cp`
 * does not touch A and the ROM never reloads it), so the JS reads BOARD once and
 * branches on the plain byte. There is NO range check: any value that is neither 1
 * nor 2 (including 0 and >= 3) falls through to the default handler sub_34b9.
 *
 * Each arm is `call HANDLER` then `ret`. The CALL pushes this routine's own return
 * slot (0x32D1 / 0x32D5 / 0x32CD); the handler's own `ret` pops it and lands back at
 * that slot, where sub_32bd's `ret` pops the CALLER's frame (entry_3202 @ 0x327D) and
 * returns. sub_3478 has NO `ret` of its own -- it tail-jumps into loc_3445, whose
 * `ret` consumes the 0x32D5 pushed here -- so the balance still works out (its tail
 * jump pushes nothing). A/F on exit are the handler's, carried through the trailing
 * `ret` unchanged.
 *
 * INPUTS  : RAM BOARD (0x6227). IX is live-in (the handlers read/write (ix+d) object
 *           fields). The stack: sub_32bd's own return address on top.
 * OUTPUTS : whatever the selected handler produces -- work RAM writes are the
 *           handler's; A/F/regs on return are the handler's, passed through the ret.
 *           SP/PC via the two rets (net: one frame consumed, PC = caller's return).
 *
 * FLAGS -- the two `cp` results are DROPPED. Each `cp` flag is read only by the very
 * next `jp z` (its own dispatch branch), then the selected handler overwrites F
 * before any read (sub_34b9: `ld a,(0x6227)/cp 0x03`; sub_342c/sub_3478: `xor a`) --
 * and the trailing `ret` preserves that handler F to the exit. So no `cp` flag ever
 * escapes; replacing the compare chain with `board === 1` / `board === 2` is exact.
 * A is still set to BOARD (matching the oracle at the call boundary); the handlers
 * do not read incoming A either, but the store is the faithful `ld a,(0x6227)`.
 *
 * CYCLES -- COLLAPSED per doc 06: each arm's fixed decode (the `ld`, the dead `cp`s,
 * and the `jp z`s it passes through) folds into ONE m.step charged at that arm's
 * call-instruction PC; the CALL boundary (push16 + m.step(handler,17) + m.call) and
 * the trailing m.ret (10 t) stay verbatim -- never folded across the call. Per-arm
 * OWN totals (excluding the handler), EXACT oracle sums:
 *   BOARD==1 : 13(ld)+7(cp01)+10(jpz taken)                 = 30, then 17 + 10 = 57 t
 *   BOARD==2 : 13+7+10(jpz nt)+7(cp02)+10(jpz taken)        = 47, then 17 + 10 = 74 t
 *   default  : 13+7+10(jpz nt)+7(cp02)+10(jpz nt)           = 47, then 17 + 10 = 74 t
 * sub_32bd writes NO hardware latch (it writes no RAM at all), so no bus-cycle
 * boundary is pinned; a latch write inside a handler is reached at the exact oracle
 * cycle (the call boundary is preserved), so it is automatically preserved too.
 *
 * GATE -- CRAFTED ENTRY + pinned cycle totals (docs/06), like sub_2a22 / arm_1a4b.
 * sub_32bd's dispatcher is the UNTRANSLATED frontier entry_3202 (reached via the
 * untranslated entry_31b1; "nothing in translated src invokes entry_3202"), so it
 * DISPATCHES 0x -- measured 0 invocations over a 700-frame attract run. A
 * whole-machine / convergent run is therefore vacuous and cannot cover the collapsed
 * total via the PRNG spin count, so equivalence-32bd.test.js seeds the REAL handlers
 * (resolved to the frozen oracle through the registry) on crafted entries and pins
 * each arm's cycle total against the oracle DIRECTLY, with a dropped-charge twin as
 * the teeth. The collapse only redistributes fixed decode cycles; each arm's total is
 * preserved exactly, so total-preservation keeps the main-loop spin count (0x6019,
 * the PRNG entropy) unchanged were it ever reachable.
 *
 * FULL-BRANCH COVERAGE: all three arms (BOARD 1, 2, default) are proven EQUAL and
 * cycle-pinned; the default arm is exercised at BOARD 0 and BOARD 3 (the latter hits
 * sub_34b9's own early `ret z`, a handler branch, not one of sub_32bd's).
 */
export function sub_32bd(m) {
  const { regs, mem } = m;

  const board = mem.read8(BOARD); // ld a,(0x6227)
  regs.a = board; // A holds BOARD at the call boundary (handlers ignore it; faithful)

  if (board === 0x01) {
    // loc_32ce -- BOARD 1: animate via sub_342c.
    m.step(0x32ce, 30); // ld(13) + cp 0x01(7) + jp z taken(10)
    m.push16(0x32d1);
    m.step(0x342c, 17); // call 0x342c
    m.call(0x342c);
    m.ret(); // 0x32d1 -- passes the handler's A/F up
    return;
  }

  if (board === 0x02) {
    // loc_32d2 -- BOARD 2: sub_3478 (no ret of its own; loc_3445's ret consumes 0x32d5).
    m.step(0x32d2, 47); // ld(13)+cp01(7)+jpz nt(10)+cp02(7)+jpz taken(10)
    m.push16(0x32d5);
    m.step(0x3478, 17); // call 0x3478
    m.call(0x3478);
    m.ret(); // 0x32d5
    return;
  }

  // default -- BOARD 0 or >= 3 (no range check in the ROM): sub_34b9.
  m.step(0x32ca, 47); // ld(13)+cp01(7)+jpz nt(10)+cp02(7)+jpz nt(10)
  m.push16(0x32cd);
  m.step(0x34b9, 17); // call 0x34b9
  m.call(0x34b9);
  m.ret(); // 0x32cd
}
