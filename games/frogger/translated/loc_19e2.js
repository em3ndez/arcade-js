// SPDX-License-Identifier: GPL-3.0-only

// loc_19e2  (ROM 0x19E2-0x19F5) — blit a 0x0E-row string of the 4-tile group {0x48,0x49 / 0x4A,0x4B}
// into VRAM from the caller's HL, stepping by +0x1F then +1 within each row pair. Called from
// loc_0942 and loc_0F59.
export function loc_19e2(m) {
  const { regs, mem } = m;

  regs.b = 0x0e;
  m.step(0x19e4, 7); // B = 0x0e rows

  for (;;) {
    // loc_19e4: one row group
    mem.write8(regs.hl, 0x48);
    m.step(0x19e6, 10);
    regs.hl = (regs.hl + 1) & 0xffff;
    m.step(0x19e7, 6);
    mem.write8(regs.hl, 0x49);
    m.step(0x19e9, 10);
    regs.de = 0x001f;
    m.step(0x19ec, 10);
    regs.addHl(regs.de);
    m.step(0x19ed, 11);
    mem.write8(regs.hl, 0x4a);
    m.step(0x19ef, 10);
    regs.hl = (regs.hl + 1) & 0xffff;
    m.step(0x19f0, 6);
    mem.write8(regs.hl, 0x4b);
    m.step(0x19f2, 10);
    regs.addHl(regs.de);
    m.step(0x19f3, 11);
    if (m.regs.djnz() !== 0) {
      m.step(0x19e4, 13);
      continue;
    }
    m.step(0x19f5, 8);
    break;
  }

  m.ret();
}
