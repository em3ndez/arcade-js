// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_330f  (ROM 0x330F–0x333C) — 46 bytes, 16 instructions.
 *
 *   330f  dd 7e 16     ld   a,(ix+0x16)
 *   3312  fe 00        cp   0x00
 *   3314  c2 32 33     jp   nz,0x3332      ; timer != 0 -> just dec it
 *   3317  dd 36 16 2b  ld   (ix+0x16),0x2b ; reload timer (43)
 *   331b  dd 36 0d 00  ld   (ix+0x0d),0x00 ; reset state
 *   331f  3a 18 60     ld   a,(0x6018)
 *   3322  0f           rrca                ; carry = 0x6018 bit 0
 *   3323  d2 32 33     jp   nc,0x3332
 *   3326  dd 7e 0d     ld   a,(ix+0x0d)    ; = 0, just reset
 *   3329  fe 01        cp   0x01
 *   332b  ca 36 33     jp   z,0x3336       ; NEVER TAKEN -- see below
 *   332e  dd 36 0d 01  ld   (ix+0x0d),0x01 ; state := 1
 *   3332  dd 35 16     dec  (ix+0x16)      ; loc_3332
 *   3335  c9           ret
 *   3336  dd 36 0d 02  ld   (ix+0x0d),0x02 ; loc_3336 -- UNREACHABLE
 *   333a  c3 32 33     jp   0x3332
 *
 * Translated for completeness; not yet wired into the live dispatcher.
 * Not yet wired into the live dispatcher: called from 0x330B (sub_32d6) and the
 * entry_31b1->entry_3202 chain, all untranslated; nothing in translated src
 * invokes loc_330f. Self-contained: calls NOTHING, normal ret, no splice (the
 * draft corrected the assignment, which claimed ~59 insns and two callees --
 * a crude scan had walked past the ret at 0x3335 into entry_333d/sub_33a1).
 *
 * A periodic object timer: if (ix+0x16) != 0 just decrement it; on expiry reload
 * it to 0x2B, reset state (ix+0x0d) to 0, and if 0x6018 bit 0 is set advance the
 * state to 1. Every path falls through loc_3332's `dec (ix+0x16)`, so the reload
 * path yields 0x2A. IX is LIVE-IN (the object pointer). Timer/state/0x6018 bit 0
 * not interpreted.
 *
 * FINDING, flagged not resolved: `loc_3336` (state := 2) is
 * UNREACHABLE via this routine's own flow. The only path to 0x3326 passes
 * 0x331B, which sets (ix+0x0d) = 0, so the `cp 0x01` at 0x3329 never matches and
 * the `jp z,0x3336` never fires. Whether that is intentional dead code, a ROM bug
 * (the reset defeating the state==1 check), or a path via an indirect entry to
 * 0x3336 (no external reference found) is NOT decided here -- the translation
 * reproduces the unreachability faithfully: the branch is emitted and simply
 * never taken. TEST 2 pins that state=2 is not producible.
 *
 * `rrca` (0x3322): only the carry-out is used -- A's rotated value is dead
 * (overwritten at 0x3326). regs.rrca() keeps it faithful to the 0F byte.
 *
 * `dec (ix+0x16)` (0x3332) is a MEMORY RMW and is the first consumer of
 * regs.decMem8 -- it sets S/Z/H/PV (carry preserved), which a bare
 * `(v-1)&0xff` would drop. Dead before this ret, but sub_32d6's own
 * `dec (ix+0x1c)` / `jp nz` is exactly why the primitive exists.
 */
export function loc_330f(m) {
  const { regs, mem } = m;
  const R = (d) => (regs.ix + d) & 0xffff; // (ix+d) effective address

  regs.a = mem.read8(R(0x16));
  m.step(0x3312, 19); // ld a,(ix+0x16)
  regs.cp(0x00);
  m.step(0x3314, 7); // cp 0x00
  if (regs.fNZ) {
    m.step(0x3332, 10); // jp nz,0x3332 TAKEN -- timer still counting down
  } else {
    m.step(0x3317, 10); // jp nz NOT taken -- timer expired
    mem.write8(R(0x16), 0x2b);
    m.step(0x331b, 19); // ld (ix+0x16),0x2b -- reload
    mem.write8(R(0x0d), 0x00);
    m.step(0x331f, 19); // ld (ix+0x0d),0x00 -- reset state (this is what makes 0x3336 dead)
    regs.a = mem.read8(0x6018);
    m.step(0x3322, 13); // ld a,(0x6018)
    regs.rrca(); // carry = bit 0; the rotated A is dead
    m.step(0x3323, 4); // rrca
    if (regs.fNC) {
      m.step(0x3332, 10); // jp nc,0x3332 TAKEN -- bit 0 clear
    } else {
      m.step(0x3326, 10); // jp nc NOT taken -- bit 0 set
      regs.a = mem.read8(R(0x0d)); // = 0 (reset at 0x331B)
      m.step(0x3329, 19); // ld a,(ix+0x0d)
      regs.cp(0x01);
      m.step(0x332b, 7); // cp 0x01
      if (regs.fZ) {
        // loc_3336 -- UNREACHABLE via this flow (state is 0 here). Emitted
        // faithfully so the ROM's structure is preserved; it never fires.
        m.step(0x3336, 10); // jp z,0x3336
        mem.write8(R(0x0d), 0x02);
        m.step(0x333a, 19); // ld (ix+0x0d),0x02
        m.step(0x3332, 10); // jp 0x3332
      } else {
        m.step(0x332e, 10); // jp z NOT taken
        mem.write8(R(0x0d), 0x01);
        m.step(0x3332, 19); // ld (ix+0x0d),0x01 -- state := 1
      }
    }
  }

  // loc_3332 -- every path converges here
  regs.decMem8(mem, R(0x16)); // dec (ix+0x16) -- flag-correct RMW (cpu.js primitive)
  m.step(0x3335, 23); // dec (ix+0x16)

  m.ret(); // 3335 -- NORMAL ret
}
