// SPDX-License-Identifier: GPL-3.0-only
/**
 * entry_1bf2 — hand-optimized rewrite of the translated routine at ROM 0x1BF2,
 * proven equal to its oracle by the equivalence harness.
 *
 * It touches NO absolute RAM address — every store is IX-relative WORK RAM reached
 * through the caller's X helper — so it imports nothing from ram.js. The three write
 * offsets (ix+0x10, ix+0x11, ix+0x07) are per-object RECORD fields, kept hex (the
 * record-offset trap: naming them would mislead, since the same offsets mean different
 * things in other object records).
 *
 * THE X-PASSTHROUGH CONTRACT. entry_1bf2 is a *tail-dispatch* reached from its only
 * caller loc_1bb2 (ROM 0x1BB2, the AIRBORNE handler) via `m.call(0x1bf2, X)`. X is an
 * IX-relative addressing closure — `X(d) = (ix + d) & 0xffff` — that loc_1bb2 built over
 * its OWN IX regime (`ld ix,0x6200`; measured: ix == 0x6200 at 360/360 attract entries).
 * entry_1bf2 NEVER modifies X: it forwards it UNCHANGED to both tail callees
 * (`m.call(0x1c05, X)`, `m.call(0x1bd8, X)`) and uses it for its own three record writes.
 * The signature MUST stay `(m, X)` and thread X verbatim, exactly as the oracle does.
 */

