// SPDX-License-Identifier: GPL-3.0-only

// loc_585b  (ROM 0x585b-0x5870) -- 16-bit sum-of-bytes over a B-length table at HL, accumulating
// into A (low) and D (high, bumped on each carry). Afterward A-=0xc1; only when that is zero and
// D==0x1d does it early-return; every other outcome sets the tamper cell (0x882b)=1. A ROM
// integrity tripwire. Pure leaf (no calls).
export function loc_585b(m) {
  const { regs, mem } = m;

  for (;;) { // loc_585b
    regs.e = mem.read8(regs.hl);      m.step(0x585c, 7);
    regs.add(regs.e);                 m.step(0x585d, 4);
    if (regs.fC) {
      m.step(0x585f, 7);              // jr nc not taken -- carry into the high byte
      regs.d = regs.inc8(regs.d);     m.step(0x5860, 4);
    } else {
      m.step(0x5860, 12);             // jr nc,0x5860
    }
    regs.hl = (regs.hl + 1) & 0xffff; m.step(0x5861, 6);
    if (regs.djnz()) { m.step(0x585b, 13); continue; }
    m.step(0x5863, 8);
    break;
  }

  regs.sub(0xc1);                     m.step(0x5865, 7);
  if (regs.fNZ) {
    m.step(0x586b, 12);               // jr nz,0x586b -- checksum mismatch
  } else {
    m.step(0x5867, 7);
    regs.a = 0x1d;                    m.step(0x5869, 7);
    regs.cp(regs.d);                  m.step(0x586a, 4);
    if (regs.fZ) { m.ret(11); return; } // ret z -- checksum OK
    m.step(0x586b, 5);
  }

  regs.a = 0x01;                      m.step(0x586d, 7);
  mem.write8(0x882b, regs.a);         m.step(0x5870, 13); // tamper tripwire
  m.ret();
}
