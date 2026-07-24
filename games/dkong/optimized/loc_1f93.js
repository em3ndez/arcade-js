// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_1f93 — hand-optimized rewrite of the translated routine at ROM 0x1F93,
 * proven equal to its oracle by the equivalence harness. It is the ACTIVE-SLOT
 * direction dispatch of sub_1f72's object-slot scan, reached from loc_1f83's Z arm
 * (the slot at (ix+0)==1). It only READS the object record via IX and writes no RAM,
 * so it imports no name from ram.js.
 *
 * Its five exits are TAIL transfers (no push16) into the same SCC: the five object-
 * motion handlers at 0x20EC / 0x1FAC (branch_1fac) / 0x1FE5 (branch_1fe5) / 0x1FEF
 * (branch_1fef) / 0x2053, each entered by `jp` in the oracle. All are reached through
 * `m.call`, the routine registry (games/dkong/routines.js), so they resolve to the
 * oracle or to their own optimized rewrites — never inlined here.
 */

// Object-record field offsets. IX points at the current object record (0x6700 +
// slot*0x20 in sub_1f72's per-frame scan). These are ix-relative RECORD fields, so
// they stay raw hex — ram.js names ABSOLUTE addresses, not per-object record offsets
// (the record-offset trap; same convention as loc_1f83's SLOT_STATE = 0x00). See the
// report: neither is a ram.js naming candidate.
const SLOT_TYPE = 0x01; // ix+1: type selector; == 1 dispatches to the 0x20EC handler
const SLOT_DIRBITS = 0x02; // ix+2: direction bitfield; bits 0/1/2 select 1fac/1fe5/1fef

/**
 * loc_1f93 -- dispatch one active object slot on (ix+1)/(ix+2) to one of five `exx`
 * motion handlers.  [ROM 0x1F93-0x1FAB]
 *
 *   1f93  dd 7e 01      ld   a,(ix+0x01)   ; A = (ix+1), the type selector
 *   1f96  3d           dec  a             ; A-1 -> Z iff (ix+1) == 1
 *   1f97  ca ec 20      jp   z,0x20ec      ; TYPE==1 -> handler @0x20EC
 *   1f9a  dd 7e 02      ld   a,(ix+0x02)   ; A = (ix+2), the direction bitfield
 *   1f9d  1f           rra                ; bit0 -> carry
 *   1f9e  da ac 1f      jp   c,0x1fac      ; bit0 set -> branch_1fac
 *   1fa1  1f           rra                ; bit1 -> carry
 *   1fa2  da e5 1f      jp   c,0x1fe5      ; bit1 set -> branch_1fe5
 *   1fa5  1f           rra                ; bit2 -> carry
 *   1fa6  da ef 1f      jp   c,0x1fef      ; bit2 set -> branch_1fef
 *   1fa9  c3 53 20      jp   0x2053        ; bits 0/1/2 clear -> handler @0x2053
 *
 * ROLE. loc_1f83 tail-jumps here when a slot's active-state byte (ix+0) is 1. This
 * routine picks the slot's motion handler: first the (ix+1)==1 special case, then a
 * priority decode of the low three bits of the (ix+2) direction bitfield via three
 * successive `rra` (each shifts the next bit into carry). Every target is one of
 * sub_1f72's five `exx` branches, tail-reached by `jp` -- no push16, so each handler's
 * eventual `ret` returns to sub_1f72's caller, not here. Object fields not interpreted
 * beyond this dispatch (matching the oracle).
 *
 * INPUTS  : IX (current object-record base). RAM read: (ix+1) always; (ix+2) on every
 *           arm except the (ix+1)==1 arm. Incoming carry: threaded into A by the rra's
 *           (see FLAGS) -- observable, so the rra's are kept verbatim.
 * OUTPUTS : A, F (see FLAGS), PC (the chosen tail target), SP unchanged (no push/ret
 *           here -- every exit is a `jp`, modelled as a bare tail `m.call`). It forwards
 *           the callee's (skip-capable) return value via `return m.call(...)`.
 *
 * FLAGS -- every flag writer is load-bearing; all are KEPT verbatim (no droppable churn):
 *   - `dec a` sets S/Z/H/PV/N from (ix+1)-1 (carry preserved). Its Z is READ by the first
 *     branch, and on the (ix+1)==1 arm `dec a` is the LAST flag writer before m.call(0x20ec)
 *     -- so the exit F there IS the dec result and must match.
 *   - each `rra` sets C from A's outgoing bit0, clears H/N, copies F3/F5 from the result,
 *     and PRESERVES S/Z/PV. It also rotates the INCOMING carry into A's bit7, so A after
 *     each rra depends on the carry the caller left -- reproduced exactly by regs.rra()
 *     reading the live carry. The branch reads C; on each bit arm the deciding rra is the
 *     LAST flag writer before that arm's m.call, and on the fall-through (bits 0/1/2 clear)
 *     arm the THIRD rra is the last flag writer before jp 0x2053 (the two `jp`s touch no
 *     flags). So A and F on every arm are the exact oracle values -- nothing to drop.
 *   The readability win is the docstring, the named record fields, the structured decode,
 *   and the cycle collapse (matching SCC siblings loc_1f83/loc_1f8d).
 *
 * CYCLES -- COLLAPSED to ONE m.step per branch TOTAL. The routine writes NO memory (only
 * reads (ix+1)/(ix+2)), so no hardware-latch bus cycle pins an intermediate boundary, and
 * every exit is a tail `jp` (no m.call/push16/ret mid-body) -- so each arm folds to a
 * single charge placed immediately before its transfer. Per-arm totals (each equal to the
 * oracle's exact sum, which the oracle spreads across 3-11 per-instruction m.steps):
 *   - (ix+1)==1  -> 0x20EC : ld(ix+1)[19] + dec[4] + jp z taken[10]                    = 33 t
 *   - bit0 set   -> 0x1FAC : 33 + ld(ix+2)[19] + rra[4] + jp c taken[10]               = 66 t
 *   - bit1 set   -> 0x1FE5 : 66 - 10(bit0 jp not-taken corrects into the tail) ...
 *                            33 + 19 + 4 + jp c NT[10] + rra[4] + jp c taken[10]        = 80 t
 *   - bit2 set   -> 0x1FEF : 80 - ... 33+19+4+10 + rra[4] + jp c NT[10] + rra[4]
 *                            + jp c taken[10]                                           = 94 t
 *   - bits clear -> 0x2053 : 94 + jp c bit2 NT[10] folds with jp 0x2053[10] ...
 *                            33+19+4+10+4+10+4+10 + jp[10]                              = 104 t
 * Both totals equal the oracle's exactly, so the frame's cycle budget -- hence the main-loop
 * spin count 0x6019 (the PRNG entropy) -- is unchanged.
 *
 * REACHABILITY / ATOMICITY (MEASURED -- why the collapse is licensed by the STRICT gate).
 * loc_197a IS dispatched from the NMI game-state gameplay path (nmi.js) and its cascade
 * reaches sub_1f72 -> loc_1f83 -> (active arm) loc_1f93. Probed over 1400 attract frames:
 * loc_1f93 dispatches 2605x (first entry frame 613, once the attract demo starts PLAYING
 * 25m), and ALL FIVE arms fire naturally (bit1 957x, bit2 751x, clear 491x, bit0 229x,
 * (ix+1)==1 177x) -- so the strict gate is NON-vacuous over EVERY arm. It is ATOMIC: every
 * one of the 2605 dispatches occurs INSIDE the NMI handler (io.nmiMask == 0 at 2605/2605;
 * outside-NMI 0), where entry_0066 has cleared the NMI mask so the interrupt cannot
 * re-enter -- and correspondingly the NMI's pushed PC NEVER lands in loc_1f93's body
 * [0x1F93,0x1FAC) (0 landings over 1394 NMIs; all land in the 0x02BD-0x0372 main-loop band
 * plus the thin 0x00xx/0x06xx tail). Its ONLY caller is loc_1f83's active arm, itself
 * atomic on every call path (equivalence-1f83), so loc_1f93 is atomic on every call path.
 * An atomic byte-exact collapse pushes no mistimed PC and tears no raster, so it passes the
 * BYTE-EXACT (strict) whole-machine gate directly (docs/06: "a byte-exact collapse of an
 * ATOMIC routine passes the ordinary strict gate"). This matches SCC neighbours loc_1f83 /
 * loc_1f8d; the oracle docstring's "not yet wired" note is STALE. See equivalence-1f93.test.js.
 */
