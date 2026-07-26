// SPDX-License-Identifier: GPL-3.0-only
/**
 * sub_342c — hand-optimized rewrite of the translated routine at ROM 0x342c,
 * proven equal to its oracle by the equivalence harness.
 *
 * A per-object ANIMATION-TABLE STEPPER: one entry of the table at 0x3A8C is consumed
 * per call. Every field it touches except that one ROM literal is an IX-relative
 * object-record offset — the saved 16-bit table pointer (ix+0x1a):(ix+0x1b) and the
 * frame/index byte (ix+0x03) — so it imports NO name from ram.js. Those record offsets
 * stay hex (the record-offset trap: an ix+d displacement is a field within a record,
 * not a global address to name). The one absolute address, 0x3A8C, is a ROM table base
 * (not RAM), kept hex with a comment.
 */

/**
 * sub_342c -- step the object's animation-table pointer one entry.  [ROM 0x342C-0x3477,
 * 26 instructions; FALLS THROUGH into the shared loc_3445 tail]
 *
 *   342c  dd 6e 1a     ld   l,(ix+0x1a)     ; reload the saved table pointer (lo)
 *   342f  dd 66 1b     ld   h,(ix+0x1b)     ;                               (hi)
 *   3432  af           xor  a               ; A = 0 AND carry CLEARED
 *   3433  01 00 00     ld   bc,0x0000
 *   3436  ed 4a        adc  hl,bc           ; 16-bit ZERO TEST on HL (Z iff ptr == 0)
 *   3438  c2 42 34     jp   nz,0x3442       ; ARM A: pointer already established
 *   343b  21 8c 3a     ld   hl,0x3a8c       ; ARM B (first call): point at the table
 *   343e  dd 36 03 26  ld   (ix+0x03),0x26  ;                     seed the frame byte
 *   3442  dd 34 03     inc  (ix+0x03)       ; loc_3442 -- SHARED: advance the frame byte
 *   (falls through into loc_3445 -- the shared table-walk / finalize tail)
 *
 * WHAT IT DOES. The saved animation-table pointer lives in (ix+0x1a):(ix+0x1b). On the
 * FIRST call for this object it is zero (ARM B): HL is pointed at the ROM table 0x3A8C
 * and the frame byte (ix+0x03) is seeded to 0x26. On EVERY call (both arms) the frame
 * byte is then incremented, and loc_3445 stores the current table entry into (ix+0x05)
 * and advances/saves the pointer -- or, on the 0xAA terminator, finalizes the record.
 * Table contents / field meanings are not interpreted here (the oracle leaves them so).
 *
 * WHY adcHl, NOT addHl -- the load-bearing subtlety. `xor a` clears carry and zeroes A;
 * `ld bc,0`; `adc hl,bc` then computes HL + 0 + 0 = HL *purely to set Z from the 16-bit
 * result*. `add hl,bc` PRESERVES Z (it would leave Z = 1 from the `xor a`) and so would
 * take ARM B every time -- the branch depends on adc's Z. adcHl is kept verbatim; HL is
 * unchanged by it (ARM A therefore keeps the saved pointer in HL).
 *
 * GATE -- STRICT (byte-exact whole-machine). REACHABILITY MEASURED, and the oracle
 * docstring's "not yet wired into the live dispatcher / caller 0x32BD untranslated" note
 * is STALE: sub_342c IS dispatched live via entry_3202 -> sub_32bd (0x32CE, on BOARD
 * (0x6227) == 1). Probed over 1600 attract frames:
 *   - 32 dispatches (matching sub_32bd's 32) -> the whole-machine strict gate is
 *     NON-vacuous, and BOTH arms occur naturally (ARM A x31 established, ARM B x1 first).
 *   - io.nmiMask == 0 at 32/32 dispatches: it runs mask-cleared inside the vblank NMI
 *     (which cannot re-enter) and its only callee is the leaf tail loc_3445.
 *   - the NMI's pushed PC NEVER lands in [0x342C,0x3477] (0 of 1594 NMIs).
 *   - single call path: the only caller is sub_32bd @ 0x32CE (grep-confirmed).
 * So it is ATOMIC on its one path: no NMI fires inside it, the collapse pushes no
 * mistimed PC, and a per-arm-total-preserving collapse is byte-exact -> STRICT (not the
 * convergent gate), exactly like the sibling sub_3409. See equivalence-342c.test.js.
 *
 * CYCLES -- COLLAPSED per doc 06, per-arm TOTAL preserved EXACTLY (atomic, no
 * hardware-latch write, and the fall-through into loc_3445 is the one boundary NOT
 * folded across):
 *   PREFIX (both arms): ld19 + ld19 + xor4 + ldbc10 + adc15 = 67 t @0x3438 (the jp)
 *   ARM A: prefix 67 + jpTaken10 + inc23                    = 100 t @0x3445, then the tail
 *   ARM B: prefix 67 + jpNot10 + ldhl10 + ld19 + inc23      = 129 t @0x3445, then the tail
 * Both writes are (ix+0x03) object fields in work RAM (0x60xx-0x6Fxx), NOT a
 * 0x7800-0f/0x7c00/0x7c80/0x7d00-07/0x7d80-87 latch, so no bus-cycle boundary is pinned
 * and there is no write-trace test to add. The fall-through into loc_3445 is a ROM
 * fall-through, not a Z80 `call`, so it pushes NOTHING; `m.call(0x3445)` is kept verbatim
 * so loc_3445's rets are this routine's rets and an optimized loc_3445 (if any) is used.
 *
 * FLAGS -- what is kept and why (the unit gate compares the whole F):
 *   - `xor a` is kept verbatim: it both zeroes A (A = 0 is observable at the tail's
 *     entry) AND clears carry for the adc, and it seeds Z for the (unused) case.
 *   - `adc hl,bc` (adcHl) is kept verbatim: its Z drives the arm branch and it is the
 *     last flag-writer before the branch.
 *   - `inc (ix+0x03)` (incMem8) is kept verbatim: correct memory RMW, and it is the last
 *     flag-writer before the fall-through, so its F is the F loc_3445 sees on entry.
 *   No flag is dropped -- there is nothing droppable (the branch and the tail read them).
 *
 * INPUTS  : IX = object record base; RAM (ix+0x1a):(ix+0x1b) saved table pointer,
 *           (ix+0x03) frame/index byte. The BOARD==1 gate that selects this routine
 *           lives in the caller sub_32bd, not here.
 * OUTPUTS : (ix+0x03) incremented (and, ARM B, seeded to 0x26 first); HL = the saved
 *           pointer (ARM A) or 0x3A8C (ARM B); A = 0; BC = 0; F from the inc. Then
 *           loc_3445 stores the entry / advances the pointer / finalizes, and rets.
 */
