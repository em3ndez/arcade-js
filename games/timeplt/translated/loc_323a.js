// SPDX-License-Identifier: GPL-3.0-only

// loc_323a  (ROM 0x323A–0x3251)
export function loc_323a(m) {
  const { regs, mem } = m;
  const X = (d) => (regs.ix + d) & 0xffff;

  regs.a = mem.read8(X(0x09));
  m.step(0x323d, 19); // ld a,(ix+0x09)
  regs.and(regs.a);
  m.step(0x323e, 4); // and a
  if (regs.fZ) {
    m.step(m.pop16(), 11); // ret z -- counter already 0
    return;
  }
  m.step(0x323f, 5);

  regs.a = regs.dec8(regs.a);
  m.step(0x3240, 4); // dec a
  mem.write8(X(0x09), regs.a);
  m.step(0x3243, 19); // ld (ix+0x09),a
  regs.c = regs.a; // the new counter, kept across both rsts
  m.step(0x3244, 4); // ld c,a
  regs.a = mem.read8(X(0x0a));
  m.step(0x3247, 19); // ld a,(ix+0x0a)
  regs.hl = 0x3438;
  m.step(0x324a, 10); // ld hl,0x3438

  m.push16(0x324b);
  m.step(0x0010, 11); // rst 0x10 -- DE = word table[A]
  m.call(0x0010);

  regs.exDeHl(); // HL = the fetched pointer
  m.step(0x324c, 4); // ex de,hl
  regs.a = regs.c;
  m.step(0x324d, 4); // ld a,c

  m.push16(0x324e);
  m.step(0x0008, 11); // rst 0x08 -- A = byte table[C]
  m.call(0x0008);

  mem.write8(X(0x08), regs.a);
  m.step(0x3251, 19); // ld (ix+0x08),a

  m.ret(); // 3251
}
