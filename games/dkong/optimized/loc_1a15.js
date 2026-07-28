// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_1a15 — hand-optimized rewrite of the translated routine at ROM 0x1A15,
 * proven equal to its oracle by the equivalence harness.
 *
 * One routine per file. loc_1a15 CALLS NOTHING: after its two stores it falls
 * straight into the shared 0x1A1E `ret` (the state machine's idx0 "no-op ret"),
 * which the oracle models as a plain `m.ret(10)` here — there is no `m.call`, so
 * nothing resolves through the routine registry. Both RAM names it writes —
 * BONUS_EXPIRED_STEP (0x6386) and its sibling delay byte BONUS_EXPIRED_DELAY
 * (0x6387) — are imported from ram.js (see NAMES).
 */

import { BONUS_EXPIRED_STEP, BONUS_EXPIRED_DELAY } from "./ram.js";

/**
 * loc_1a15 -- the bonus-expired state machine's INIT step (idx1).  [ROM 0x1A15-0x1A1D,
 * then FALLS INTO the shared 0x1A1E `ret`]
 *
 *   1a15  af           xor  a            ; A = 0  (and Z=1 -- the routine's LAST flag write)
 *   1a16  32 87 63     ld   (0x6387),a   ; delay counter := 0
 *   1a19  3e 02        ld   a,0x02
 *   1a1b  32 86 63     ld   (0x6386),a   ; BONUS_EXPIRED_STEP := 2  (advance 1 -> 2)
 *   1a1e  c9           ret               ; the shared 0x1A1E `ret` -> back into loc_197a
 *
 * WHAT IT DOES.  0x6386 (BONUS_EXPIRED_STEP) is a tiny 4-state machine
 * (0..3) that the per-frame gameplay cascade loc_197a runs each frame via
 * `ld a,(0x6386) / rst 0x28` at ROM 0x1A07 (entry_1a07). Both bonus-decrement
 * sites set it to 1 the moment the on-screen BONUS reaches 0 (ROM 0x2CE6 board 1 /
 * 0x2FEF boards 2-4), arming the "bonus expired, kill the player" sequence:
 *
 *   state 0  idx0  no-op `ret`                  (0x1A1E -- BONUS still > 0)
 *   state 1  idx1  loc_1a15  <-- THIS routine    INIT: clear the delay, go to state 2
 *   state 2  idx2  loc_1a1f                       DELAY: count 0x6387 down; at 0 -> state 3
 *   state 3  idx3  loc_1a2a                       WAIT+EXIT: when (0x6216)==0, take the death exit
 *
 * As idx1, loc_1a15 is the one-shot INIT: it zeroes the delay counter (0x6387)
 * that state 2 will count down, advances the machine to state 2, and falls into
 * the shared `ret`. The `xor a` supplies BOTH the 0 written to the counter AND
 * the exit flags (below).
 *
 * INPUTS  : none read. It writes two constants (0 and 2) and leaves A = 2.
 * OUTPUTS : RAM 0x6387 := 0 (delay counter) and BONUS_EXPIRED_STEP (0x6386) := 2;
 *           register A := 2, F = the flags of `xor a` (Z=1, parity=1, rest 0 -> 0x44),
 *           B/C/D/E/H/L carried UNCHANGED from entry (loc_1a15 runs only xor/ld,
 *           none of which touch another register). PC = 0x19BF at exit -- the `ret`
 *           pops loc_197a's continuation, so control resumes there, NOT in this
 *           dispatcher. No boolean is returned (the oracle's `m.ret` returns
 *           undefined); loc_197a's caller (entry_1a07) turns that into `true`.
 *
 * NAMES.  0x6386 is BONUS_EXPIRED_STEP (ram.js), imported. 0x6387 is
 *   BONUS_EXPIRED_DELAY (ram.js), also imported: it is the DELAY COUNTER of this same
 *   sequence -- loc_1a15 clears it here and loc_1a1f (state 2) does `dec (0x6387) /
 *   ret nz`, advancing to state 3 only when it underflows to 0 (ROM 0x1A22-0x1A29).
 *   A reviewer re-derived that name against the oracle (this INIT clear at ROM 0x1A16
 *   plus the state-2 countdown), so it is now asserted, not a candidate.
 *
 * FLAGS -- `xor a` is KEPT (not replaced by a plain `regs.a = 0`) because it is the
 *   routine's LAST flag writer: the three instructions after it (`ld (nn),a`,
 *   `ld a,2`, `ld (nn),a`) leave every flag untouched, so the F on return is exactly
 *   `xor a`'s (Z=1, P/V=1, S=H=N=C=0, undocumented F3/F5=0 -> F=0x44). The unit gate
 *   compares the whole register file including F, so dropping that flag would be
 *   caught; there is no dead flag churn to drop.
 *
 * ATOMIC / CYCLES -- COLLAPSED to a SINGLE m.step for the whole body. loc_1a15 is
 *   one straight-line basic block with NO branch: xor a[4] + ld(0x6387),a[13] +
 *   ld a,2[7] + ld(0x6386),a[13] = 37t, exit PC 0x1A1E, then the shared `ret`[10]
 *   (47t total). It runs ONLY from entry_1a07, dispatched by loc_197a, which the
 *   vblank-NMI handler entry_0066 runs with the NMI mask CLEARED (ROM 0x0072 ack,
 *   re-enabled only at the 0x00D6 epilogue) -- so it is non-reentrant and no nested
 *   NMI can land inside loc_1a15 (measured: 158/158 entries with the mask clear).
 *   The routine is therefore ATOMIC and its internal cycle DISTRIBUTION is
 *   unobservable; the TOTAL is still load-bearing (it is part of the NMI handler's
 *   cost, which sets the main-loop spin count that seeds the PRNG), so 37t + 10t is
 *   preserved EXACTLY. Because it is atomic AND the collapse is byte-exact, the
 *   STRICT whole-machine gate proves it (like loc_144f) -- the convergent gate,
 *   which only licenses an interruptible collapse's transient raster tear, is neither
 *   needed nor used (docs/decompiler-pipeline). No hardware (0x7Dxx) write occurs -- both stores are
 *   work RAM -- so there is no bus-cycle boundary to pin and no --writes trace at stake.
 */
export function loc_1a15(m) {
  const { regs, mem } = m;

  // A := 0. `xor a` (not a plain assign) supplies both the zero written to the
  // delay counter AND the routine's exit flags -- it is the LAST flag writer, and
  // the stores + `ld a,2` below touch no flag (see FLAGS).
  regs.xor(regs.a);
  mem.write8(BONUS_EXPIRED_DELAY, regs.a); // delay counter := 0 -- state 2 counts it down (see NAMES)

  // Advance the bonus-expired state machine from 1 (INIT) to 2 (DELAY).
  regs.a = 0x02;
  mem.write8(BONUS_EXPIRED_STEP, regs.a);

  // One collapsed charge: xor a[4] + ld(0x6387),a[13] + ld a,2[7] + ld(0x6386),a[13]
  // = 37t, exit PC 0x1A1E (atomic routine; total preserved, distribution unobservable).
  m.step(0x1a1e, 37);

  // The shared 0x1A1E `ret` (10t): pops loc_197a's continuation, so control resumes
  // there. loc_1a15 has no callee -- there is no fall-through routine, just this ret.
  m.ret(10);
}
