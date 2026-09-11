// SPDX-License-Identifier: GPL-3.0-only
// loc_96ab (ROM 0x96ab-0x96c6) -- vector-list coordinate helper reached via the $968f/$969d computed-jmp
// tables (loc_9677/loc_9683). Reads a delta pair from (0x2c),y and re-indexes. Dispatch entries: 0x96ab
// (adjust $2b then walk), 0x96b7 (reload $2b, skip the adjust), 0x96c4 (final (0x2c),y read only).
export function loc_96ab(m) {
  const { regs, mem } = m;
  regs.a = mem.read8(0x2b); regs.setNZ(regs.a); m.step(0x96ad, 3);
  regs.sec(); m.step(0x96ae, 2);
  regs.sbc(0x01); m.step(0x96b0, 2);
  regs.and(0x0f); m.step(0x96b2, 2);
  regs.clc(); m.step(0x96b3, 2);
  regs.adc(0x01); m.step(0x96b5, 2);
  if (regs.fN) { m.step(0x96b7, 2); return loc_96b7(m); } // bpl not taken -> reload $2b
  m.step(0x96b9, 3); return body96b9(m);
}

export function loc_96b7(m) {
  const { regs, mem } = m;
  regs.a = mem.read8(0x2b); regs.setNZ(regs.a); m.step(0x96b9, 3);
  return body96b9(m);
}

function body96b9(m) {
  const { regs, mem } = m;
  mem.write8(0x29, regs.y); m.step(0x96bb, 3);
  regs.y = regs.dec8(regs.y); m.step(0x96bc, 2);
  regs.y = regs.dec8(regs.y); m.step(0x96bd, 2);
  regs.sec(); m.step(0x96be, 2);
  { const p = mem.read8(0x2c) | (mem.read8(0x2d) << 8), e = (p + regs.y) & 0xffff;
    regs.sbc(mem.read8(e)); m.step(0x96c0, 5 + ((p & 0xff00) !== (e & 0xff00) ? 1 : 0)); }
  regs.clc(); m.step(0x96c1, 2);
  regs.adc(mem.read8(0x29)); m.step(0x96c3, 3);
  regs.y = regs.a; regs.setNZ(regs.y); m.step(0x96c4, 2);
  return loc_96c4(m);
}

export function loc_96c4(m) {
  const { regs, mem } = m;
  const p = mem.read8(0x2c) | (mem.read8(0x2d) << 8), e = (p + regs.y) & 0xffff;
  regs.a = mem.read8(e); regs.setNZ(regs.a); m.step(0x96c6, 5 + ((p & 0xff00) !== (e & 0xff00) ? 1 : 0));
  return m.ret(6);
}