export function loc_1f93(m) {
  const { regs, mem } = m;
  const ix = regs.ix; // IX is not modified in this routine (no add ix)

  // (ix+1) - 1: Z iff the type selector was 1. `dec8` reproduces the Z80 dec flags
  // exactly; the branch reads Z, and on the taken arm this dec is also the exit F.
  regs.a = regs.dec8(mem.read8((ix + SLOT_TYPE) & 0xffff));
  if (regs.fZ) {
    // TYPE==1 -> handler @0x20EC. Collapsed: ld(ix+1)[19] + dec[4] + jp z taken[10] = 33 t.
    m.step(0x20ec, 33);
    return m.call(0x20ec); // TAIL jump (no push16): its ret returns to OUR caller.
  }

  // Priority-decode the low three bits of the (ix+2) direction bitfield. Each `rra`
  // shifts the next bit out into carry (bit0, then bit1, then bit2) and rotates the
  // incoming carry into bit7 -- so A is threaded through the rotations, reproduced by
  // regs.rra() reading the live carry.
  regs.a = mem.read8((ix + SLOT_DIRBITS) & 0xffff);

  regs.rra(); // bit0 -> carry
  if (regs.fC) {
    // bit0 set -> branch_1fac. 33 + ld(ix+2)[19] + rra[4] + jp c taken[10] = 66 t.
    m.step(0x1fac, 66);
    return m.call(0x1fac);
  }

  regs.rra(); // bit1 -> carry
  if (regs.fC) {
    // bit1 set -> branch_1fe5. + jp c bit0 NT[10] + rra[4] + jp c taken[10] = 80 t.
    m.step(0x1fe5, 80);
    return m.call(0x1fe5);
  }

  regs.rra(); // bit2 -> carry
  if (regs.fC) {
    // bit2 set -> branch_1fef. + jp c bit1 NT[10] + rra[4] + jp c taken[10] = 94 t.
    m.step(0x1fef, 94);
    return m.call(0x1fef);
  }

  // bits 0/1/2 all clear -> handler @0x2053. + jp c bit2 NT[10] + jp 0x2053[10] = 104 t.
  m.step(0x2053, 104);
  return m.call(0x2053);
}
