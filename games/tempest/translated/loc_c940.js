// SPDX-License-Identifier: GPL-3.0-only
// loc_c940  (ROM 0xc940-0xc97a) -- inits $00/$01/$02 sizing, on $3f!=$3d & $05 negative sets the "new-level"
// timers ($01/$00/$04 via $0117 pick) + jsr $92b2; convergence at c96c jsr $ca48, load $46,x->$9f, jsr $9025,
// then tail-jmp $cd95.
export function loc_c940(m) {
  const { regs, mem } = m;
  regs.a = 0x00; regs.setNZ(regs.a); m.step(0xc942, 2);
  mem.write8(0x01, regs.a); m.step(0xc944, 3);
  regs.a = 0x1e; regs.setNZ(regs.a); m.step(0xc946, 2);
  mem.write8(0x00, regs.a); m.step(0xc948, 3);
  mem.write8(0x02, regs.a); m.step(0xc94a, 3);
  regs.a = mem.read8(0x3f); regs.setNZ(regs.a); m.step(0xc94c, 3);// c94a lda $3f
  regs.cmp(mem.read8(0x3d)); m.step(0xc94e, 3);
  if (regs.fZ) {
    m.step(0xc96c, 3);
  } else {
    m.step(0xc950, 2);
    mem.write8(0x3d, regs.a); m.step(0xc952, 3);
    regs.a = mem.read8(0x05); regs.setNZ(regs.a); m.step(0xc954, 3);
    if (regs.fPl) {
      m.step(0xc96c, 3);
    } else {
      m.step(0xc956, 2);
      regs.a = 0x0e; regs.setNZ(regs.a); m.step(0xc958, 2);
      mem.write8(0x01, regs.a); m.step(0xc95a, 3);
      regs.a = 0x0a; regs.setNZ(regs.a); m.step(0xc95c, 2);
      mem.write8(0x00, regs.a); m.step(0xc95e, 3);
      regs.a = 0x50; regs.setNZ(regs.a); m.step(0xc960, 2);
      regs.y = mem.read8(0x0117); regs.setNZ(regs.y); m.step(0xc963, 4);
      if (regs.fZ) {
        m.step(0xc967, 3);
      } else {
        m.step(0xc965, 2);
        regs.a = 0x28; regs.setNZ(regs.a); m.step(0xc967, 2);
      }
      mem.write8(0x04, regs.a); m.step(0xc969, 3);
      m.push16(0xc96b); m.step(0xc96c, 6); m.call(0x92b2);
    }
  }
  m.push16(0xc96e); m.step(0xc96f, 6); m.call(0xca48);
  regs.x = mem.read8(0x3d); regs.setNZ(regs.x); m.step(0xc971, 3);// c96f ldx $3d
  regs.a = mem.read8((0x46 + regs.x) & 0xff); regs.setNZ(regs.a); m.step(0xc973, 4);
  mem.write8(0x9f, regs.a); m.step(0xc975, 3);
  m.push16(0xc977); m.step(0xc978, 6); m.call(0x9025);
  m.step(0xcd95, 3); return m.call(0xcd95);
}
