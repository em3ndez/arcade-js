// SPDX-License-Identifier: GPL-3.0-only
// loc_c9af  (ROM 0xc9af-0xc9f0) -- clears $04, decrements $48,x; when $48|$49==0 jsr $c9f1 then rts. Else picks
// the next active player slot via $3f toggle loop (skips empty $48,x), then sets $02/$00 timers and rts.
export function loc_c9af(m) {
  const { regs, mem } = m;
  regs.a = 0x00; regs.setNZ(regs.a); m.step(0xc9b1, 2);
  mem.write8(0x04, regs.a); m.step(0xc9b3, 3);
  regs.x = mem.read8(0x3d); regs.setNZ(regs.x); m.step(0xc9b5, 3);// c9b3 ldx $3d
  mem.write8((0x48 + regs.x) & 0xff, regs.dec8(mem.read8((0x48 + regs.x) & 0xff))); m.step(0xc9b7, 6);
  regs.a = mem.read8(0x48); regs.setNZ(regs.a); m.step(0xc9b9, 3);// c9b7 lda $48
  regs.ora(mem.read8(0x49)); m.step(0xc9bb, 3);
  if (!regs.fNZ) {
    m.step(0xc9bd, 2);
    m.push16(0xc9bf); m.step(0xc9c0, 6); m.call(0xc9f1);
    regs.clv(); m.step(0xc9c1, 2);
    m.step(0xc9f0, 3);
    return m.ret(6);
  }
  m.step(0xc9c3, 3);
  regs.x = mem.read8(0x3d); regs.setNZ(regs.x); m.step(0xc9c5, 3);// c9c3 ldx $3d
  regs.a = mem.read8((0x48 + regs.x) & 0xff); regs.setNZ(regs.a); m.step(0xc9c7, 4);
  if (!regs.fNZ) {
    m.step(0xc9c9, 2);
    regs.a = 0x0c; regs.setNZ(regs.a); m.step(0xc9cb, 2);
    mem.write8(0x01, regs.a); m.step(0xc9cd, 3);
    regs.a = 0x28; regs.setNZ(regs.a); m.step(0xc9cf, 2);
    mem.write8(0x04, regs.a); m.step(0xc9d1, 3);
  } else {
    m.step(0xc9d1, 3);
  }
  for (;;) {
    regs.a = mem.read8(0x3e); regs.setNZ(regs.a); m.step(0xc9d3, 3);
    if (regs.fZ) {
      m.step(0xc9db, 3);
    } else {
      m.step(0xc9d5, 2);
      regs.a = mem.read8(0x3f); regs.setNZ(regs.a); m.step(0xc9d7, 3);
      regs.eor(0x01); m.step(0xc9d9, 2);
      mem.write8(0x3f, regs.a); m.step(0xc9db, 3);
    }
    regs.x = mem.read8(0x3f); regs.setNZ(regs.x); m.step(0xc9dd, 3);
    regs.a = mem.read8((0x48 + regs.x) & 0xff); regs.setNZ(regs.a); m.step(0xc9df, 4);
    if (regs.fZ) { m.step(0xc9d1, 3); continue; }
    m.step(0xc9e1, 2);
    break;
  }
  regs.a = 0x02; regs.setNZ(regs.a); m.step(0xc9e3, 2);
  regs.y = mem.read8((0x46 + regs.x) & 0xff); regs.setNZ(regs.y); m.step(0xc9e5, 4);
  regs.y = regs.inc8(regs.y); m.step(0xc9e6, 2);
  if (!regs.fNZ) {
    m.step(0xc9e8, 2);
    regs.a = 0x1c; regs.setNZ(regs.a); m.step(0xc9ea, 2);
  } else {
    m.step(0xc9ea, 3);
  }
  mem.write8(0x02, regs.a); m.step(0xc9ec, 3);
  regs.a = 0x0a; regs.setNZ(regs.a); m.step(0xc9ee, 2);
  mem.write8(0x00, regs.a); m.step(0xc9f0, 3);
  return m.ret(6);
}
