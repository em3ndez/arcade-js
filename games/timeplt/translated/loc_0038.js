// SPDX-License-Identifier: GPL-3.0-only

// loc_0038  (ROM 0x0038-0x004E)
export function loc_0038(m) {
  const { regs, mem } = m;

  m.push16(regs.hl);
  m.step(0x0039, 11); // push hl
  regs.h = 0xac;
  m.step(0x003b, 7); // ld h,0xac
  regs.a = mem.read8(0xa9b2);
  m.step(0x003e, 13); // ld a,(0xa9b2)
  regs.l = regs.a;
  m.step(0x003f, 4); // ld l,a

  const slot = mem.read8(regs.hl);
  regs.bit(7, slot);
  m.step(0x0041, 12); // bit 7,(hl) -- sets Z/H/N/S/F3/F5

  if ((slot & 0x80) === 0) {
    m.step(0x004d, 12); // jr z,0x004d (taken) -- buffer closed, drop the entry
  } else {
    m.step(0x0043, 7); // jr z (not taken)
    mem.write8(regs.hl, regs.d);
    m.step(0x0044, 7); // ld (hl),d
    regs.l = regs.inc8(regs.l);
    m.step(0x0045, 4); // inc l -- an 8-bit inc, so it SETS S/Z/H/PV/N (carry preserved)
    mem.write8(regs.hl, regs.e);
    m.step(0x0046, 7); // ld (hl),e
    regs.l = regs.inc8(regs.l);
    m.step(0x0047, 4); // inc l -- likewise
    regs.a = regs.l;
    m.step(0x0048, 4); // ld a,l
    regs.and(0x3f);
    m.step(0x004a, 7); // and 0x3f -- sets flags
    mem.write8(0xa9b2, regs.a);
    m.step(0x004d, 13); // ld (0xa9b2),a
  }

  regs.hl = m.pop16();
  m.step(0x004e, 10); // pop hl
  m.ret(); // 004e  ret
}