export function sub_342c(m) {
  const { regs, mem } = m;
  const R = (d) => (regs.ix + d) & 0xffff; // (ix+d) object-record field address

  // PREFIX -- reload the saved 16-bit table pointer and 16-bit zero-test it (see header:
  // adcHl, not addHl). HL is left = the saved pointer; A = 0; carry cleared.
  regs.l = mem.read8(R(0x1a));
  regs.h = mem.read8(R(0x1b));
  regs.xor(regs.a); // xor a -- A = 0, CARRY cleared for the adc
  regs.bc = 0x0000;
  regs.adcHl(regs.bc); // adc hl,bc -- sets Z iff the saved pointer is zero
  m.step(0x3438, 67); // ld19 + ld19 + xor4 + ldbc10 + adc15 -- block exit (the jp nz)

  if (regs.fNZ) {
    // ARM A -- pointer already established: fall straight to the shared inc (loc_3442).
    regs.incMem8(mem, R(0x03)); // inc (ix+0x03)
    m.step(0x3445, 33); // jpTaken10 + inc23  => 100 t before the tail
  } else {
    // ARM B -- FIRST call (pointer zero): point HL at the ROM animation table 0x3A8C,
    // seed (ix+0x03) = 0x26, then the shared inc (loc_3442).
    regs.hl = 0x3a8c; // ROM animation-table base (not a RAM name)
    mem.write8(R(0x03), 0x26);
    regs.incMem8(mem, R(0x03)); // inc (ix+0x03)
    m.step(0x3445, 62); // jpNot10 + ldhl10 + ld19 + inc23  => 129 t before the tail
  }

  // FALLTHROUGH into loc_3445 -- the SHARED table-walk / finalize tail. A ROM
  // fall-through, NOT a Z80 `call`, so nothing is pushed; loc_3445's ret is this
  // routine's ret. m.call routes through the registry (oracle, or an optimized
  // loc_3445 if one exists), matching the oracle's own `return m.call(0x3445)`.
  return m.call(0x3445);
}
