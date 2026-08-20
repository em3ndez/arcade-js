// SPDX-License-Identifier: GPL-3.0-only

// loc_062a  (ROM 0x062a-0x0643) -- packed-nibble -> BCD converter. Treats A as
// (hi<<4 | lo): the low nibble is BCD-corrected into C, then BCD 0x16 is added
// `hi` times (daa each step) to weight the high nibble by 16, and finally C is
// added back (daa). Result A = BCD of (hi*16 + lo). No calls.
export function loc_062a(m) {
  const { regs } = m;

  regs.b = regs.a;      m.step(0x062b, 4);
  regs.and(0x0f);       m.step(0x062d, 7);
  regs.add(0x00);       m.step(0x062f, 7); // arm the daa flags for the low nibble
  regs.daa();           m.step(0x0630, 4);
  regs.c = regs.a;      m.step(0x0631, 4); // C = BCD low nibble
  regs.a = regs.b;      m.step(0x0632, 4);
  regs.and(0xf0);       m.step(0x0634, 7);

  if (regs.fZ) {
    m.step(0x0641, 12); // jr z,0x0641 taken -- no high nibble, A already 0
  } else {
    m.step(0x0636, 7);  // jr z not taken
    regs.rrca();        m.step(0x0637, 4);
    regs.rrca();        m.step(0x0638, 4);
    regs.rrca();        m.step(0x0639, 4);
    regs.rrca();        m.step(0x063a, 4); // A = high nibble (loop count)
    regs.b = regs.a;    m.step(0x063b, 4);
    regs.xor(regs.a);   m.step(0x063c, 4); // A = 0
    for (;;) { // loc_063c: A += BCD 0x16 once per high-nibble unit
      regs.add(0x16);   m.step(0x063e, 7);
      regs.daa();       m.step(0x063f, 4);
      if (regs.djnz() !== 0) { m.step(0x063c, 13); continue; }
      m.step(0x0641, 8); // djnz not taken
      break;
    }
  }

  regs.add(regs.c);     m.step(0x0642, 4); // fold the low-nibble BCD back in
  regs.daa();           m.step(0x0643, 4);
  m.ret(); // 0643  ret
}
