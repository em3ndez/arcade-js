// SPDX-License-Identifier: GPL-3.0-only

// loc_20d4  (ROM 0x20d4-0x2100) -- object update gate then a fixed helper chain. (0x8f50) set clears
// (0x8d32) and probes the 0x8df8/0x8df9 pair (falling back to (0x8d32) if it masks to 0); the selected
// byte non-zero -> tail-jump to loc_241e. Otherwise seed IX=0x8a80 and run 0x2329, 0x2101, 0x2563,
// 0x25a6, 0x308b in order, then ret. 0x2329/0x2101 are boundaries (batch 10); the rest are translated.
export function loc_20d4(m) {
  const { regs, mem } = m;

  regs.hl = 0x8d32;               m.step(0x20d7, 10);
  regs.a = mem.read8(0x8f50);      m.step(0x20da, 13);
  regs.and(regs.a);               m.step(0x20db, 4);

  let atE8 = false; // reached the shared 0x20e8 (ld a,(hl); and a) block
  if (regs.fZ) {
    m.step(0x20e8, 12);
    atE8 = true;
  } else {
    m.step(0x20dd, 7);
    mem.write8(regs.hl, 0x00);     m.step(0x20df, 10);
    regs.b = regs.l;              m.step(0x20e0, 4);  // park 0x32
    regs.l = 0xf8;                m.step(0x20e2, 7);  // hl = 0x8df8
    regs.a = mem.read8(regs.hl);   m.step(0x20e3, 7);
    regs.hl = (regs.hl + 1) & 0xffff; m.step(0x20e4, 6); // -> 0x8df9
    regs.and(mem.read8(regs.hl));  m.step(0x20e5, 7);
    if (regs.fNZ) {
      m.step(0x20ea, 12);
    } else {
      m.step(0x20e7, 7);
      regs.l = regs.b;            m.step(0x20e8, 4);  // restore 0x8d32, fall into 0x20e8
      atE8 = true;
    }
  }

  if (atE8) {
    regs.a = mem.read8(regs.hl);   m.step(0x20e9, 7);
    regs.and(regs.a);             m.step(0x20ea, 4);
  }

  if (regs.fNZ) {
    m.step(0x241e, 10);           // jp nz -- conditional tail (reuses the caller frame, no push16)
    return m.call(0x241e);
  }
  m.step(0x20ed, 10);

  regs.ix = 0x8a80;               m.step(0x20f1, 14);
  m.push16(0x20f4); m.step(0x2329, 17); m.call(0x2329); // 0x2329 boundary
  m.push16(0x20f7); m.step(0x2101, 17); m.call(0x2101); // 0x2101 boundary
  m.push16(0x20fa); m.step(0x2563, 17); m.call(0x2563);
  m.push16(0x20fd); m.step(0x25a6, 17); m.call(0x25a6);
  m.push16(0x2100); m.step(0x308b, 17); m.call(0x308b);
  return m.ret(10);
}
