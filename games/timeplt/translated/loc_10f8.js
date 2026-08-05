// SPDX-License-Identifier: GPL-3.0-only

// loc_10f8  (ROM 0x10F8-0x1198, Time Pilot)
function block(m, h, requestAddr, spriteAddr, next) {
  const { regs, mem } = m;

  spin: for (;;) {
    regs.a = mem.read8(requestAddr);
    m.step(h + 0x03, 13); // ld a,(requestAddr)
    regs.bit(7, regs.a);
    m.step(h + 0x05, 8); // bit 7,a
    if (regs.fZ) {
      m.step(next, 12); // jr z -- no request pending, skip the block
      return;
    }
    m.step(h + 0x07, 7); // jr z not taken
    regs.c = regs.a;
    m.step(h + 0x08, 4); // ld c,a
    regs.a = mem.read8(0xc000); // scanline counter
    m.step(h + 0x0b, 13); // ld a,(0xc000)
    regs.add(regs.c);
    m.step(h + 0x0c, 4); // add a,c
    if (!regs.fC) {
      m.step(h, 12); // jr nc -- keep waiting on the beam
      continue spin;
    }
    m.step(h + 0x0e, 7); // jr nc not taken
    break;
  }

  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(h + 0x0f, 6); // inc hl
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(h + 0x10, 6); // inc hl
  regs.hl = (regs.hl - 1) & 0xffff;
  m.step(h + 0x11, 6); // dec hl
  regs.hl = (regs.hl - 1) & 0xffff;
  m.step(h + 0x12, 6); // dec hl -- net zero; a pure delay
  regs.a = regs.c;
  m.step(h + 0x13, 4); // ld a,c
  regs.and(0x7f);
  m.step(h + 0x15, 7); // and 0x7f
  mem.write8(requestAddr, regs.a);
  m.step(h + 0x18, 13); // ld (requestAddr),a
  regs.a = mem.read8(spriteAddr);
  m.step(h + 0x1b, 13); // ld a,(spriteAddr)
  regs.add(0x80);
  m.step(h + 0x1d, 7); // add a,0x80
  mem.write8(spriteAddr, regs.a);
  m.step(next, 13); // ld (spriteAddr),a
}

export function loc_10f8(m) {
  block(m, 0x10f8, 0xb437, 0xb036, 0x1118);
  block(m, 0x1118, 0xb439, 0xb038, 0x1138);
  block(m, 0x1138, 0xb43b, 0xb03a, 0x1158);
  block(m, 0x1158, 0xb43d, 0xb03c, 0x1178);
  block(m, 0x1178, 0xb43f, 0xb03e, 0x1198);

  m.ret(); // 0x1198
}
