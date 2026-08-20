// SPDX-License-Identifier: GPL-3.0-only

// loc_02c9  (ROM 0x02c9-0x02e2) -- round-init tile-fill helper. Calls 0x02b9, then blanks
// B=0x1d tiles (=0x10) at the scroll pointer (0x880b) via rst 0x10 (loc_0010, HL+=B), advances
// that pointer by 0x20-0x1d=3 (add hl,de with DE=0x20-B), and decrements the row counter (0x8809).
export function loc_02c9(m) {
  const { regs, mem } = m;

  m.push16(0x02cc);
  m.step(0x02b9, 17);              // 02c9  call 0x02b9 (pattern A -> 0x02cc)
  m.call(0x02b9);

  regs.b = 0x1d;                   m.step(0x02ce, 7);
  regs.a = 0x20;                   m.step(0x02d0, 7);
  regs.sub(regs.b);               m.step(0x02d1, 4);  // sub b -> A = 0x20 - B
  regs.e = regs.a;                m.step(0x02d2, 4);
  regs.d = 0x00;                  m.step(0x02d4, 7);
  regs.hl = mem.read16(0x880b);   m.step(0x02d7, 16); // ld hl,(0x880b)
  regs.a = 0x10;                  m.step(0x02d9, 7);

  m.push16(0x02da);
  m.step(0x0010, 11);             // 02d9  rst 0x10 (loc_0010 fill B tiles=0x10, HL += B)
  m.call(0x0010);

  regs.addHl(regs.de);            m.step(0x02db, 11); // add hl,de -- HL += (0x20-B)
  mem.write16(0x880b, regs.hl);   m.step(0x02de, 16); // ld (0x880b),hl
  regs.hl = 0x8809;               m.step(0x02e1, 10);
  regs.decMem8(mem, regs.hl);     m.step(0x02e2, 11); // dec (hl)

  m.ret(); // 02e2  ret
}
