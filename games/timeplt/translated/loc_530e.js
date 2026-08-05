// SPDX-License-Identifier: GPL-3.0-only

// loc_530e  (ROM 0x530E–0x5336)
export function loc_530e(m) {
  const { regs, mem } = m;

  regs.hl = mem.read16(0xae80);
  m.step(0x5311, 16); // ld hl,(0xae80)
  regs.a = regs.l;
  m.step(0x5312, 4); // ld a,l
  regs.and(0x7f);
  m.step(0x5314, 7); // and 0x7f
  regs.sub(0x04);
  m.step(0x5316, 7); // sub 0x04
  if (regs.fZ) {
    m.ret(11); // ret z -- the list is empty
    return;
  }
  m.step(0x5317, 5); // ret z NOT taken

  regs.rrca();
  m.step(0x5318, 4); // rrca
  regs.rrca();
  m.step(0x5319, 4); // rrca
  regs.and(0x1f);
  m.step(0x531b, 7); // and 0x1f
  regs.b = regs.a;
  m.step(0x531c, 4); // ld b,a
  regs.hl = 0xae84;
  m.step(0x531f, 10); // ld hl,0xae84

  for (;;) {
    regs.e = mem.read8(regs.hl);
    m.step(0x5320, 7); // ld e,(hl)
    regs.l = regs.inc8(regs.l); // inc l -- 8-bit, stays in the 0xAExx page
    m.step(0x5321, 4); // inc l
    regs.d = mem.read8(regs.hl);
    m.step(0x5322, 7); // ld d,(hl)
    regs.l = regs.inc8(regs.l);
    m.step(0x5323, 4); // inc l
    regs.a = mem.read8(regs.de);
    m.step(0x5324, 7); // ld a,(de)
    regs.and(0x10);
    m.step(0x5326, 7); // and 0x10

    if (regs.fNZ) {
      m.step(0x5332, 12); // jr nz,0x5332 TAKEN
      regs.l = regs.inc8(regs.l);
      m.step(0x5333, 4); // inc l
      regs.l = regs.inc8(regs.l);
      m.step(0x5334, 4); // inc l
      regs.djnz();
      m.step(regs.b !== 0 ? 0x531f : 0x5336, regs.b !== 0 ? 13 : 8); // djnz 0x531f
      if (regs.b !== 0) continue;
      m.ret(); // 5336
      return;
    }
    m.step(0x5328, 7); // jr nz NOT taken -- blank the entry

    regs.l = regs.inc8(regs.l);
    m.step(0x5329, 4); // inc l
    regs.l = regs.inc8(regs.l);
    m.step(0x532a, 4); // inc l
    regs.d = regs.set(2, regs.d); // set 2,d -- NO flags
    m.step(0x532c, 8); // set 2,d
    regs.a = 0x20;
    m.step(0x532e, 7); // ld a,0x20
    mem.write8(regs.de, regs.a);
    m.step(0x532f, 7); // ld (de),a
    regs.djnz();
    m.step(regs.b !== 0 ? 0x531f : 0x5331, regs.b !== 0 ? 13 : 8); // djnz 0x531f
    if (regs.b !== 0) continue;
    m.ret(); // 5331
    return;
  }
}
