// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_1f83 — hand-optimized rewrite of the translated routine at ROM 0x1F83,
 * proven equal to its oracle by the equivalence harness. It is the per-slot head
 * of sub_1f72's object-slot scan and touches ONLY CPU registers (it READS the
 * object record via IX but writes no RAM), so it imports no name from ram.js.
 *
 * Its two exits are TAIL transfers (no push16) into the SCC: the active-slot
 * dispatch loc_1f93 (0x1F93) and the loop tail loc_1f8d (0x1F8D). Both are reached
 * through `m.call`, the routine registry (games/dkong/routines.js), so they resolve
 * to the oracle or to their own optimized rewrites — never inlined here.
 */

// Object-record field offset. IX points at the current object record (0x6700 +
// slot*0x20 in sub_1f72's per-frame scan); ix+0 is its ACTIVE-STATE byte: 1 == an
// active slot to animate, anything else == inactive/empty. Left as a raw offset —
// ram.js names ABSOLUTE addresses, not IX-relative record offsets (same convention
// as branch_1fe5's SLOT_X = 0x03). See the report: no naming candidate.
const SLOT_STATE = 0x00; // ix+0: 1 = active object slot, else inactive

/**
 * loc_1f83 -- test one object slot: dispatch it if active, else skip its 4 buffer
 * bytes and fall into the loop tail.  [ROM 0x1F83-0x1F8C, then into loc_1f8d]
 *
 *   1f83  dd 7e 00      ld   a,(ix+0x00)   ; A = this slot's active-state byte
 *   1f86  3d           dec  a             ; A-1 -> Z iff the slot was active (==1)
 *   1f87  ca 93 1f      jp   z,0x1f93      ; ACTIVE -> loc_1f93 (direction dispatch)
 *   1f8a  2c           inc  l             ; INACTIVE: step the HL cursor over this
 *   1f8b  2c           inc  l             ;   slot's 4-byte buffer -- 3 inc l here,
 *   1f8c  2c           inc  l             ;   the 4th is loc_1f8d's leading inc l
 *   (1f8d)                                ; fall through into loc_1f8d (add ix,de; djnz)
 *
 * ROLE. sub_1f72 (ROM 0x1F72) walks 10 object records at IX=0x6700 (stride DE=0x20),
 * carrying a parallel 4-byte-per-slot cursor in HL (based 0x6980). This routine is the
 * loop body: it reads the record's active-state byte (ix+0) and branches --
 *   - ACTIVE (byte == 1, so dec a sets Z): tail-jump to loc_1f93 (0x1F93), which reads
 *     (ix+1)/(ix+2) and dispatches to one of the five `exx` direction handlers.
 *   - INACTIVE (byte != 1): advance the HL cursor past this slot's 4 buffer bytes and
 *     continue the scan. loc_1f83 does the FIRST THREE `inc l`; the FOURTH is the first
 *     instruction of loc_1f8d (0x1F8D), which loc_1f83 FALLS INTO -- modelled as
 *     `m.call(0x1f8d)` (a fall-through tail transfer with no push16 / no CALL charge),
 *     exactly the oracle's shape. loc_1f8d then does `add ix,de` + `djnz 0x1f83`.
 *   Note `inc l`, NOT `inc hl`: only L advances, so the cursor wraps inside its 0x69xx
 *   page (the same load-bearing detail loc_1f8d documents for the 4th inc l).
 *
 * INPUTS  : IX (current object-record base), L (low byte of the HL buffer cursor).
 *           Neither B (slot counter) nor DE (stride) is read here -- they are consumed
 *           by loc_1f8d. RAM read: (ix+0), the active-state byte.
 * OUTPUTS : A := (ix+0) - 1 (the dec result -- 0 on the active arm). On the INACTIVE
 *           arm, L += 3 (in-page). F, PC, SP (SP unchanged: no push/ret here). Then it
 *           tail-transfers -- to loc_1f93 (0x1F93) on the active arm or loc_1f8d
 *           (0x1F8D) on the inactive arm -- forwarding that callee's (skip-capable)
 *           return value via `return m.call(...)`.
 *
 * FLAGS -- little droppable churn; every flag writer is load-bearing, so all are KEPT:
 *   - `dec a` sets S/Z/H/PV/N from A-1 (carry preserved). Its Z is READ by the branch,
 *     and on the ACTIVE arm `dec a` is also the LAST flag writer before the
 *     m.call(0x1f93) boundary -- so F there IS the dec result and must match (docs/06:
 *     keep the flag-producing op when the branch reads it AND when it is the last writer
 *     before the exit). `dec8` reproduces the Z80 dec flags exactly.
 *   - On the INACTIVE arm the three `inc l` each overwrite S/Z/H/PV (carry preserved),
 *     so the LAST writer before the m.call(0x1f8d) boundary is the 3rd `inc l`; running
 *     `inc8` three times reproduces that exit F (and L) exactly. A is NOT touched by the
 *     inc l's, so it stays (ix+0)-1 at that boundary too.
 *   So A = (ix+0)-1 is preserved on BOTH arms and F is the exact last-writer result --
 *   there is no name/structure-neutral flag to drop. The readability win is the
 *   docstring, the named branch, and the cycle collapse.
 *
 * CYCLES -- COLLAPSED to ONE m.step per branch TOTAL (the routine writes no memory, so
 * no hardware-latch bus cycle pins an intermediate boundary; no 0x7Dxx / 0x7800 write
 * anywhere here):
 *   - ACTIVE arm (Z taken -> loc_1f93): ld a,(ix+0)[19] + dec a[4] + jp z taken[10]
 *     = 33 t, charged once at the branch target 0x1F93, immediately before m.call.
 *   - INACTIVE arm (Z not taken -> loc_1f8d): ld a,(ix+0)[19] + dec a[4] +
 *     jp z not-taken[10] + inc l[4] + inc l[4] + inc l[4] = 45 t, charged once at the
 *     fall-through target 0x1F8D, immediately before m.call.
 * Both totals equal the oracle's exactly (the oracle spreads them across three / six
 * per-instruction m.steps), so the frame's cycle budget -- hence the main-loop spin
 * count 0x6019 (the PRNG entropy) -- is unchanged.
 *
 * REACHABILITY / ATOMICITY (MEASURED -- why the collapse is licensed by the STRICT gate;
 * the oracle docstring's "not yet wired" note is STALE). loc_197a IS dispatched from the
 * NMI game-state gameplay path (nmi.js) and its cascade reaches sub_1f72 -> loc_1f83.
 * Probed over 1400 attract frames: loc_1f83 dispatches 8160x (first entry ~frame 586,
 * once the attract demo starts PLAYING 25m) -- so a whole-machine run exercises it and
 * the strict gate is NON-vacuous, over BOTH arms (inactive slots are the common case;
 * active slots occur as objects animate). It is ATOMIC: every one of the 8160 dispatches
 * occurs INSIDE the NMI handler (io.nmiMask == 0 at 8160/8160; outside-NMI 0), where
 * entry_0066 has cleared the NMI mask so the interrupt cannot re-enter -- and
 * correspondingly the NMI's pushed PC NEVER lands in loc_1f83's body [0x1F83,0x1F93) nor
 * anywhere in the whole SCC (0 landings over 1394 NMIs; all land in the 0x02BD-0x0372
 * main-loop band). Its only two entry paths -- sub_1f72's dispatch and loc_1f8d's djnz --
 * both originate from that NMI cascade, so it is atomic on EVERY call path (docs/06's
 * "check the callers" caution). An atomic collapse pushes no mistimed PC and tears no
 * raster, so it passes the BYTE-EXACT (strict) whole-machine gate directly and does NOT
 * need the convergent gate (docs/06 "a byte-exact collapse of an ATOMIC routine passes
 * the ordinary strict gate"). This matches its SCC neighbour loc_1f8d; the sibling arm
 * branch_1fe5's "NOT atomic / convergent" note predates that measured correction. See
 * equivalence-1f83.test.js.
 */
