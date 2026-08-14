// SPDX-License-Identifier: GPL-3.0-only

// loc_04f3  (ROM 0x04F3-0x0533) — player-2 continue setup: set (0x83CA)=1, then if (0x83C9)!=0 branch
// to the cold-start mid-entry 0x0557; else clear the screen, seed the continue flags (0x83FE/0x825D)
// + the 0x8263-0x8267 table, copy the two work-RAM images (0x86C0->0x800C, 0x8500->0x80FF), set
// (0x803F)=1, and jp 0x0368.
export function loc_04f3(m) {
  const { regs, mem } = m;

  regs.hl = 0x83ca;
  m.step(0x04f6, 10);
  mem.write8(regs.hl, 0x01);
  m.step(0x04f8, 10); // (0x83ca) = 1
  regs.hl = (regs.hl - 1) & 0xffff;
  m.step(0x04f9, 6);
  regs.a = mem.read8(regs.hl);
  m.step(0x04fa, 7); // A = (0x83c9) continue flag
  regs.or(regs.a);
  m.step(0x04fb, 4);
  if (regs.fNZ) {
    m.step(0x0557, 10); // jp nz,0x0557 -- already continuing: cold-start mid-entry
    return m.call(0x0557);
  }
  m.step(0x04fe, 10);

  m.push16(0x04ff);
  m.step(0x0038, 11); // rst 0x38 -- clear the screen
  m.call(0x0038);
  m.push16(0x0502);
  m.step(0x0822, 17);
  m.call(0x0822);

  regs.a = 0x01;
  m.step(0x0504, 7);
  mem.write8(0x83fe, regs.a);
  m.step(0x0507, 13); // (0x83fe) = 1 single-player flag
  mem.write8(0x825d, regs.a);
  m.step(0x050a, 13); // (0x825d) = 1
  regs.hl = 0x8263;
  m.step(0x050d, 10);
  regs.de = 0x8264;
  m.step(0x0510, 10);
  regs.bc = 0x0004;
  m.step(0x0513, 10);
  mem.write8(regs.hl, regs.b);
  m.step(0x0514, 7); // seed (0x8263) = 0
  m.ldirAt(0x0514, 0x0516); // clear 0x8263-0x8267

  regs.hl = 0x86c0;
  m.step(0x0519, 10);
  regs.de = 0x800c;
  m.step(0x051c, 10);
  regs.bc = 0x002b;
  m.step(0x051f, 10);
  m.ldirAt(0x051f, 0x0521); // copy 0x86c0-0x86ea -> 0x800c-0x8036

  regs.a = 0x01;
  m.step(0x0523, 7);
  mem.write8(0x803f, regs.a);
  m.step(0x0526, 13); // (0x803f) = 1
  regs.hl = 0x8500;
  m.step(0x0529, 10);
  regs.de = 0x80ff;
  m.step(0x052c, 10);
  regs.bc = 0x00b7;
  m.step(0x052f, 10);
  m.ldirAt(0x052f, 0x0531); // copy 0x8500-0x85b6 -> 0x80ff-0x81b5

  m.step(0x0368, 10); // jp 0x0368
  return m.call(0x0368);
}
