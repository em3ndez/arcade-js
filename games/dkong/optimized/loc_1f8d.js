// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_1f8d — hand-optimized rewrite of the translated routine at ROM 0x1F8D,
 * proven equal to its oracle by the equivalence harness. It is the loop tail of
 * sub_1f72's object-slot scan and manipulates ONLY CPU registers (the scan cursor):
 * it touches no RAM, so it imports no name from ram.js.
 */

/**
 * loc_1f8d -- advance sub_1f72's object-slot scan to the next slot, then loop or return.
 * [ROM 0x1F8D-0x1F92]
 *
 *   1f8d  2c            inc  l             ; 4th of this slot's 4 buffer bytes (HL cursor)
 *   1f8e  dd 19         add  ix,de         ; IX += slot stride (DE = 0x20) -> next record
 *   1f90  10 f1         djnz 0x1f83        ; more slots? re-check the next one (loc_1f83)
 *   1f92  c9            ret                ; all slots scanned -> back to sub_1f72's caller
 *
 * ROLE. sub_1f72 (ROM 0x1F72) walks 10 object records at IX=0x6700 (stride DE=0x20),
 * carrying a parallel 4-byte-per-slot cursor in HL (based 0x6980). loc_1f83 handles
 * each slot and, on the inactive path, does three `inc l`; this routine does the 4th
 * `inc l` -- completing the 4-byte step of the HL cursor. Note `inc l`, NOT `inc hl`:
 * only L advances, so the cursor stays inside its 0x69xx page and wraps there (a
 * load-bearing detail). It then advances IX to the next record and DJNZ-loops back to
 * loc_1f83 until the slot counter B hits 0, then returns.
 *
 * SHARED RE-ENTRY POINT. loc_21ba's `jp 0x1f8d` (0x21CE) also lands here, after one of
 * sub_1f72's five `exx` object handlers has run -- that jump is the loop continuation
 * for an ACTIVE slot. This is why the routine is modelled as a standalone function
 * rather than inlined into loc_1f83's fall-through: both loc_1f83 (inactive slot) and
 * loc_21ba (active slot) re-enter the loop precisely here.
 *
 * INPUTS  : B (slots remaining), IX (current record base), DE (record stride),
 *           L (low byte of the HL buffer cursor) -- the register-state contract of
 *           sub_1f72's loop, set up by sub_1f72 and restored by loc_21ba's leading exx.
 * OUTPUTS : L incremented (in-page wrap), IX += DE, B decremented; F, PC, SP. On the
 *           looping arm it tail-calls loc_1f83 (0x1F83) through the routine registry;
 *           on the final arm it returns to sub_1f72's caller.
 *
 * FLAGS -- both flag-writers are KEPT verbatim; NEITHER is droppable churn:
 *   - `inc l` sets S/Z/H/PV from the new L (carry preserved). `add ix,de` is a 16-bit
 *     ADD, which PRESERVES S/Z/PV (it only writes H/C/F3/F5 and clears N) -- so inc l's
 *     S/Z/PV survive into the routine's exit F. They are OBSERVABLE, not dead.
 *   - `add ix,de` is therefore the last writer of H/C/N/F3/F5 before the ret.
 *   - `djnz` affects NO flags (that is why it is regs.djnz(), not dec8) and branches on
 *     B alone. So the exit F on the ret arm is inc-l's S/Z/PV | add's H/C/N/F3/F5.
 *   There is no name/structure-neutral flag to drop here; the readability win is the
 *   docstring, the named control flow, and the cycle collapse.
 *
 * CYCLES -- COLLAPSED to one m.step per branch TOTAL (the routine writes no memory, so
 * no hardware-latch bus cycle pins an intermediate boundary):
 *   - loop arm (B != 0 after djnz): inc l(4) + add ix,de(15) + djnz taken(13) = 32 t,
 *     charged once at the branch target 0x1F83, immediately before m.call(0x1f83).
 *   - final arm (B == 0): inc l(4) + add ix,de(15) + djnz not-taken(8) = 27 t at 0x1F92;
 *     the `ret` is a separate boundary charged by m.ret (10 t) -> 37 t total.
 * Both totals equal the oracle's exactly, so the frame's cycle budget -- hence the
 * main-loop spin count 0x6019 (the PRNG entropy) -- is unchanged.
 *
 * REACHABILITY / ATOMICITY (why the collapse is licensed and by the STRICT gate). The
 * oracle docstring's "not yet wired" note is STALE: loc_197a IS now dispatched from the
 * NMI game-state-3 gameplay path (nmi.js), and its cascade reaches sub_1f72 -> loc_1f83
 * -> loc_1f8d. Measured: loc_1f8d dispatches 6160x over 1200 attract frames and 4390x
 * over 1600 driven-gameplay frames -- so a whole-machine run exercises it and the strict
 * gate is non-vacuous. It is ATOMIC: every one of those entries occurs INSIDE the NMI
 * handler (in-NMI 6160/6160 and 4390/4390; outside-NMI 0), where entry_0066 has cleared
 * the NMI mask so the interrupt cannot re-enter -- and correspondingly the NMI's pushed
 * PC never lands in [0x1F8D,0x1F92] (0 landings; all landings fall in the 0x02BD-0x0372
 * main-loop band). An atomic collapse pushes no mistimed PC and tears no raster, so it
 * passes the BYTE-EXACT whole-machine gate directly and does NOT need the convergent
 * gate (docs/decompiler-pipeline "a byte-exact collapse of an ATOMIC routine passes the ordinary strict
 * gate"). See equivalence-1f8d.test.js.
 */
export function loc_1f8d(m) {
  const { regs } = m;

  // 4th `inc l` of this slot's 4-byte HL cursor (inc l, NOT inc hl -- L wraps in-page),
  // then advance IX by the slot stride (DE) to the next object record.
  regs.l = regs.inc8(regs.l); // sets S/Z/H/PV (C preserved); its S/Z/PV survive add ix,de
  regs.addIx(regs.de);        // IX += DE; sets H/C/F3/F5, clears N (S/Z/PV preserved)

  // DJNZ: decrement the slot counter (no flags) and loop while slots remain.
  if (regs.djnz() !== 0) {
    m.step(0x1f83, 32);     // 4 + 15 + djnz-taken 13, charged at the branch target
    return m.call(0x1f83);  // re-check the next slot (registry -> oracle / optimized)
  }

  m.step(0x1f92, 27);       // 4 + 15 + djnz-not-taken 8
  m.ret(10);                // ret to sub_1f72's caller (10 t)
}
