// SPDX-License-Identifier: GPL-3.0-only
// loc_b2fe  (ROM 0xb2fe-0xb331) -- jsr 0xdf09 (preserving A), set ptr $3b/$3c from $ce8c[2A], toggle
// bit0 of $0415,x; pick a word from $ceb0[2A] (if now !=0) or $ce9e[2A] (==0) and store it via ($3b).
export function loc_b2fe(m) {
  const { regs, mem } = m;
  m.push8(regs.a); m.step(0xb2ff, 3);
  m.push16(0xb301); m.step(0xb302, 6); m.call(0xdf09);
  regs.a = m.pull8(); regs.setNZ(regs.a); m.step(0xb303, 4);
  regs.x = regs.a; regs.setNZ(regs.x); m.step(0xb304, 2);
  regs.a = regs.asl(regs.a); m.step(0xb305, 2);
  regs.y = regs.a; regs.setNZ(regs.y); m.step(0xb306, 2);
  { const ea = (0xce8c + regs.y) & 0xffff; regs.a = mem.read8(ea); regs.setNZ(regs.a); m.step(0xb309, (0xce8c & 0xff00) !== (ea & 0xff00) ? 5 : 4); }
  mem.write8(0x3b, regs.a); m.step(0xb30b, 3);
  { const ea = (0xce8d + regs.y) & 0xffff; regs.a = mem.read8(ea); regs.setNZ(regs.a); m.step(0xb30e, (0xce8d & 0xff00) !== (ea & 0xff00) ? 5 : 4); }
  mem.write8(0x3c, regs.a); m.step(0xb310, 3);
  { const ea = (0x0415 + regs.x) & 0xffff; regs.a = mem.read8(ea); regs.setNZ(regs.a); m.step(0xb313, (0x0415 & 0xff00) !== (ea & 0xff00) ? 5 : 4); }
  regs.eor(0x01); m.step(0xb315, 2);
  mem.write8((0x0415 + regs.x) & 0xffff, regs.a); m.step(0xb318, 5);
  if (regs.fNZ) { // b318 bne 0xb323 (taken) -- toggled value nonzero
    m.step(0xb323, 3);
    { const ea = (0xceb0 + regs.y) & 0xffff; regs.a = mem.read8(ea); regs.setNZ(regs.a); m.step(0xb326, (0xceb0 & 0xff00) !== (ea & 0xff00) ? 5 : 4); }
    { const ea = (0xceb1 + regs.y) & 0xffff; regs.x = mem.read8(ea); regs.setNZ(regs.x); m.step(0xb329, (0xceb1 & 0xff00) !== (ea & 0xff00) ? 5 : 4); }
  } else {
    m.step(0xb31a, 2);
    { const ea = (0xce9e + regs.y) & 0xffff; regs.a = mem.read8(ea); regs.setNZ(regs.a); m.step(0xb31d, (0xce9e & 0xff00) !== (ea & 0xff00) ? 5 : 4); }
    { const ea = (0xce9f + regs.y) & 0xffff; regs.x = mem.read8(ea); regs.setNZ(regs.x); m.step(0xb320, (0xce9f & 0xff00) !== (ea & 0xff00) ? 5 : 4); }
    regs.clv(); m.step(0xb321, 2);
    m.step(0xb329, 3);
  }
  regs.y = 0x00; regs.setNZ(regs.y); m.step(0xb32b, 2);
  mem.write8((mem.read16(0x003b) + regs.y) & 0xffff, regs.a); m.step(0xb32d, 6);
  regs.a = regs.x; regs.setNZ(regs.a); m.step(0xb32e, 2);
  regs.y = regs.inc8(regs.y); m.step(0xb32f, 2);
  mem.write8((mem.read16(0x003b) + regs.y) & 0xffff, regs.a); m.step(0xb331, 6);
  return m.ret(6);
}
