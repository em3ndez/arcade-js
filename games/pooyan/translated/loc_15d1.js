// SPDX-License-Identifier: GPL-3.0-only

// loc_15d1  (ROM 0x15d1-0x1600) -- loc_159b's post-dispatch continuation (the gameplay-state handler
// ret's here). Bails to the caller (the NMI epilogue 0x06fa) if 0x8806 is set (ret nz); if (0x882c)==0x0f
// it tail-jumps to the shared epilogue loc_0bb5; if (0x8802)==0 it ret's. Otherwise it forces the main
// state (0x8805) to 2 and the sub-index (0x880a) to 0, runs 0x2527 then 0x02b9, blanks an 8-tile column
// at 0x855f (HL += 0xffe0 per cell), and ret's.
export function loc_15d1(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x8806);   m.step(0x15d4, 13);
  regs.and(regs.a);             m.step(0x15d5, 4);
  if (regs.fNZ) { m.ret(11); return; } // 15d5  ret nz
  m.step(0x15d6, 5);            // ret nz not taken

  regs.a = mem.read8(0x882c);   m.step(0x15d9, 13);
  regs.cp(0x0f);                m.step(0x15db, 7);
  if (regs.fZ) {
    m.step(0x0bb5, 10);         // 15db  jp z,0x0bb5 taken (tail -> shared epilogue)
    return m.call(0x0bb5);
  }
  m.step(0x15de, 10);          // jp z not taken

  regs.a = mem.read8(0x8802);   m.step(0x15e1, 13);
  regs.and(regs.a);             m.step(0x15e2, 4);
  if (regs.fZ) { m.ret(11); return; } // 15e2  ret z
  m.step(0x15e3, 5);            // ret z not taken

  regs.hl = 0x8805;             m.step(0x15e6, 10);
  mem.write8(regs.hl, 0x02);    m.step(0x15e8, 10); // 15e6  ld (hl),0x02 -- main state = 2
  regs.l = 0x0a;                m.step(0x15ea, 7);  // 15e8  ld l,0x0a -- HL = 0x880a
  mem.write8(regs.hl, 0x00);    m.step(0x15ec, 10); // 15ea  ld (hl),0x00 -- sub-index = 0

  m.push16(0x15ef);
  m.step(0x2527, 17);           // 15ec  call 0x2527 (pattern A -> 0x15ef)
  m.call(0x2527);
  m.push16(0x15f2);
  m.step(0x02b9, 17);           // 15ef  call 0x02b9 (pattern A -> 0x15f2)
  m.call(0x02b9);

  regs.hl = 0x855f;             m.step(0x15f5, 10);
  regs.de = 0xffe0;             m.step(0x15f8, 10);
  regs.b = 0x08;                m.step(0x15fa, 7);
  for (;;) { // loc_15fa: blank an 8-tile column bottom-up
    regs.a = 0x10;              m.step(0x15fc, 7);
    mem.write8(regs.hl, regs.a); m.step(0x15fd, 7);
    regs.addHl(regs.de);        m.step(0x15fe, 11); // add hl,de -- HL += 0xffe0 (one row up)
    if (regs.djnz() !== 0) { m.step(0x15fa, 13); continue; }
    m.step(0x1600, 8);
    break;
  }
  m.ret(); // 1600  ret
}
