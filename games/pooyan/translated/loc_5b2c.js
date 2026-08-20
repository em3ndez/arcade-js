// SPDX-License-Identifier: GPL-3.0-only

// loc_5b2c  (ROM 0x5b2c-0x5b70) -- end-of-wave object-table cleanup, gated by 0x8d75/0x8d79.
// When 0x8d77==0 it scans 6 records at 0x8ae4 (stride 0x18) for a first byte matching C (0x13,
// or 0x0b when 0x8907 bit0 is set) and returns on a miss-through; on a hit -- or when 0x8d77 is
// set -- it sweeps 6 objects at 0x8ae0 through loc_5b71 under exx and zeroes 0x8d75/0x8f20.
export function loc_5b2c(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x8d75);        m.step(0x5b2f, 13);
  regs.and(regs.a);                  m.step(0x5b30, 4);
  if (regs.fZ) { m.ret(11); return; }
  m.step(0x5b31, 5);
  regs.a = mem.read8(0x8d79);        m.step(0x5b34, 13);
  regs.and(regs.a);                  m.step(0x5b35, 4);
  if (regs.fNZ) { m.ret(11); return; }
  m.step(0x5b36, 5);
  regs.a = mem.read8(0x8d77);        m.step(0x5b39, 13);
  regs.and(regs.a);                  m.step(0x5b3a, 4);
  if (regs.fZ) {
    m.step(0x5b3c, 7);              // jr nz not taken -- run the scan
    regs.hl = 0x8ae4;               m.step(0x5b3f, 10);
    regs.de = 0x0018;               m.step(0x5b42, 10);
    regs.b = 0x06;                  m.step(0x5b44, 7);
    regs.c = 0x13;                  m.step(0x5b46, 7);
    regs.a = mem.read8(0x8907);     m.step(0x5b49, 13);
    regs.bit(0, regs.a);            m.step(0x5b4b, 8);
    if (regs.fZ) {
      m.step(0x5b4f, 12);          // bit0 clear -- keep c=0x13
    } else {
      m.step(0x5b4d, 7);
      regs.c = 0x0b;               m.step(0x5b4f, 7);
    }
    for (;;) { // loc_5b4f
      regs.a = mem.read8(regs.hl);  m.step(0x5b50, 7);
      regs.cp(regs.c);              m.step(0x5b51, 4);
      if (regs.fZ) { m.step(0x5b57, 12); break; } // hit -> exx sweep
      m.step(0x5b53, 7);
      regs.addHl(regs.de);          m.step(0x5b54, 11);
      if (regs.djnz()) { m.step(0x5b4f, 13); continue; }
      m.step(0x5b56, 8);
      m.ret(10); return;            // scanned all 6, no hit
    }
  } else {
    m.step(0x5b57, 12);            // jr nz taken -> exx sweep
  }

  // loc_5b57: call loc_5b71 per object (IX stride 0x18) under exx, then clear the wave flags
  regs.ix = 0x8ae0;               m.step(0x5b5b, 14);
  regs.de = 0x0018;               m.step(0x5b5e, 10);
  regs.b = 0x06;                  m.step(0x5b60, 7);
  for (;;) {
    regs.exx();                    m.step(0x5b61, 4);
    m.push16(0x5b64);
    m.step(0x5b71, 17);            // call 0x5b71 (boundary)
    m.call(0x5b71);
    regs.exx();                    m.step(0x5b65, 4);
    regs.addIx(regs.de);           m.step(0x5b67, 15);
    if (regs.djnz()) { m.step(0x5b60, 13); continue; }
    m.step(0x5b69, 8);
    break;
  }
  regs.xor(regs.a);               m.step(0x5b6a, 4);
  mem.write8(0x8d75, regs.a);     m.step(0x5b6d, 13);
  mem.write8(0x8f20, regs.a);     m.step(0x5b70, 13);
  m.ret();
}
