// SPDX-License-Identifier: GPL-3.0-only

// loc_0457  (ROM 0x0457-0x048E) — continue / next-life path: if no life credit remains (0x83CE=0)
// resume the play loop, else clear the per-life HUD slots (0x839A/0x839B, 0x83A0-0x83AD) and branch.
export function loc_0457(m) {
  const { regs, mem } = m;

  m.push16(0x045a);
  m.step(0x0b1f, 17); // call 0x0b1f
  m.call(0x0b1f);

  regs.a = mem.read8(0x83ce);
  m.step(0x045d, 13); // A = (0x83ce) life-credit flag
  regs.or(regs.a);
  m.step(0x045e, 4);
  if (regs.fZ) {
    m.step(0x0368, 10); // jp z,0x0368 -- no life left
    return m.call(0x0368);
  }
  m.step(0x0461, 10);

  m.push16(0x0464);
  m.step(0x0804, 17); // call 0x0804
  m.call(0x0804);
  m.push16(0x0467);
  m.step(0x07e6, 17); // call 0x07e6
  m.call(0x07e6);

  regs.xor(regs.a);
  m.step(0x0468, 4); // A = 0
  regs.hl = 0x839a;
  m.step(0x046b, 10);
  mem.write8(regs.hl, regs.a);
  m.step(0x046c, 7); // (0x839a) = 0
  regs.l = regs.inc8(regs.l);
  m.step(0x046d, 4);
  mem.write8(regs.hl, regs.a);
  m.step(0x046e, 7); // (0x839b) = 0
  mem.write8(0x83cc, regs.a);
  m.step(0x0471, 13); // (0x83cc) = 0
  mem.write8(0x83ea, regs.a);
  m.step(0x0474, 13); // (0x83ea) = 0

  regs.hl = 0x83a0;
  m.step(0x0477, 10);
  regs.de = 0x83a1;
  m.step(0x047a, 10);
  regs.bc = 0x000d;
  m.step(0x047d, 10);
  mem.write8(regs.hl, regs.a);
  m.step(0x047e, 7); // (0x83a0) = 0 -- seeds the fill
  m.ldirAt(0x047e, 0x0480); // clear 0x83a0-0x83ad

  regs.a = 0x80;
  m.step(0x0482, 7);
  m.push16(0x0483);
  m.step(0x0018, 11); // rst 0x18 -- enqueue sound 0x80
  m.call(0x0018);

  regs.a = mem.read8(0x83cf);
  m.step(0x0486, 13); // A = (0x83cf) intro-timer flag
  regs.or(regs.a);
  m.step(0x0487, 4);
  if (regs.fNZ) {
    m.step(0x048f, 12); // jr nz,0x048f -- run the intro countdown
    return m.call(0x048f);
  }
  m.step(0x0489, 7);

  m.push16(0x048c);
  m.step(0x0822, 17); // call 0x0822
  m.call(0x0822);
  m.step(0x0368, 10); // jp 0x0368
  return m.call(0x0368);
}
