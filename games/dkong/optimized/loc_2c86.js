// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_2c86 — hand-optimized rewrite of the translated routine at ROM 0x2C86,
 * proven equivalent to its oracle by the equivalence harness (unit gate + the
 * CONVERGENT whole-machine gate).
 *
 * One routine per file. Its single tail-jump target, loc_2c4f (ROM 0x2C4F), is
 * invoked through `m.call`, the routine registry (games/dkong/routines.js), so it
 * resolves to the oracle or to loc_2c4f's own optimized rewrite — never a copy
 * here. No RAM name is imported: this routine touches only 0x6382, which ram.js
 * still carries as the placeholder SCRATCH_6382, so it stays hex with a comment
 * (see the NAMING note below).
 */

/**
 * loc_2c86 -- the "clear the event flag, take the 0x638F := 3 entry" arm of the
 * BONUS-event state machine.  [ROM 0x2C86-0x2C8E, then TAIL-JUMPS into loc_2c4f]
 *
 *   2c86  af           xor  a               ; loc_2c86  (A = 0)
 *   2c87  32 82 63     ld   (0x6382),a      ; clear the 0x6382 event-flag byte
 *   2c8a  3e 03        ld   a,0x03          ; A = 3
 *   2c8c  c3 4f 2c     jp   0x2c4f          ; TAIL jump into loc_2c4f with A = 3
 *
 * WHAT IT DOES. This is one of the four entry labels that feed the shared body at
 * loc_2c4f. It is reached by `jp nz,0x2c86` from BOTH entry_2c03 (@0x2C20, when
 * bit 1 of 0x6382 is set) and entry_2c41 (@0x2C46, when the freshly mixed random
 * byte & 0x0F is nonzero). Its whole job before the tail jump is two stores:
 *
 *   1. CLEAR 0x6382 to 0 (`xor a; ld (0x6382),a`). This is the exact INVERSE of
 *      entry_2c72 (ROM 0x2C72), which SETs bit 7 of the same byte — the two are the
 *      set/clear pair on this event-flag byte.
 *   2. Enter loc_2c4f with A = 3. loc_2c4f's first act is `ld (0x638f),a`, so this
 *      arm lands 0x638F := 3 while leaving 0x6382 at 0 (contrast the sibling entries:
 *      loc_2c49 -> 0x6382=1/0x638F=2; loc_2c4b -> 0x6382=A/0x638F=A+1). loc_2c4f then
 *      runs the shared gate + free-slot search (0x6392:=1, the (0x62B2)==C gate, and
 *      the scan of the five 0x6400/stride-0x20 records).
 *
 * INPUTS  : none of loc_2c86's OWN logic reads RAM or registers — it is a pure
 *           two-store prologue. (loc_2c4f, reached by the tail jump, consumes C, the
 *           entry_2c03 live-in, and 0x62B2 / the 0x6400 record table.)
 * OUTPUTS : RAM 0x6382 := 0, and control transfers into loc_2c4f with A = 3 (which
 *           then produces loc_2c4f's own effects: 0x638F, 0x6392, the gated RMW of
 *           0x62B2, and possibly entry_2c72). Register file A/F/PC/SP on exit are
 *           loc_2c4f's — see FLAGS below.
 *
 * FLAGS -- the `xor a` at 0x2C86 sets Z/P and clears S/C/H/N, but those flags are
 * DEAD: loc_2c4f re-establishes F before any conditional (its first flag-writer is
 * `cp c` at 0x2C5B, reached with no intervening branch) and F is overwritten on
 * EVERY loc_2c4f exit path (ret-nz via `cp c`; the free-slot exit via the loop's
 * `and a`/`add hl,de`; the entry_2c72 tail likewise). So the flag computation is
 * dropped and A is cleared with a plain `regs.a = 0` — the idiomatic "clear A". The
 * unit gate compares the whole register file (incl. F, F3/F5) after the tail
 * callee, and proves this equal on all four downstream paths.
 *
 * CYCLES -- COLLAPSED. loc_2c86 is one straight-line basic block with no internal
 * branch, so its four per-instruction charges (xor a 4 + ld (nn),a 13 + ld a,n 7 +
 * jp nn 10 = 34 t) fold into ONE m.step(0x2c4f, 34) placed at the jump target,
 * immediately before the tail call — the total is the oracle's exactly, which keeps
 * the main loop's spin count (0x6019, the PRNG entropy) deterministic. The only
 * store is to 0x6382 (WORK RAM, not a 0x7Dxx/0x7Cxx hardware latch), so no bus
 * cycle is pinned and no partial collapse is needed.
 *
 * loc_2c86 is NOT atomic: it is reached only from the interruptible per-frame update
 * cascade loc_197a (via entry_2c03 @ ROM 0x1989, and entry_2c41), the same cascade
 * docs/decompiler-pipeline names as the demonstrated place the vblank NMI lands mid-work. So the
 * collapse is LICENSED by the CONVERGENT gate (equivalence-2c86.test.js uses
 * convergentGate under the ATTRACT scenario, where loc_2c86 naturally dispatches),
 * not the strict byte-exact gate. In practice the collapse is byte-clean in that run
 * (loc_2c86's 34-cycle window is tiny; the NMI never lands inside it), so the gate's
 * tolerance for the mistimed-NMI raster tear / dead-stack PC is headroom, not a
 * relied-on allowance.
 *
 * The `jp 0x2c4f` is a TAIL jump with NO push16: loc_2c4f's own `ret` (or its
 * rst-guard skip) returns to loc_2c86's caller, not to here. `return m.call(0x2c4f)`
 * propagates that (inert to the cascade caller, but kept for hygiene / a future
 * reader). loc_2c4f is left per-instruction in its own file because IT is
 * interruptible too.
 *
 * REACHABILITY NOTE: the frozen-oracle docstring calls this cluster an unreachable
 * frontier ("only caller 0x1989 is itself untranslated"). That is STALE — loc_197a
 * (translated and wired live) calls entry_2c03 at ROM 0x1989, and loc_2c86 dispatches
 * 5x in a 1200-frame attract run. The optimization understands it as reachable; the
 * oracle is not edited (docs/decompiler-pipeline "oracle docstrings can go stale").
 */
export function loc_2c86(m) {
  const { regs, mem } = m;

  // Block (single straight-line, no branch): xor a[4] + ld (0x6382),a[13] +
  // ld a,0x03[7] + jp 0x2c4f[10] = 34 t, exit at the jump target 0x2c4f.
  regs.a = 0x00;            // xor a -- clear A (its flags are dead; loc_2c4f re-sets F)
  mem.write8(0x6382, regs.a); // clear the 0x6382 event-flag byte (inverse of entry_2c72's set-bit-7)
  regs.a = 0x03;           // enter loc_2c4f with A = 3 -> lands 0x638F := 3, 0x6382 stays 0
  m.step(0x2c4f, 34);

  // TAIL jump into loc_2c4f -- NO push16, so loc_2c4f's ret returns to OUR caller.
  return m.call(0x2c4f);
}
