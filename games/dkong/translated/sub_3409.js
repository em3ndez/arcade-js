// SPDX-License-Identifier: GPL-3.0-only

/**
 * sub_3409  (ROM 0x3409–0x342B) — 35 bytes, 15 instructions.
 *
 *   3409  dd 7e 15     ld   a,(ix+0x15)
 *   340c  a7           and  a
 *   340d  c2 28 34     jp   nz,0x3428      ; timer != 0 -> dec it
 *   3410  dd 36 15 02  ld   (ix+0x15),0x02 ; reload timer to 2
 *   3414  dd 34 07     inc  (ix+0x07)      ; advance frame
 *   3417  dd 7e 07     ld   a,(ix+0x07)
 *   341a  e6 0f        and  0x0f
 *   341c  fe 0f        cp   0x0f
 *   341e  c0           ret  nz             ; not at the nibble boundary
 *   341f  dd 7e 07     ld   a,(ix+0x07)
 *   3422  ee 02        xor  0x02           ; TOGGLE bit 1 (not +2, not |2)
 *   3424  dd 77 07     ld   (ix+0x07),a
 *   3427  c9           ret
 *   3428  dd 35 15     dec  (ix+0x15)      ; loc_3428
 *   342b  c9           ret
 *
 * Translated for completeness; not yet wired into the live dispatcher.
 * Not yet wired into the live dispatcher: called from 0x33E7 (entry_33e7) and 0x33C0
 * (entry_33ad), both untranslated; nothing in translated src invokes sub_3409.
 * Calls nothing; IX live-in. Unblocks entry_33ad and entry_33e7.
 *
 * A frame timer: (ix+0x15) down-counts; on expiry it reloads to 2 and advances
 * the frame (ix+0x07). When the frame's LOW NIBBLE reaches 0x0F, bit 1 is
 * TOGGLED via `xor 0x02` -- a toggle, not an increment or an OR: if bit 1 was
 * already set, xor CLEARS it. Frame field / xor meaning not interpreted.
 *
 * Both `inc (ix+0x07)` and `dec (ix+0x15)` are MEMORY RMW and go through the
 * shared primitives regs.incMem8 / regs.decMem8 -- flag-correct (S/Z/H/PV set,
 * carry preserved). A bare (v+/-1)&0xff would drop those flags; the RMW rets
 * here carry them to the caller (S5).
 */
export function sub_3409(m) {
  const { regs, mem } = m;
  const R = (d) => (regs.ix + d) & 0xffff; // (ix+d) effective address

  regs.a = mem.read8(R(0x15));
  m.step(0x340c, 19); // ld a,(ix+0x15)
  regs.and(regs.a); // and a -- sets Z
  m.step(0x340d, 4); // and a
  if (regs.fNZ) {
    // loc_3428 -- timer still counting down
    m.step(0x3428, 10); // jp nz,0x3428 TAKEN
    regs.decMem8(mem, R(0x15)); // dec (ix+0x15) -- flag-correct RMW
    m.step(0x342b, 23); // dec (ix+0x15)
    m.ret(); // 342b
    return;
  }
  m.step(0x3410, 10); // jp nz NOT taken -- timer expired

  mem.write8(R(0x15), 0x02);
  m.step(0x3414, 19); // ld (ix+0x15),0x02 -- reload
  regs.incMem8(mem, R(0x07)); // inc (ix+0x07) -- flag-correct RMW
  m.step(0x3417, 23); // inc (ix+0x07)
  regs.a = mem.read8(R(0x07));
  m.step(0x341a, 19); // ld a,(ix+0x07)
  regs.and(0x0f);
  m.step(0x341c, 7); // and 0x0f
  regs.cp(0x0f);
  m.step(0x341e, 7); // cp 0x0f
  if (regs.fNZ) {
    m.ret(11); // ret nz -- not at the nibble boundary
    return;
  }
  m.step(0x341f, 5); // ret nz NOT taken -- fall through

  regs.a = mem.read8(R(0x07));
  m.step(0x3422, 19); // ld a,(ix+0x07)
  regs.xor(0x02); // TOGGLE bit 1 -- clears it if it was set
  m.step(0x3424, 7); // xor 0x02
  mem.write8(R(0x07), regs.a);
  m.step(0x3427, 19); // ld (ix+0x07),a

  m.ret(); // 3427
}
