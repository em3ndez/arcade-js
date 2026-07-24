// SPDX-License-Identifier: GPL-3.0-only
/**
 * entry_2b1c — hand-optimized rewrite of the translated routine at ROM 0x2B1C,
 * proven equal to its oracle by the equivalence harness.
 *
 * One routine per file. Its two callees — 0x2b29 (entry_2b29, the player-vs-tilemap
 * collision probe) and 0x29af (sub_29af, the follow-up query) — are invoked through
 * `m.call`, the routine registry (games/dkong/routines.js), so each resolves to the
 * oracle or to its own optimized rewrite, never a copy pasted here. The only absolute
 * address this routine touches is 0x6200, imported from ram.js as MARIO_ACTIVE.
 */

import { MARIO_ACTIVE } from "./ram.js";

/**
 * entry_2b1c -- point IX at Mario's object record, run the collision probe, and (only on
 * its NORMAL return) run the follow-up query and hand A=0/B=0 back.  [ROM 0x2B1C-0x2B28]
 *
 *   2b1c  dd 21 00 62   ld   ix,0x6200    ; IX <- Mario's object-record base
 *   2b20  cd 29 2b      call 0x2b29       ; entry_2b29 -- collision probe (CALLER-SKIP)
 *   2b23  cd af 29      call 0x29af       ; sub_29af   -- follow-up query
 *   2b26  af            xor  a            ; A = 0
 *   2b27  47            ld   b,a          ; B = 0
 *   2b28  c9            ret               ; -> entry_1c05's 0x1C08
 *
 * ROLE. Reached only from entry_1c05 (0x1C05 `call 0x2b1c`), deep in the per-frame
 * airborne-object cascade (loc_197a -> ... -> loc_1bb2 airborne -> loc_1bd8 -> loc_1bec ->
 * entry_1c05). It sets IX to Mario's record base and calls the collision probe entry_2b29.
 *
 * THE CALLER-SKIP CONTRACT (why the routine has two exits, one of which is `return`).
 * entry_2b29 is a CALLER-SKIP routine: on every result but its 0x2B70 `ret z` it executes
 * a `pop hl / ret` (or an entry_2b9b DOUBLE-skip) that discards OUR pushed return (0x2B23)
 * and returns two frames up, PAST entry_2b1c, straight to entry_1c05's 0x1C08. The
 * translation models this as a boolean: `m.call(0x2b29)` returns false on any skip, true
 * only on the normal `ret z`. So `if (!m.call(0x2b29)) return;` -- on a skip the stack was
 * ALREADY unwound by the callee, so we must NOT run our own `ret` (that would double-return
 * past entry_1c05's frame); we just let the JS function return to mirror the unwind.
 *
 * Only the NORMAL (true) return continues here: call sub_29af, then set A=0 and B=0 and
 * `ret` to 0x1C08. entry_1c05 immediately does `dec a` (0x1C09): A=0 -> 0xFF, Z=0, so it
 * does NOT take `jp z,0x1c3a` and enters the live 0x1C0C block.
 *
 * INPUTS  : the stack (entry_1c05's return address 0x1C08 sits below our frame, for the
 *           skip to land on / our `ret` to pop). No register inputs of our own (we OVERWRITE
 *           IX immediately); entry_2b29/sub_29af read absolute work RAM, not our registers.
 * OUTPUTS : IX = 0x6200. On the NORMAL arm additionally A=0, B=0, F = xor-a's result
 *           (Z=1, PV=1 -> 0x44), plus sub_29af's effects; pc/sp via the `ret`. On the SKIP
 *           arm, A/B/F/pc/sp are whatever entry_2b29's skip left (it unwound to 0x1C08).
 *
 * FLAGS. `xor a` is KEPT verbatim -- it is the LAST flag-writer before the `ret` (ld b,a
 * and ret touch no flags), so its F IS this routine's observable exit F on the normal arm.
 * Replacing it with `regs.a = 0` would leave a stale F and the unit gate (which diffs the
 * whole register file incl. F/F3/F5) would catch it. The skip arm writes no flags of ours.
 *
 * CYCLES.
 *   - SKIP arm (natural; 124/124 attract dispatches take it): ld ix (14) + call 0x2b29
 *     (17) = 31 t. Kept BYTE-IDENTICAL to the oracle: the two charges straddle the
 *     push16(0x2b23) stack write, and folding across that work-RAM store would move it
 *     relative to the frame-boundary state capture (state[N] = a RAM dump). So `ld ix`'s
 *     14 t is pinned BEFORE the push, exactly as the oracle charges it -- the same
 *     "each write lands at the oracle's cumulative cycle" discipline the hardware-latch
 *     rule uses, applied to a frame-boundary-visible work-RAM write.
 *   - NORMAL arm (synthesized; see the test's full-branch coverage): 14 + call 0x2b29 (17)
 *     + call 0x29af (17) + [xor a (4) + ld b,a (4)] + ret (10) = 66 t. The ONE collapse is
 *     the register-only `xor a`+`ld b,a` pair -> a single 8 t charge: neither writes RAM,
 *     so no frame boundary between them can diverge, and the routine is atomic so no NMI
 *     lands there. Total per arm equals the oracle's exactly, so the main-loop spin count
 *     (0x6019, the PRNG entropy) is unchanged.
 * The two CALL charges (17 t each) stay verbatim at their call sites so each callee is
 * entered at the oracle's exact cumulative cycle; `push16`/`m.call`/`ret` are kept.
 *
 * REACHABILITY / ATOMICITY (measured, not assumed -- the oracle's "not yet wired" docstring
 * is STALE). entry_2b1c IS dispatched: 124 times over 1300 attract frames (first ~frame 587,
 * once the attract demo is airborne on 25m). It is ATOMIC: every one of those 124 entries
 * occurs INSIDE the NMI handler (io.nmiMask == 0 at entry: 124/124 in-NMI, 0 out-NMI), where
 * entry_0066 has cleared the NMI mask so the interrupt cannot re-enter -- and the NMI's
 * pushed PC never lands in [0x2B1C,0x2B28] (0 landings; all land in the 0x02BD-0x0372
 * main-loop band). Its sole caller entry_1c05 runs only on that in-NMI cascade path. So a
 * correct byte-exact collapse passes the ordinary STRICT whole-machine gate (docs/06); this
 * routine does NOT need the convergent gate. See equivalence-2b1c.test.js.
 */
