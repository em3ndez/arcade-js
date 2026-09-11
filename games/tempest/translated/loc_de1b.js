// SPDX-License-Identifier: GPL-3.0-only
// loc_de1b  (ROM 0xde1b-0xdf08) -- EAROM/vector state machine over $01ca..$01cf and the $6000/$6040/$6050
// port block; an outer loop (jmp 0xde1b) re-enters from the top until $01cb count (in Y at 0xdf02) is
// nonzero. Uses the ($bd),y pointer set from tables at 0xdddd. Intra-routine control flow is JS; the two
// inner loops (ror/asl at 0xde33, sta at 0xded8) are do/for loops charging branch T-states per iteration.
export function loc_de1b(m) {
  const { regs, mem } = m;
  outer: for (;;) {
    let toDe6b = false;
    regs.a = mem.read8(0x01ca); regs.setNZ(regs.a); m.step(0xde1e, 4);
    if (!regs.fZ) {
      m.step(0xde6b, 3); toDe6b = true;
    } else {
      m.step(0xde20, 2);
      regs.a = mem.read8(0x01c7); regs.setNZ(regs.a); m.step(0xde23, 4);
      if (regs.fZ) {
        m.step(0xde6b, 3); toDe6b = true;
      } else {
        m.step(0xde25, 2);
        regs.x = 0x00; regs.setNZ(regs.x); m.step(0xde27, 2);
        mem.write8(0x01cb, regs.x); m.step(0xde2a, 4);
        mem.write8(0x01cf, regs.x); m.step(0xde2d, 4);
        mem.write8(0x01ce, regs.x); m.step(0xde30, 4);
        regs.x = 0x08; regs.setNZ(regs.x); m.step(0xde32, 2);
        regs.sec(); m.step(0xde33, 2);
        for (;;) {
          mem.write8(0x01ce, regs.ror(mem.read8(0x01ce))); m.step(0xde36, 6);
          regs.a = regs.asl(regs.a); m.step(0xde37, 2);
          regs.x = regs.dec8(regs.x); m.step(0xde38, 2);
          if (!regs.fC) { m.step(0xde33, 3); continue; }
          m.step(0xde3a, 2); break;
        }
        regs.y = 0x80; regs.setNZ(regs.y); m.step(0xde3c, 2);
        regs.a = mem.read8(0x01ce); regs.setNZ(regs.a); m.step(0xde3f, 4);
        regs.and(mem.read8(0x01c8)); m.step(0xde42, 4);
        if (!regs.fZ) {
          m.step(0xde46, 3);
        } else {
          m.step(0xde44, 2);
          regs.y = 0x20; regs.setNZ(regs.y); m.step(0xde46, 2);
        }
        mem.write8(0x01ca, regs.y); m.step(0xde49, 4);
        regs.a = mem.read8(0x01ce); regs.setNZ(regs.a); m.step(0xde4c, 4);
        regs.eor(mem.read8(0x01c7)); m.step(0xde4f, 4);
        mem.write8(0x01c7, regs.a); m.step(0xde52, 4);
        regs.a = regs.x; regs.setNZ(regs.a); m.step(0xde53, 2);
        regs.a = regs.asl(regs.a); m.step(0xde54, 2);
        regs.x = regs.a; regs.setNZ(regs.x); m.step(0xde55, 2);
        regs.a = mem.read8((0xdddd + regs.x) & 0xffff); regs.setNZ(regs.a); m.step(0xde58, 4);
        mem.write8(0x01cc, regs.a); m.step(0xde5b, 4);
        regs.a = mem.read8((0xddde + regs.x) & 0xffff); regs.setNZ(regs.a); m.step(0xde5e, 4);
        mem.write8(0x01cd, regs.a); m.step(0xde61, 4);
        regs.a = mem.read8((0xdde3 + regs.x) & 0xffff); regs.setNZ(regs.a); m.step(0xde64, 4);
        mem.write8(0x00bd, regs.a); m.step(0xde66, 3);
        regs.a = mem.read8((0xdde4 + regs.x) & 0xffff); regs.setNZ(regs.a); m.step(0xde69, 4);
        mem.write8(0x00be, regs.a); m.step(0xde6b, 3);
      }
    }
    void toDe6b;
    // de6b common block
    regs.y = 0x00; regs.setNZ(regs.y); m.step(0xde6d, 2);
    mem.write8(0x6040, regs.y); m.step(0xde70, 4);
    regs.a = mem.read8(0x01ca); regs.setNZ(regs.a); m.step(0xde73, 4);
    if (regs.fZ) { m.step(0xde75, 2); return m.ret(6); }
    m.step(0xde76, 3);

    // de76 dispatch on asl of A (the $01ca value)
    regs.y = mem.read8(0x01cb); regs.setNZ(regs.y); m.step(0xde79, 4);
    regs.x = mem.read8(0x01cc); regs.setNZ(regs.x); m.step(0xde7c, 4);
    regs.a = regs.asl(regs.a); m.step(0xde7d, 2);
    L_deff: {
      L_def2: {
        L_def0: {
          L_deee: {
            L_dee6: {
              if (regs.fC) {
                m.step(0xde7f, 2);
                mem.write8((0x6000 + regs.x) & 0xffff, regs.a); m.step(0xde82, 5);
                regs.a = 0x40; regs.setNZ(regs.a); m.step(0xde84, 2);
                mem.write8(0x01ca, regs.a); m.step(0xde87, 4);
                regs.y = 0x0e; regs.setNZ(regs.y); m.step(0xde89, 2);
                regs.clv(); m.step(0xde8a, 2);
                m.step(0xdeff, 3); break L_deff;
              }
              m.step(0xde8c, 3);
              if (regs.fN) {
                m.step(0xde8e, 2);
                regs.a = 0x80; regs.setNZ(regs.a); m.step(0xde90, 2);
                mem.write8(0x01ca, regs.a); m.step(0xde93, 4);
                regs.a = mem.read8(0x01c6); regs.setNZ(regs.a); m.step(0xde96, 4);
                if (regs.fZ) {
                  m.step(0xde9c, 3);
                } else {
                  m.step(0xde98, 2);
                  regs.a = 0x00; regs.setNZ(regs.a); m.step(0xde9a, 2);
                  mem.write8(((mem.read8(0x00bd) | (mem.read8(0x00be) << 8)) + regs.y) & 0xffff, regs.a); m.step(0xde9c, 6);
                }
                regs.a = mem.read8(((mem.read8(0x00bd) | (mem.read8(0x00be) << 8)) + regs.y) & 0xffff); regs.setNZ(regs.a); m.step(0xde9e, 5);
                regs.cpx(mem.read8(0x01cd)); m.step(0xdea1, 4);
                if (!regs.fC) {
                  m.step(0xdeab, 3);
                } else {
                  m.step(0xdea3, 2);
                  regs.a = 0x00; regs.setNZ(regs.a); m.step(0xdea5, 2);
                  mem.write8(0x01ca, regs.a); m.step(0xdea8, 4);
                  regs.a = mem.read8(0x01cf); regs.setNZ(regs.a); m.step(0xdeab, 4);
                }
                mem.write8((0x6000 + regs.x) & 0xffff, regs.a); m.step(0xdeae, 5);
                regs.y = 0x0c; regs.setNZ(regs.y); m.step(0xdeb0, 2);
                regs.clv(); m.step(0xdeb1, 2);
                m.step(0xdef2, 3); break L_def2;
              }
              m.step(0xdeb3, 3);
              regs.a = 0x08; regs.setNZ(regs.a); m.step(0xdeb5, 2);
              mem.write8(0x6040, regs.a); m.step(0xdeb8, 4);
              mem.write8((0x6000 + regs.x) & 0xffff, regs.a); m.step(0xdebb, 5);
              regs.a = 0x09; regs.setNZ(regs.a); m.step(0xdebd, 2);
              mem.write8(0x6040, regs.a); m.step(0xdec0, 4);
              m.step(0xdec1, 2);
              regs.a = 0x08; regs.setNZ(regs.a); m.step(0xdec3, 2);
              mem.write8(0x6040, regs.a); m.step(0xdec6, 4);
              regs.cpx(mem.read8(0x01cd)); m.step(0xdec9, 4);
              regs.a = mem.read8(0x6050); regs.setNZ(regs.a); m.step(0xdecc, 4);
              if (!regs.fC) { m.step(0xdeee, 3); break L_deee; }
              m.step(0xdece, 2);
              regs.eor(mem.read8(0x01cf)); m.step(0xded1, 4);
              if (regs.fZ) { m.step(0xdee6, 3); break L_dee6; }
              m.step(0xded3, 2);
              regs.a = 0x00; regs.setNZ(regs.a); m.step(0xded5, 2);
              regs.y = mem.read8(0x01cb); regs.setNZ(regs.y); m.step(0xded8, 4);
              for (;;) {
                mem.write8(((mem.read8(0x00bd) | (mem.read8(0x00be) << 8)) + regs.y) & 0xffff, regs.a); m.step(0xdeda, 6);
                regs.y = regs.dec8(regs.y); m.step(0xdedb, 2);
                if (!regs.fN) { m.step(0xded8, 3); continue; }
                m.step(0xdedd, 2); break;
              }
              regs.a = mem.read8(0x01ce); regs.setNZ(regs.a); m.step(0xdee0, 4);
              regs.ora(mem.read8(0x01c9)); m.step(0xdee3, 4);
              mem.write8(0x01c9, regs.a); m.step(0xdee6, 4);
              break L_dee6;
            }
            // dee6 code
            regs.a = 0x00; regs.setNZ(regs.a); m.step(0xdee8, 2);
            mem.write8(0x01ca, regs.a); m.step(0xdeeb, 4);
            regs.clv(); m.step(0xdeec, 2);
            m.step(0xdef0, 3); break L_def0;
          }
          // deee code
          mem.write8(((mem.read8(0x00bd) | (mem.read8(0x00be) << 8)) + regs.y) & 0xffff, regs.a); m.step(0xdef0, 6);
        }
        // def0 code
        regs.y = 0x00; regs.setNZ(regs.y); m.step(0xdef2, 2);
      }
      // def2 code
      regs.clc(); m.step(0xdef3, 2);
      regs.adc(mem.read8(0x01cf)); m.step(0xdef6, 4);
      mem.write8(0x01cf, regs.a); m.step(0xdef9, 4);
      mem.write8(0x01cb, regs.inc8(mem.read8(0x01cb))); m.step(0xdefc, 6);
      mem.write8(0x01cc, regs.inc8(mem.read8(0x01cc))); m.step(0xdeff, 6);
    }
    // deff code
    mem.write8(0x6040, regs.y); m.step(0xdf02, 4);
    regs.a = regs.y; regs.setNZ(regs.a); m.step(0xdf03, 2);
    if (!regs.fZ) { m.step(0xdf08, 3); return m.ret(6); }
    m.step(0xdf05, 2);
    m.step(0xde1b, 3); continue outer;
  }
}
