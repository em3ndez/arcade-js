// SPDX-License-Identifier: GPL-3.0-only

/**
 * sub_239c  (ROM 0x239C–0x23DD).
 */
export function sub_239c(m) {
  const { regs, mem } = m;
  const ixb = (d) => (regs.ix + d) & 0xffff;

  // ---- 16-bit add: (ix+3:4) += (ix+0x10:0x11) ----
  regs.a = mem.read8(ixb(0x04));
  m.step(0x239f, 19); // ld a,(ix+0x04)
  regs.add(mem.read8(ixb(0x11))); // add a,(ix+0x11) -- sets carry
  m.step(0x23a2, 19);
  mem.write8(ixb(0x04), regs.a); // ld (ix+0x04),a
  m.step(0x23a5, 19);
  regs.a = mem.read8(ixb(0x03));
  m.step(0x23a8, 19); // ld a,(ix+0x03)
  regs.adc(mem.read8(ixb(0x10))); // adc a,(ix+0x10) -- consumes the carry
  m.step(0x23ab, 19);
  mem.write8(ixb(0x03), regs.a);
  m.step(0x23ae, 19); // ld (ix+0x03),a

  // ---- 16-bit subtract into HL: (ix+5:6) - (ix+0x12:0x13) ----
  regs.a = mem.read8(ixb(0x06));
  m.step(0x23b1, 19); // ld a,(ix+0x06)
  regs.sub(mem.read8(ixb(0x13))); // sub (ix+0x13) -- sets borrow
  m.step(0x23b4, 19);
  regs.l = regs.a;
  m.step(0x23b5, 4); // ld l,a
  regs.a = mem.read8(ixb(0x05));
  m.step(0x23b8, 19); // ld a,(ix+0x05)
  regs.sbc(mem.read8(ixb(0x12))); // sbc (ix+0x12) -- consumes the borrow
  m.step(0x23bb, 19);
  regs.h = regs.a;
  m.step(0x23bc, 4); // ld h,a

  // ---- B:A = (2*(ix+0x14) + 1) * 8 ----
  regs.a = mem.read8(ixb(0x14));
  m.step(0x23bf, 19); // ld a,(ix+0x14)
  regs.and(regs.a); // and a -- clears carry for the rla
  m.step(0x23c0, 4);
  regs.rla();
  m.step(0x23c1, 4); // rla
  regs.a = regs.inc8(regs.a); // inc a -- leaves carry alone
  m.step(0x23c2, 4);
  regs.b = 0x00;
  m.step(0x23c4, 7); // ld b,0x00
  regs.b = regs.rl(regs.b); // rl b -- captures the rla carry into B
  m.step(0x23c6, 8);
  for (const [slaNext, rlNext] of [[0x23c8, 0x23ca], [0x23cc, 0x23ce], [0x23d0, 0x23d2]]) {
    regs.a = regs.sla(regs.a); // sla a -- FIRST executable use (cpu.js:531)
    m.step(slaNext, 8);
    regs.b = regs.rl(regs.b); // rl b
    m.step(rlNext, 8);
  }

  regs.c = regs.a; // ld c,a -- BC only becomes the operand here
  m.step(0x23d3, 4);
  regs.addHl(regs.bc);
  m.step(0x23d4, 11); // add hl,bc

  // ---- store back (read-modify-write, order forced) ----
  mem.write8(ixb(0x05), regs.h);
  m.step(0x23d7, 19); // ld (ix+0x05),h
  mem.write8(ixb(0x06), regs.l);
  m.step(0x23da, 19); // ld (ix+0x06),l
  mem.write8(ixb(0x14), regs.inc8(mem.read8(ixb(0x14)))); // inc (ix+0x14) -- preserves carry
  m.step(0x23dd, 23);

  m.ret(); // ret (0x23DD) -- carry from add hl,bc and Z from the inc both escape
}