export function entry_2b1c(m) {
  const { regs } = m;

  // IX <- 0x6200, Mario's object-record base, for the two callees. Charge `ld ix` (14 t)
  // FIRST -- before the push below -- so the stack write lands at the oracle's cumulative
  // cycle and cannot diverge against a frame-boundary state capture.
  regs.ix = MARIO_ACTIVE;
  m.step(0x2b20, 14); // ld ix,0x6200

  // call 0x2b29 -- entry_2b29, the collision probe. CALLER-SKIP: false = it (or its 0x2b9b
  // double-skip) already unwound PAST us to entry_1c05, so we must NOT run our own `ret`.
  m.push16(0x2b23);   // CALL pushes return addr 0x2b23
  m.step(0x2b29, 17); // call 0x2b29 (17 t)
  if (!m.call(0x2b29)) return; // propagate the caller-skip (stack already unwound)

  // Normal (0x2B70 ret z) return: run the follow-up query, then A=0/B=0 back to 0x1C08.
  m.push16(0x2b26);   // CALL pushes return addr 0x2b26
  m.step(0x29af, 17); // call 0x29af (17 t)
  m.call(0x29af);

  regs.xor(regs.a);   // A = 0. KEPT verbatim: last flag-writer before ret -> its F (0x44)
  regs.b = regs.a;    // B = 0  is the observable exit F.
  m.step(0x2b28, 8);  // COLLAPSED: xor a (4) + ld b,a (4) = 8 t (register-only; safe fold)
  m.ret();            // ret to entry_1c05's 0x1C08 (10 t)
}
