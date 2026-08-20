// SPDX-License-Identifier: GPL-3.0-only

// loc_1171  (ROM 0x1171-0x1199) -- countdown at 0x8d07: while nonzero just decrement it and ret.
// At zero, gate on (0x8901) vs (0x8d40): equal/less/>=6 all ret; otherwise sweep the 6 object
// records at 0x8ae0 (stride 0x18), calling loc_119a on each with E=0x1d.
export function loc_1171(m) {
  const { regs, mem } = m;

  regs.hl = 0x8d07;                  m.step(0x1174, 10);
  regs.a = mem.read8(regs.hl);       m.step(0x1175, 7);
  regs.and(regs.a);                  m.step(0x1176, 4);
  if (regs.fNZ) {
    m.step(0x1178, 7);               // jr z not taken -- still counting down
    regs.decMem8(mem, regs.hl);      m.step(0x1179, 11);
    return m.ret(); // 1179  ret
  }
  m.step(0x117a, 12);                // jr z taken

  regs.a = mem.read8(0x8901);        m.step(0x117d, 13);
  regs.l = 0x40;                     m.step(0x117f, 7); // HL -> 0x8d40
  regs.sub(mem.read8(regs.hl));      m.step(0x1180, 7);
  if (regs.fZ) { return m.ret(11); } m.step(0x1181, 5); // ret z
  if (regs.fC) { return m.ret(11); } m.step(0x1182, 5); // ret c
  regs.c = regs.a;                   m.step(0x1183, 4);
  regs.a = mem.read8(regs.hl);       m.step(0x1184, 7);
  regs.cp(0x06);                     m.step(0x1186, 7);
  if (regs.fNC) { return m.ret(11); } m.step(0x1187, 5); // ret nc

  regs.ix = 0x8ae0;                  m.step(0x118b, 14);
  regs.b = 0x06;                     m.step(0x118d, 7);
  for (;;) {
    regs.e = 0x1d;                     m.step(0x118f, 7);
    m.push16(0x1192); m.step(0x119a, 17); m.call(0x119a);
    regs.de = 0x0018;                 m.step(0x1195, 10);
    regs.addIx(regs.de);              m.step(0x1197, 15);
    if (regs.djnz()) { m.step(0x118d, 13); } else { m.step(0x1199, 8); break; }
  }
  return m.ret(); // 1199  ret
}
