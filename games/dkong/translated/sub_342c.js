// SPDX-License-Identifier: GPL-3.0-only

/**
 * sub_342c  (ROM 0x342C–0x3477) — 76 bytes, 26 instructions.
 *
 *   342c  dd 6e 1a     ld   l,(ix+0x1a)     ; reload the saved table pointer
 *   342f  dd 66 1b     ld   h,(ix+0x1b)
 *   3432  af           xor  a               ; A = 0 AND carry CLEARED
 *   3433  01 00 00     ld   bc,0x0000
 *   3436  ed 4a        adc  hl,bc           ; 16-bit ZERO TEST on HL
 *   3438  c2 42 34     jp   nz,0x3442
 *   343b  21 8c 3a     ld   hl,0x3a8c       ; first use: point at the table
 *   343e  dd 36 03 26  ld   (ix+0x03),0x26
 *   3442  dd 34 03     inc  (ix+0x03)       ; loc_3442
 *   (falls through into loc_3445 -- see above)
 *
 * Translated for completeness; not yet wired into the live dispatcher.
 * Not yet wired into the live dispatcher: called from 0x32CE (sub_32bd, untranslated).
 * Calls nothing; IX live-in.
 *
 * Walks an animation table one entry per call: the saved pointer lives in
 * (ix+0x1a):(ix+0x1b); if it is zero this is the first call, so HL is pointed at
 * the table (0x3A8C) and (ix+0x03) seeded to 0x26. Either way (ix+0x03) is then
 * incremented and the tail (loc_3445) stores the entry and advances the pointer,
 * or finalizes on the 0xAA terminator. Table contents / field meanings not
 * interpreted.
 *
 * THE ZERO TEST IS WHY adcHl EXISTS. `xor a` clears carry AND zeroes A; `ld
 * bc,0`; `adc hl,bc` then computes HL + 0 + 0 = HL purely to SET Z from the
 * 16-bit result. `add hl,bc` PRESERVES Z and would never produce this branch --
 * the draft's S6 claimed the form had precedent and it did not, so adcHl was
 * pinned against MAME 0.288 and landed first.
 *
 * S7 TWIN: sub_3478 shares this routine's prefix instruction-for-instruction AND
 * jumps into its loc_3445 tail. loc_3445 is factored out for that reason; the
 * twins are NOT interchangeable and must not be written from one another.
 */
export function sub_342c(m) {
  const { regs, mem } = m;
  const R = (d) => (regs.ix + d) & 0xffff;

  regs.l = mem.read8(R(0x1a));
  m.step(0x342f, 19); // ld l,(ix+0x1a)
  regs.h = mem.read8(R(0x1b));
  m.step(0x3432, 19); // ld h,(ix+0x1b)
  regs.xor(regs.a); // xor a -- A = 0, and CARRY CLEARED for the adc below
  m.step(0x3433, 4); // xor a
  regs.bc = 0x0000;
  m.step(0x3436, 10); // ld bc,0x0000
  regs.adcHl(regs.bc); // adc hl,bc -- sets Z iff the saved pointer is zero
  m.step(0x3438, 15); // adc hl,bc
  if (regs.fNZ) {
    m.step(0x3442, 10); // jp nz,0x3442 TAKEN -- pointer already established
  } else {
    m.step(0x343b, 10); // jp nz NOT taken -- first call, initialise
    regs.hl = 0x3a8c;
    m.step(0x343e, 10); // ld hl,0x3a8c
    mem.write8(R(0x03), 0x26);
    m.step(0x3442, 19); // ld (ix+0x03),0x26
  }

  // loc_3442
  regs.incMem8(mem, R(0x03)); // inc (ix+0x03)
  m.step(0x3445, 23); // inc (ix+0x03)

  // FALLTHROUGH into loc_3445 -- its rets are this routine's rets.
  return m.call(0x3445);
}
