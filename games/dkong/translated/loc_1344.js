// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_1344  (ROM 0x1344–0x138E) — idx 15 counter-gated state setup (TWIN of loc_12f2, different constants).
 */
export function loc_1344(m) {
  const { regs, mem } = m;
  m.push16(0x1347); m.step(0x011c, 17); m.call(0x011c);
  regs.xor(regs.a);
  m.step(0x1348, 4); // xor a
  mem.write8(0x622c, regs.a);
  m.step(0x134b, 13); // ld (0x622c),a
  regs.hl = 0x6228;
  m.step(0x134e, 10); // ld hl,0x6228
  regs.decMem8(mem, regs.hl); // dec (hl)
  m.step(0x134f, 11);
  regs.a = mem.read8(regs.hl);
  m.step(0x1350, 7); // ld a,(hl)
  regs.de = 0x6048;
  m.step(0x1353, 10); // ld de,0x6048
  regs.bc = 0x0008;
  m.step(0x1356, 10); // ld bc,0x0008
  m.ldir(0x1358); // ldir 8 bytes -> 0x6048
  regs.and(regs.a);
  m.step(0x1359, 4); // and a
  if (regs.fNZ) {
    m.step(0x137f, 10); // jp nz,0x137f (counter != 0)
    regs.c = 0x17;
    m.step(0x1381, 7); // ld c,0x17
    regs.a = mem.read8(0x6040);
    m.step(0x1384, 13); // ld a,(0x6040)
    regs.and(regs.a);
    m.step(0x1385, 4); // and a
    if (regs.fNZ) {
      m.step(0x138a, 10); // jp nz -- keep C=0x17
    } else {
      m.step(0x1388, 10);
      regs.c = 0x08;
      m.step(0x138a, 7); // ld c,0x08
    }
    regs.a = regs.c;
    m.step(0x138b, 4); // ld a,c
    mem.write8(0x600a, regs.a); // 0x600A = 0x17 or 0x08
    m.step(0x138e, 13);
    m.ret();
    return;
  }
  m.step(0x135c, 10);
  regs.a = 0x03;
  m.step(0x135e, 7); // ld a,0x03
  regs.hl = 0x60b5;
  m.step(0x1361, 10); // ld hl,0x60b5
  m.push16(0x1364); m.step(0x13ca, 17); m.call(0x13ca); // call 0x13ca (no guard)
  regs.de = 0x0303;
  m.step(0x1367, 10); // ld de,0x0303
  m.push16(0x136a); m.step(0x309f, 17); m.call(0x309f);
  regs.de = 0x0300;
  m.step(0x136d, 10); // ld de,0x0300
  m.push16(0x1370); m.step(0x309f, 17); m.call(0x309f);
  regs.hl = 0x76d3;
  m.step(0x1373, 10); // ld hl,0x76d3
  m.push16(0x1376); m.step(0x1826, 17); m.call(0x1826); // fill helper
  regs.hl = 0x6009;
  m.step(0x1379, 10); // ld hl,0x6009
  mem.write8(regs.hl, 0xc0);
  m.step(0x137b, 10); // ld (hl),0xc0
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x137c, 6); // inc hl
  mem.write8(regs.hl, 0x11); // 0x600A = 0x11
  m.step(0x137e, 10);
  m.ret();
}