export function loc_1f83(m) {
  const { regs, mem } = m;
  const stateAddr = (regs.ix + SLOT_STATE) & 0xffff; // ix+0: active-state byte

  // Read the slot's active-state byte and dec it: Z is set iff it was active (== 1).
  // `dec8` sets A and the Z80 dec flags exactly; the branch reads Z, and on the active
  // arm this dec is also the exit F -- so it is kept verbatim, not dropped.
  regs.a = regs.dec8(mem.read8(stateAddr));

  if (regs.fZ) {
    // ACTIVE slot -> loc_1f93 direction dispatch. Collapsed block:
    // ld a,(ix+0)[19] + dec a[4] + jp z taken[10] = 33 t, exit PC 0x1F93.
    m.step(0x1f93, 33);
    return m.call(0x1f93); // TAIL jump (no push16): its ret returns to OUR caller.
  }

  // INACTIVE slot -> step the HL cursor over this slot's 4 buffer bytes. loc_1f83 does
  // the first three inc l (the 4th is loc_1f8d's leading inc l, which we fall into).
  // Each inc8 overwrites F; the 3rd is the exit F. inc l, not inc hl: L wraps in-page.
  regs.l = regs.inc8(regs.l);
  regs.l = regs.inc8(regs.l);
  regs.l = regs.inc8(regs.l);

  // Collapsed block for the inactive arm:
  // ld a,(ix+0)[19] + dec a[4] + jp z not-taken[10] + 3x inc l[4 each] = 45 t,
  // charged at the fall-through target 0x1F8D immediately before the transfer.
  m.step(0x1f8d, 45);
  return m.call(0x1f8d); // FALL-THROUGH tail transfer (no push16): loc_1f8d continues.
}
