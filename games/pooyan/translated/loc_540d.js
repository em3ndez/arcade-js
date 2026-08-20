// SPDX-License-Identifier: GPL-3.0-only

// loc_540d  (ROM 0x540d-0x5432) -- enemy-spawn driver, gated on 0x8907 bit0. Blanks two 6-byte
// HUD rows (0x8d01, 0x8d11) via rst 0x10 (loc_0010 memset, A=0), then walks 3 object blocks at
// IX (base 0x8c30, stride 0x18) calling loc_5433 on each. exx parks the loop counter B and stride
// DE across loc_5433's clobber of BC/DE/HL; IX is untouched by exx and by loc_5433, so add ix,de
// advances the block pointer between iterations.
export function loc_540d(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x8907);       m.step(0x5410, 13);
  regs.and(0x01);                   m.step(0x5412, 7);
  if (regs.fZ) { m.ret(11); return; } // ret z -- gate closed
  m.step(0x5413, 5);
  regs.xor(regs.a);                 m.step(0x5414, 4);
  regs.hl = 0x8d01;                 m.step(0x5417, 10);
  regs.b = 0x06;                    m.step(0x5419, 7);
  m.push16(0x541a);
  m.step(0x0010, 11);               // 5419  rst 0x10 (loc_0010 fill 6 bytes = 0)
  m.call(0x0010);
  regs.hl = 0x8d11;                 m.step(0x541d, 10);
  regs.b = 0x06;                    m.step(0x541f, 7);
  m.push16(0x5420);
  m.step(0x0010, 11);               // 541f  rst 0x10 (loc_0010 fill 6 bytes = 0)
  m.call(0x0010);
  regs.ix = 0x8c30;                 m.step(0x5424, 14);
  regs.de = 0x0018;                 m.step(0x5427, 10);
  regs.b = 0x03;                    m.step(0x5429, 7);

  for (;;) { // loc_5429: process one object block per iteration
    regs.exx();                     m.step(0x542a, 4);  // park counter B + stride DE
    m.push16(0x542d);
    m.step(0x5433, 17);             // 542a  call 0x5433
    m.call(0x5433);
    regs.exx();                     m.step(0x542e, 4);  // restore B + DE
    regs.addIx(regs.de);            m.step(0x5430, 15); // IX += 0x18
    if (regs.djnz() !== 0) { m.step(0x5429, 13); continue; }
    m.step(0x5432, 8);
    break;
  }

  m.ret(); // 5432  ret
}
