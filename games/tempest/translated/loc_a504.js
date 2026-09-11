// SPDX-License-Identifier: GPL-3.0-only
// loc_a504  (ROM 0xa504-0xa5ca) -- $0201 sign splits two arms. Negative arm: age the $02df,x shot table
// (+0x0f, clamp <0xf0), and if player-shot #1 active step $5f/$5b down by 0x20 else advance $0202, then
// clamp $03ab. Positive arm: bump $00,x on a timer, and conditionally re-call 0xa5cb/0x928f.
// Cycle notes: abs,x/abs,y reads charge 4 (+1 on a page-carry); STA abs,x is 5; clv+bvc pairs are
// unconditional forward skips (V just cleared). All jumps to 0xa5ca modeled as `break body` to the rts.
export function loc_a504(m) {
  const { regs, mem } = m;
  let ea;
  body: {
    regs.a = mem.read8(0x0201); regs.setNZ(regs.a); m.step(0xa507, 4);
    if (regs.fPl) {
      m.step(0xa581, 3);
      // ----- positive arm (a581) -----
      regs.a = mem.read8(0x0455); regs.setNZ(regs.a); m.step(0xa584, 4);
      regs.ora(mem.read8(0x011b)); m.step(0xa587, 4);
      if (regs.fZ) {
        m.step(0xa593, 3);
      } else {
        m.step(0xa589, 2);
        regs.a = 0x17; regs.setNZ(regs.a); m.step(0xa58b, 2);
        regs.cmp(mem.read8(0x42)); m.step(0xa58d, 3);
        if (regs.fC) {
          m.step(0xa593, 3);
        } else {
          m.step(0xa58f, 2);
          regs.x = mem.read8(0x40); regs.setNZ(regs.x); m.step(0xa591, 3);
          ea = (0x0000 + regs.x) & 0xff; mem.write8(ea, regs.inc8(mem.read8(ea))); m.step(0xa593, 6);
        }
      }
      regs.a = mem.read8(0x0106); regs.setNZ(regs.a); m.step(0xa596, 4);
      if (regs.fNZ) { m.step(0xa5ca, 3); break body; }
      m.step(0xa598, 2);
      regs.a = mem.read8(0x03ab); regs.setNZ(regs.a); m.step(0xa59b, 4);
      regs.ora(mem.read8(0x0116)); m.step(0xa59e, 4);
      if (regs.fNZ) {
        m.step(0xa5b5, 3);
      } else {
        m.step(0xa5a0, 2);
        sub5a0: {
          regs.y = mem.read8(0x011c); regs.setNZ(regs.y); m.step(0xa5a3, 4);
          do {
            ea = (0x02df + regs.y) & 0xffff; regs.a = mem.read8(ea); regs.setNZ(regs.a);
            m.step(0xa5a6, (ea & 0xff00) !== 0x0200 ? 5 : 4);
            if (regs.fZ) {
              m.step(0xa5ac, 3);
            } else {
              m.step(0xa5a8, 2);
              regs.cmp(0x11); m.step(0xa5aa, 2);
              if (regs.fC) { m.step(0xa5b5, 3); break sub5a0; }
              m.step(0xa5ac, 2);
            }
            regs.y = regs.dec8(regs.y); m.step(0xa5ad, 2);
            if (regs.fPl) { m.step(0xa5a3, 3); continue; }
            m.step(0xa5af, 2); break;
          } while (true);
          m.push16(0xa5b1); m.step(0xa5b2, 6); m.call(0xa5cb);
          m.push16(0xa5b4); m.step(0xa5b5, 6); m.call(0x928f);
        }
      }
      regs.a = mem.read8(0x4d); regs.setNZ(regs.a); m.step(0xa5b7, 3);
      regs.and(0x60); m.step(0xa5b9, 2);
      if (regs.fZ) { m.step(0xa5ca, 3); break body; }
      m.step(0xa5bb, 2);
      regs.bit(mem.read8(0x05)); m.step(0xa5bd, 3);
      if (regs.fPl) { m.step(0xa5ca, 3); break body; }
      m.step(0xa5bf, 2);
      regs.a = mem.read8(0x09); regs.setNZ(regs.a); m.step(0xa5c1, 3);
      regs.and(0x43); m.step(0xa5c3, 2);
      regs.cmp(0x40); m.step(0xa5c5, 2);
      if (regs.fNZ) { m.step(0xa5ca, 3); break body; }
      m.step(0xa5c7, 2);
      m.push16(0xa5c9); m.step(0xa5ca, 6); m.call(0xa5cb);
      break body;
    }
    // ----- negative arm (a509) -----
    m.step(0xa509, 2);
    arm509: {
      regs.a = mem.read8(0x0135); regs.setNZ(regs.a); m.step(0xa50c, 4);
      regs.ora(mem.read8(0xa6)); m.step(0xa50e, 3);
      regs.ora(mem.read8(0x0116)); m.step(0xa511, 4);
      if (regs.fNZ) { m.step(0xa57e, 3); break arm509; }
      m.step(0xa513, 2);
      regs.x = mem.read8(0x011c); regs.setNZ(regs.x); m.step(0xa516, 4);
      do {
        ea = (0x02df + regs.x) & 0xffff; regs.a = mem.read8(ea); regs.setNZ(regs.a);
        m.step(0xa519, (ea & 0xff00) !== 0x0200 ? 5 : 4);
        if (regs.fZ) {
          m.step(0xa529, 3);
        } else {
          m.step(0xa51b, 2);
          regs.clc(); m.step(0xa51c, 2);
          regs.adc(0x0f); m.step(0xa51e, 2);
          if (regs.fC) {
            m.step(0xa522, 3);
          } else {
            m.step(0xa520, 2);
            regs.cmp(0xf0); m.step(0xa522, 2);
          }
          if (regs.fNC) {
            m.step(0xa526, 3);
          } else {
            m.step(0xa524, 2);
            regs.a = 0x00; regs.setNZ(regs.a); m.step(0xa526, 2);
          }
          ea = (0x02df + regs.x) & 0xffff; mem.write8(ea, regs.a); m.step(0xa529, 5);
        }
        regs.x = regs.dec8(regs.x); m.step(0xa52a, 2);
        if (regs.fPl) { m.step(0xa516, 3); continue; }
        m.step(0xa52c, 2); break;
      } while (true);
      regs.x = mem.read8(0x3d); regs.setNZ(regs.x); m.step(0xa52e, 3);
      regs.a = mem.read8((0x48 + regs.x) & 0xff); regs.setNZ(regs.a); m.step(0xa530, 4);
      regs.cmp(0x01); m.step(0xa532, 2);
      if (regs.fNZ) {
        m.step(0xa554, 3);
        regs.a = mem.read8(0x0202); regs.setNZ(regs.a); m.step(0xa557, 4);
        regs.clc(); m.step(0xa558, 2);
        regs.adc(0x0f); m.step(0xa55a, 2);
        mem.write8(0x0202, regs.a); m.step(0xa55d, 4);
        if (regs.fC) {
          m.step(0xa561, 3);
        } else {
          m.step(0xa55f, 2);
          regs.cmp(0xf0); m.step(0xa561, 2);
        }
      } else {
        m.step(0xa534, 2);
        regs.a = 0x00; regs.setNZ(regs.a); m.step(0xa536, 2);
        mem.write8(0x010f, regs.a); m.step(0xa539, 4);
        regs.a = 0x01; regs.setNZ(regs.a); m.step(0xa53b, 2);
        mem.write8(0x0114, regs.a); m.step(0xa53e, 4);
        regs.a = mem.read8(0x5f); regs.setNZ(regs.a); m.step(0xa540, 3);
        regs.sec(); m.step(0xa541, 2);
        regs.sbc(0x20); m.step(0xa543, 2);
        mem.write8(0x5f, regs.a); m.step(0xa545, 3);
        regs.a = mem.read8(0x5b); regs.setNZ(regs.a); m.step(0xa547, 3);
        regs.sbc(0x00); m.step(0xa549, 2);
        mem.write8(0x5b, regs.a); m.step(0xa54b, 3);
        regs.cmp(0xfa); m.step(0xa54d, 2);
        regs.clc(); m.step(0xa54e, 2);
        if (regs.fNZ) {
          m.step(0xa551, 3);
        } else {
          m.step(0xa550, 2);
          regs.sec(); m.step(0xa551, 2);
        }
        regs.clv(); m.step(0xa552, 2);
        m.step(0xa561, 3);
      }
      if (regs.fNC) { m.step(0xa57e, 3); break arm509; }
      m.step(0xa563, 2);
      regs.a = 0x06; regs.setNZ(regs.a); m.step(0xa565, 2);
      mem.write8(0x00, regs.a); m.step(0xa567, 3);
      m.push16(0xa569); m.step(0xa56a, 6); m.call(0x928f);
      regs.a = mem.read8(0x0108); regs.setNZ(regs.a); m.step(0xa56d, 4);
      regs.clc(); m.step(0xa56e, 2);
      regs.adc(mem.read8(0x0109)); m.step(0xa571, 4);
      regs.clc(); m.step(0xa572, 2);
      regs.adc(mem.read8(0x03ab)); m.step(0xa575, 4);
      regs.cmp(0x3f); m.step(0xa577, 2);
      if (regs.fNC) {
        m.step(0xa57b, 3);
      } else {
        m.step(0xa579, 2);
        regs.a = 0x3f; regs.setNZ(regs.a); m.step(0xa57b, 2);
      }
      mem.write8(0x03ab, regs.a); m.step(0xa57e, 4);
    }
    regs.clv(); m.step(0xa57f, 2);
    m.step(0xa5ca, 3);
  }
  return m.ret(6);
}