/**
 * entry_1bf2 -- SECOND direction-gate of the airborne (jump/fall) update.
 * [ROM 0x1BF2-0x1C04, tail-jumping to entry_1c05 (0x1C05) or loc_1bd8 (0x1BD8)]
 *
 *   1bf2  1d            dec e              ; E = sub_241f's 2nd gate value (loc_1bb2)
 *   1bf3  c2 05 1c      jp nz,0x1c05       ; E != 1 -> gate ON: dispatch 0x1C05 (2b1c chain)
 *   1bf6  dd 36 10 ff   ld (ix+0x10),0xff  ; else (E was 1 -> 0): set airborne record fields
 *   1bfa  dd 36 11 80   ld (ix+0x11),0x80
 *   1bfe  dd cb 07 be   res 7,(ix+0x07)    ; clear bit 7 of the +0x07 flag field
 *   1c02  c3 d8 1b      jp 0x1bd8          ; -> loc_1bd8 (landing/gravity)
 *
 * WHAT IT DOES. This is the airborne twin of the loc_1af5/loc_1ae6 walk-direction gates
 * one branch over. loc_1bb2 has already `dec d`'d sub_241f's FIRST gate value and, on
 * D != 1, tail-called here. entry_1bf2 now decrements the SECOND gate value E:
 *   - E != 1 on entry (`dec e` -> nonzero, NZ): the direction gate is ON, so hand the
 *     airborne update straight to the 0x1C05 dispatch (entry_1c05 -> 2b1c chain). No
 *     record write happens on this arm.
 *   - E == 1 on entry (`dec e` -> 0, Z): the gate is OFF this frame. Latch the airborne
 *     record: (ix+0x10) = 0xff and (ix+0x11) = 0x80 (a fixed velocity/vector preset),
 *     clear bit 7 of the (ix+0x07) flag field, then jp to loc_1bd8 (landing target via
 *     0x2407 + gravity via 0x239c). loc_1bb2's Z-of-`dec d` arm sets the MIRROR of these
 *     (0x10=0x00, 0x11=0x80, `set 7` instead of `res 7`) before the same 0x1BD8.
 * Both `jp` transfers are TAIL jumps (no push): the callee's own `ret` returns to
 * entry_1bf2's CALLER, so they are `return m.call(...)` here.
 *
 * INPUTS  : E (sub_241f's 2nd direction-gate value, set up the loc_1bb2 chain), X (the
 *           IX-relative address helper loc_1bb2 threads in over ix=0x6200 -- forwarded
 *           unchanged to both callees and used for the three record writes), and the
 *           stack (a caller return address for the tail callee's `ret`). On the Z arm,
 *           the pre-existing byte at X(0x07) (its bit 7 is cleared, other bits kept).
 * OUTPUTS : E decremented; F set by `dec e`. On the Z arm: X(0x10)=0xff, X(0x11)=0x80,
 *           X(0x07) with bit 7 cleared. Then the tail callee's full effects. PC/SP move
 *           via the tail call.
 *
 * NAMES. No naming candidate: the routine reads/writes no ABSOLUTE address -- only
 * register E and the IX-relative record fields (0x10/0x11/0x07), which are per-object
 * offsets that stay hex (the record-offset trap). Nothing is imported from ram.js.
 *
 * FLAGS -- the one flag-writer, `dec e`, is KEPT verbatim (regs.dec8): it is BOTH the
 * gate value's decrement (E is threaded onward to the callees) AND the branch condition
 * (Z/NZ selects the arm), so there is nothing to drop. `res`/`ld` do not touch flags on
 * the Z80, so on the Z arm the exit F is `dec e`'s flags -- preserved bit-for-bit by
 * using regs.dec8. There is essentially NO droppable flag churn here; the readability win
 * is the named intent, the flat early-return control flow (vs the oracle's nested
 * if/else), the docstring, and the cycle collapse below.
 *
 * CYCLES -- COLLAPSED to ONE m.step per branch TOTAL. The three writes on the Z arm are
 * all IX-relative WORK RAM (ix=0x6200 -> 0x6210/0x6211/0x6207, the 0x62xx region), NOT
 * hardware latches (0x78xx / 0x7C00 / 0x7C80 / 0x7Dxx), so NO bus-cycle boundary pins an
 * intermediate cycle and the whole arm folds to a single charge at its exit PC:
 *   - gate-ON arm  (E != 1): dec e(4) + jp nz taken(10)                        = 14 t, exit 0x1C05.
 *   - gate-OFF arm (E == 1): dec e(4) + jp nz NOT-taken(5) + ld(ix+0x10)(19)
 *                            + ld(ix+0x11)(19) + res 7,(ix+0x07)(23) + jp(10)   = 80 t, exit 0x1BD8.
 * These totals equal the oracle's EXACTLY (sum of its per-instruction m.step charges).
 *
 *   ** The gate-OFF arm charges the not-taken `jp nz` as 5 t, not textbook Z80's 10 t --
 *   this MATCHES THE ORACLE (its `m.step(0x1bf6, 5)`), and loc_1bb2's identical mirror
 *   arm does the same (`m.step(0x1bcc, 5)`). Do NOT "correct" it to 10 t; the load-bearing
 *   invariant is the arm's 80 t total, preserved exactly. ** Preserving each branch total
 *   keeps the frame's cycle budget -- hence the main-loop spin count 0x6019 (the PRNG
 *   entropy) and where a later NMI's pushed PC lands -- unchanged.
 *
 * REACHABILITY / ATOMICITY (measured; why the collapse is licensed under the STRICT
 * gate). entry_1bf2 is dispatched from the per-frame movement cascade under loc_197a
 * (loc_197a -> entry_1ac3 -> loc_1bb2[airborne, 0x6216==1] -> entry_1bf2). Probed over
 * attract: 360 entries in 5000 frames (83 by frame 1200). It is ATOMIC: every one of the
 * 360 entries occurs with io.nmiMask CLEARED -- i.e. INSIDE the vblank NMI (360/360
 * in-NMI, 0 out), where the handler cleared the mask on entry so the NMI cannot re-enter
 * -- and ix is 0x6200 at every entry (so the three writes are 0x62xx work RAM). So the
 * older "loc_197a cascade is interruptible" docstrings are STALE for this routine: no NMI
 * lands inside it, an atomic collapse pushes no mistimed PC and tears no raster, and it
 * passes the BYTE-EXACT whole-machine gate directly (no convergent gate needed). See
 * equivalence-1bf2.test.js.
 *
 * Only the gate-ON arm (E != 1 -> 0x1C05) is reached naturally in attract (360/360); the
 * gate-OFF arm (E == 1) is never dispatched in attract, so the test SYNTHESISES it with
 * cycle teeth and explicit record-write assertions (docs/06 full-branch coverage).
 */
export function entry_1bf2(m, X) {
  const { regs, mem } = m;

  // dec e: decrement sub_241f's 2nd direction-gate value (E is threaded onward);
  // kept verbatim -- it is both the decrement and the Z/NZ branch condition.
  regs.e = regs.dec8(regs.e);
  if (regs.fNZ) {
    // gate ON (E was != 1): hand the airborne update to the 0x1C05 dispatch. No write.
    m.step(0x1c05, 14); // dec e(4) + jp nz,0x1c05 taken(10)
    return m.call(0x1c05, X); // X threaded UNCHANGED
  }

  // gate OFF (E was 1 -> 0): latch the airborne record, then jp to loc_1bd8.
  // All three stores are IX-relative WORK RAM -> collapsible in one block.
  mem.write8(X(0x10), 0xff); // ld (ix+0x10),0xff
  mem.write8(X(0x11), 0x80); // ld (ix+0x11),0x80
  mem.write8(X(0x07), regs.res(7, mem.read8(X(0x07)))); // res 7,(ix+0x07)
  m.step(0x1bd8, 80); // dec e(4)+jp nz nt(5)+ld(19)+ld(19)+res(23)+jp(10)
  return m.call(0x1bd8, X); // X threaded UNCHANGED
}
