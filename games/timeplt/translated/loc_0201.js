// SPDX-License-Identifier: GPL-3.0-only

// loc_0201  (ROM 0x0201-0x026E)
export function loc_0201(m) {
  const { regs, mem } = m;

  m.push16(0x0204);
  m.step(0x026f, 17); // call 0x026f
  m.call(0x026f);

  regs.hl = mem.read16(0x32f5);
  m.step(0x0207, 16); // ld hl,(0x32f5) -- target X
  regs.bc = mem.read16(0xa9e3);
  m.step(0x020b, 20); // ld bc,(0xa9e3) -- current X
  regs.and(regs.a);
  m.step(0x020c, 4); // and a -- clears carry
  regs.sbcHl(regs.bc);
  m.step(0x020e, 15); // sbc hl,bc
  regs.addHl(regs.hl);
  m.step(0x020f, 11); // add hl,hl
  regs.addHl(regs.hl);
  m.step(0x0210, 11); // add hl,hl
  regs.addHl(regs.hl);
  m.step(0x0211, 11); // add hl,hl
  regs.addHl(regs.hl);
  m.step(0x0212, 11); // add hl,hl -- delta * 16
  regs.a = 0x00;
  m.step(0x0214, 7); // ld a,0x00
  regs.sbc(0x00);
  m.step(0x0216, 7); // sbc a,0x00 -- 0x00 or 0xFF from the last add's carry
  regs.l = regs.h;
  m.step(0x0217, 4); // ld l,h
  regs.h = regs.a;
  m.step(0x0218, 4); // ld h,a -- HL = signed high byte pair
  mem.write16(0xa9e7, regs.hl);
  m.step(0x021b, 16); // ld (0xa9e7),hl -- X step

  regs.hl = mem.read16(0x0b45);
  m.step(0x021e, 16); // ld hl,(0x0b45) -- target Y
  regs.bc = mem.read16(0xa9e5);
  m.step(0x0222, 20); // ld bc,(0xa9e5) -- current Y
  regs.and(regs.a);
  m.step(0x0223, 4); // and a
  regs.sbcHl(regs.bc);
  m.step(0x0225, 15); // sbc hl,bc
  regs.addHl(regs.hl);
  m.step(0x0226, 11); // add hl,hl
  regs.addHl(regs.hl);
  m.step(0x0227, 11); // add hl,hl
  regs.addHl(regs.hl);
  m.step(0x0228, 11); // add hl,hl
  regs.addHl(regs.hl);
  m.step(0x0229, 11); // add hl,hl
  regs.a = 0x00;
  m.step(0x022b, 7); // ld a,0x00
  regs.sbc(0x00);
  m.step(0x022d, 7); // sbc a,0x00
  regs.l = regs.h;
  m.step(0x022e, 4); // ld l,h
  regs.h = regs.a;
  m.step(0x022f, 4); // ld h,a
  mem.write16(0xa9e9, regs.hl);
  m.step(0x0232, 16); // ld (0xa9e9),hl -- Y step

  for (;;) {
    regs.hl = mem.read16(0xa9e3);
    m.step(0x0235, 16); // ld hl,(0xa9e3)
    regs.bc = mem.read16(0xa9e7);
    m.step(0x0239, 20); // ld bc,(0xa9e7)
    regs.addHl(regs.bc);
    m.step(0x023a, 11); // add hl,bc
    mem.write16(0xa9e3, regs.hl);
    m.step(0x023d, 16); // ld (0xa9e3),hl

    regs.hl = mem.read16(0xa9e5);
    m.step(0x0240, 16); // ld hl,(0xa9e5)
    regs.bc = mem.read16(0xa9e9);
    m.step(0x0244, 20); // ld bc,(0xa9e9)
    regs.addHl(regs.bc);
    m.step(0x0245, 11); // add hl,bc
    mem.write16(0xa9e5, regs.hl);
    m.step(0x0248, 16); // ld (0xa9e5),hl

    m.push16(0x024b);
    m.step(0x026f, 17); // call 0x026f -- stamps, returns HL = VRAM ptr
    m.call(0x026f);

    regs.de = mem.read16(0x14b2);
    m.step(0x024f, 20); // ld de,(0x14b2) -- the end cell
    regs.and(regs.a);
    m.step(0x0250, 4); // and a
    regs.sbcHl(regs.de);
    m.step(0x0252, 15); // sbc hl,de
    if (regs.fNZ) {
      m.step(0x0232, 10); // jp nz,0x0232 -- keep stepping
      continue;
    }
    m.step(0x0255, 10); // jp nz not taken
    break;
  }

  regs.hl = 0xa9e2;
  m.step(0x0258, 10); // ld hl,0xa9e2
  regs.incMem8(mem, regs.hl);
  m.step(0x0259, 11); // inc (hl) -- next run index
  regs.a = mem.read8(regs.hl);
  m.step(0x025a, 7); // ld a,(hl)
  regs.hl = 0x0290;
  m.step(0x025d, 10); // ld hl,0x0290 -- the run table

  m.push16(0x025e);
  m.step(0x0010, 11); // rst 0x10 -- DE = word at 0x0290 + 2*A, HL advanced
  m.call(0x0010);

  regs.hl = 0xa9e3;
  m.step(0x0261, 10); // ld hl,0xa9e3
  mem.write8(regs.hl, 0x00);
  m.step(0x0263, 10); // ld (hl),0x00 -- clear the X fraction
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x0264, 6); // inc hl
  mem.write8(regs.hl, regs.e);
  m.step(0x0265, 7); // ld (hl),e -- X integer

  regs.hl = 0xa9e5;
  m.step(0x0268, 10); // ld hl,0xa9e5
  mem.write8(regs.hl, 0x00);
  m.step(0x026a, 10); // ld (hl),0x00 -- clear the Y fraction
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x026b, 6); // inc hl
  mem.write8(regs.hl, regs.d);
  m.step(0x026c, 7); // ld (hl),d -- Y integer

  regs.a = regs.e;
  m.step(0x026d, 4); // ld a,e
  regs.and(regs.a);
  m.step(0x026e, 4); // and a -- Z reports "new X integer == 0" to the caller
  m.ret(10); // 026e
}
