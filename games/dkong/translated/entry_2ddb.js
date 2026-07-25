// SPDX-License-Identifier: GPL-3.0-only

/**
 * entry_2ddb  (ROM 0x2DDB–0x2E03).
 */
export function entry_2ddb(m) {
  const { regs, mem } = m;

  regs.a = 0x0a;
  m.push16(0x2dde);
  m.step(0x0030, 11); // rst 0x30
  if (!m.call(0x0030)) return; // skip gate
  m.push16(0x2ddf);
  m.step(0x0010, 11); // rst 0x10
  if (!m.call(0x0010)) return; // skip gate

  regs.a = mem.read8(0x6380);
  m.step(0x2de2, 13); // ld a,(0x6380)
  regs.a = regs.inc8(regs.a);
  m.step(0x2de3, 4); // inc a
  regs.and(regs.a); // clears carry
  m.step(0x2de4, 4); // and a
  regs.rra(); // ((0x6380)+1) >> 1
  m.step(0x2de5, 4); // rra
  regs.b = regs.a;
  m.step(0x2de6, 4); // ld b,a
  regs.a = mem.read8(0x6227);
  m.step(0x2de9, 13); // ld a,(0x6227)
  regs.cp(0x02);
  m.step(0x2deb, 7); // cp 0x02
  if (regs.fZ) {
    m.step(0x2ded, 12); // jp z,0x2ded
    regs.b = regs.inc8(regs.b);
    m.step(0x2dee, 4); // inc b
  } else {
    m.step(0x2dee, 7); // jp z not taken
  }

  regs.a = 0xfe;
  m.step(0x2df0, 7); // ld a,0xfe
  regs.scf(); // seed carry
  m.step(0x2df1, 4); // scf
  do {
    // loc_2df1: build the mask
    regs.rra();
    m.step(0x2df2, 4); // rra
    regs.and(regs.a); // CLEAR carry -- must not drop
    m.step(0x2df3, 4); // and a
    regs.djnz();
    m.step(regs.b !== 0 ? 0x2df1 : 0x2df5, regs.b !== 0 ? 13 : 8); // djnz 0x2df1
  } while (regs.b !== 0);

  regs.b = regs.a;
  m.step(0x2df6, 4); // ld b,a
  regs.a = mem.read8(0x601a);
  m.step(0x2df9, 13); // ld a,(0x601a)
  regs.and(regs.b); // (0x601a) & mask
  m.step(0x2dfa, 4); // and b
  if (regs.fNZ) {
    m.ret(11); // ret nz -- masked bit set -> no trigger
    return;
  }
  m.step(0x2dfb, 5); // ret nz NOT taken

  regs.a = 0x01;
  m.step(0x2dfd, 7); // ld a,0x01
  mem.write8(0x63a0, regs.a);
  m.step(0x2e00, 13); // ld (0x63a0),a
  mem.write8(0x639a, regs.a);
  m.step(0x2e03, 13); // ld (0x639a),a
  m.ret(); // ret (0x2E03)
}
