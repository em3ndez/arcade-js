// SPDX-License-Identifier: GPL-3.0-only
// loc_cd0a  (ROM 0xcd0a-0xcd94) -- per-slot (X=15..0) timer/animation stepper over zp $c0/$d0/$e0/$f0,x
//   with table lookups at $cbcb/$cccb and shadow writes to $60c0/$60c8,x. All branches intra-routine.
export function loc_cd0a(m) {
  const { regs, mem } = m;
  // page-cross penalty (+1) for absolute,Y indexed reads
  const px = (b, i) => (((b & 0xff00) !== ((b + i) & 0xff00)) ? 1 : 0);

  regs.x = 0x0f; regs.setNZ(regs.x); m.step(0xcd0c, 2);
  outer: while (true) {
    toTail: {
      regs.a = mem.read8((0xc0 + regs.x) & 0xff); regs.setNZ(regs.a); m.step(0xcd0e, 4);
      if (regs.fZ) { m.step(0xcd8e, 3); break toTail; } m.step(0xcd10, 2);
      regs.cpx(mem.read8(0xbf)); m.step(0xcd12, 3);
      if (regs.fZ) { m.step(0xcd8e, 3); break toTail; } m.step(0xcd14, 2);
      { const v = (mem.read8((0xe0 + regs.x) & 0xff) - 1) & 0xff; mem.write8((0xe0 + regs.x) & 0xff, v); regs.setNZ(v); } m.step(0xcd16, 6);
      if (!regs.fZ) { m.step(0xcd8e, 3); break toTail; } m.step(0xcd18, 2);
      { const v = (mem.read8((0xf0 + regs.x) & 0xff) - 1) & 0xff; mem.write8((0xf0 + regs.x) & 0xff, v); regs.setNZ(v); } m.step(0xcd1a, 6);
      if (!regs.fZ) {
        m.step(0xcd54, 3);
        // ---- Block C (cd54..cd7d) ----
        regs.a = regs.asl(regs.a); m.step(0xcd55, 2);
        regs.y = regs.a; regs.setNZ(regs.y); m.step(0xcd56, 2);
        if (regs.fC) {
          m.step(0xcd63, 3);
          regs.a = mem.read8((0xcccc + regs.y) & 0xffff); regs.setNZ(regs.a); m.step(0xcd66, 4 + px(0xcccc, regs.y));
          mem.write8((0xe0 + regs.x) & 0xff, regs.a); m.step(0xcd68, 4);
          regs.a = mem.read8((0xcccd + regs.y) & 0xffff); regs.setNZ(regs.a); m.step(0xcd6b, 4 + px(0xcccd, regs.y));
        } else {
          m.step(0xcd58, 2);
          regs.a = mem.read8((0xcbcc + regs.y) & 0xffff); regs.setNZ(regs.a); m.step(0xcd5b, 4 + px(0xcbcc, regs.y));
          mem.write8((0xe0 + regs.x) & 0xff, regs.a); m.step(0xcd5d, 4);
          regs.a = mem.read8((0xcbcd + regs.y) & 0xffff); regs.setNZ(regs.a); m.step(0xcd60, 4 + px(0xcbcd, regs.y));
          regs.clv(); m.step(0xcd61, 2);
          m.step(0xcd6b, 3);
        }
        regs.y = mem.read8((0xd0 + regs.x) & 0xff); regs.setNZ(regs.y); m.step(0xcd6d, 4);
        regs.clc(); m.step(0xcd6e, 2);
        regs.adc(mem.read8((0xd0 + regs.x) & 0xff)); m.step(0xcd70, 4);
        mem.write8((0xd0 + regs.x) & 0xff, regs.a); m.step(0xcd72, 4);
        regs.a = regs.x; regs.setNZ(regs.a); m.step(0xcd73, 2);
        regs.a = regs.lsr(regs.a); m.step(0xcd74, 2);
        if (!regs.fC) { m.step(0xcd7f, 3); }
        else {
          m.step(0xcd76, 2);
          regs.a = regs.y; regs.setNZ(regs.a); m.step(0xcd77, 2);
          regs.eor(mem.read8((0xd0 + regs.x) & 0xff)); m.step(0xcd79, 4);
          regs.and(0xf0); m.step(0xcd7b, 2);
          regs.eor(mem.read8((0xd0 + regs.x) & 0xff)); m.step(0xcd7d, 4);
          mem.write8((0xd0 + regs.x) & 0xff, regs.a); m.step(0xcd7f, 4);
        }
      } else {
        m.step(0xcd1c, 2);
        // ---- Block B (cd1c..cd52), inner loop back to cd1c ----
        cd1cLoop: while (true) {
          { const v = (mem.read8((0xc0 + regs.x) & 0xff) + 1) & 0xff; mem.write8((0xc0 + regs.x) & 0xff, v); regs.setNZ(v); } m.step(0xcd1e, 6);
          { const v = (mem.read8((0xc0 + regs.x) & 0xff) + 1) & 0xff; mem.write8((0xc0 + regs.x) & 0xff, v); regs.setNZ(v); } m.step(0xcd20, 6);
          regs.a = mem.read8((0xc0 + regs.x) & 0xff); regs.setNZ(regs.a); m.step(0xcd22, 4);
          regs.a = regs.asl(regs.a); m.step(0xcd23, 2);
          regs.y = regs.a; regs.setNZ(regs.y); m.step(0xcd24, 2);
          if (regs.fC) {
            m.step(0xcd36, 3);
            regs.a = mem.read8((0xcccb + regs.y) & 0xffff); regs.setNZ(regs.a); m.step(0xcd39, 4 + px(0xcccb, regs.y));
            mem.write8((0xd0 + regs.x) & 0xff, regs.a); m.step(0xcd3b, 4);
            regs.a = mem.read8((0xccce + regs.y) & 0xffff); regs.setNZ(regs.a); m.step(0xcd3e, 4 + px(0xccce, regs.y));
            mem.write8((0xf0 + regs.x) & 0xff, regs.a); m.step(0xcd40, 4);
            regs.a = mem.read8((0xcccc + regs.y) & 0xffff); regs.setNZ(regs.a); m.step(0xcd43, 4 + px(0xcccc, regs.y));
          } else {
            m.step(0xcd26, 2);
            regs.a = mem.read8((0xcbcb + regs.y) & 0xffff); regs.setNZ(regs.a); m.step(0xcd29, 4 + px(0xcbcb, regs.y));
            mem.write8((0xd0 + regs.x) & 0xff, regs.a); m.step(0xcd2b, 4);
            regs.a = mem.read8((0xcbce + regs.y) & 0xffff); regs.setNZ(regs.a); m.step(0xcd2e, 4 + px(0xcbce, regs.y));
            mem.write8((0xf0 + regs.x) & 0xff, regs.a); m.step(0xcd30, 4);
            regs.a = mem.read8((0xcbcc + regs.y) & 0xffff); regs.setNZ(regs.a); m.step(0xcd33, 4 + px(0xcbcc, regs.y));
            regs.clv(); m.step(0xcd34, 2);
            m.step(0xcd43, 3);
          }
          mem.write8((0xe0 + regs.x) & 0xff, regs.a); m.step(0xcd45, 4);
          if (!regs.fZ) { m.step(0xcd51, 3); break cd1cLoop; } m.step(0xcd47, 2);
          mem.write8((0xc0 + regs.x) & 0xff, regs.a); m.step(0xcd49, 4);
          regs.a = mem.read8((0xd0 + regs.x) & 0xff); regs.setNZ(regs.a); m.step(0xcd4b, 4);
          if (regs.fZ) { m.step(0xcd51, 3); break cd1cLoop; } m.step(0xcd4d, 2);
          mem.write8((0xc0 + regs.x) & 0xff, regs.a); m.step(0xcd4f, 4);
          m.step(0xcd1c, 3);
        }
        regs.clv(); m.step(0xcd52, 2);
        m.step(0xcd7f, 3);
      }
      // ---- shared tail cd7f..cd8b ----
      regs.a = mem.read8((0xd0 + regs.x) & 0xff); regs.setNZ(regs.a); m.step(0xcd81, 4);
      regs.cpx(0x08); m.step(0xcd83, 2);
      if (!regs.fC) { m.step(0xcd8b, 3); mem.write8((0x60c0 + regs.x) & 0xffff, regs.a); m.step(0xcd8e, 5); }
      else {
        m.step(0xcd85, 2);
        mem.write8((0x60c8 + regs.x) & 0xffff, regs.a); m.step(0xcd88, 5);
        regs.clv(); m.step(0xcd89, 2);
        m.step(0xcd8e, 3);
      }
    }
    regs.x = (regs.x - 1) & 0xff; regs.setNZ(regs.x); m.step(0xcd8f, 2);
    if (regs.fN) { m.step(0xcd94, 3); break outer; }
    m.step(0xcd91, 2);
    m.step(0xcd0c, 3);
  }
  return m.ret(6);
}
