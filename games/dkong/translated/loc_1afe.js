// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_1afe  (ROM 0x1AFE–0x1B37) — climb collision. ** CONTAINS THE 236e HIDDEN EXIT + push/pop af. **.
 */
export function loc_1afe(m, R) {
  const { regs, mem } = m;
  regs.a = mem.read8(0x6217);
  m.step(0x1b01, 13); // ld a,(0x6217)
  regs.a = regs.dec8(regs.a);
  m.step(0x1b02, 4); // dec a
  if (regs.fZ) { m.ret(11); return; } // ret z
  m.step(0x1b03, 5);

  regs.a = mem.read8(0x6205); // Y
  m.step(0x1b06, 13); // ld a,(0x6205)
  regs.add(0x08);
  m.step(0x1b08, 7); // add a,0x08
  regs.d = regs.a;
  m.step(0x1b09, 4); // ld d,a
  regs.a = mem.read8(0x6203); // X
  m.step(0x1b0c, 13); // ld a,(0x6203)
  regs.or(0x03);
  m.step(0x1b0e, 7); // or 0x03
  regs.a = regs.res(2, regs.a);
  m.step(0x1b10, 8); // res 2,a
  regs.bc = 0x0015;
  m.step(0x1b13, 10); // ld bc,0x0015

  // ** THE HIDDEN EXIT ** -- 236e miss unwinds to 197a; body below is found-only
  m.push16(0x1b16);
  m.step(0x236e, 17); // call 0x236e
  if (!m.call(0x236e)) return; // miss: already unwound to loc_197a

  m.push16(regs.af); // push af -- carry 236e's A across the flag-clobbering region
  m.step(0x1b17, 11);
  regs.hl = 0x6207;
  m.step(0x1b1a, 10); // ld hl,0x6207
  regs.a = mem.read8(regs.hl);
  m.step(0x1b1b, 7); // ld a,(hl)
  regs.and(0x80);
  m.step(0x1b1d, 7); // and 0x80
  regs.or(0x06);
  m.step(0x1b1f, 7); // or 0x06
  mem.write8(regs.hl, regs.a);
  m.step(0x1b20, 7); // ld (hl),a
  regs.hl = 0x621a;
  m.step(0x1b23, 10); // ld hl,0x621a
  regs.a = 0x04;
  m.step(0x1b25, 7); // ld a,0x04
  regs.cp(regs.c); // C = 236e's cpir residual count
  m.step(0x1b26, 4); // cp c
  mem.write8(regs.hl, 0x01);
  m.step(0x1b28, 10); // ld (hl),0x01
  if (regs.fNC) {
    m.step(0x1b2c, 10); // jr nc,0x1b2c
  } else {
    m.step(0x1b2b, 5); // jr nc NOT taken
    mem.write8(regs.hl, regs.dec8(mem.read8(regs.hl)));
    m.step(0x1b2c, 11); // dec (hl)
  }

  // loc_1b2c: pop af, test the RESTORED A
  regs.af = m.pop16(); // pop af
  m.step(0x1b2d, 10);
  regs.and(regs.a);
  m.step(0x1b2e, 4); // and a
  if (regs.fZ) { m.step(0x1b4e, 10); return m.call(0x1b4e); } // jp z
  m.step(0x1b31, 10);
  regs.a = mem.read8(regs.hl);
  m.step(0x1b32, 7); // ld a,(hl)
  regs.and(regs.a);
  m.step(0x1b33, 4); // and a
  if (regs.fNZ) { m.ret(11); return; } // ret nz
  m.step(0x1b34, 5); // ret nz NOT taken
  regs.l = regs.inc8(regs.l);
  m.step(0x1b35, 4); // inc l
  mem.write8(regs.hl, regs.d);
  m.step(0x1b36, 7); // ld (hl),d
  regs.l = regs.inc8(regs.l);
  m.step(0x1b37, 4); // inc l
  mem.write8(regs.hl, regs.b);
  m.step(0x1b38, 7); // ld (hl),b
  return m.call(0x1b38);
}
