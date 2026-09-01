// SPDX-License-Identifier: GPL-3.0-only
// loc_0682  (ROM 0x0682-0x0706) -- an object handler reached by computed dispatch (it `pop h`s the
// dispatcher's return address off the stack). Guards on the mode cell 0x2080 and several object
// state cells, calls the 0x073c/0x1a06 helpers, and on the collision / edge paths delegates out to
// loc_050f, loc_074b, loc_070c, or falls through into loc_0707. Interior labels loc_06ab / loc_06d6
// / loc_06f9 are modelled as straight-line JS; each m.step carries its landing address.
export function loc_0682(m) {
  const { regs, mem } = m;

  regs.hl = m.pop16(); m.step(0x0683, 10);            // 0682 pop h (discard dispatcher return)
  regs.a = mem.read8(0x2080); m.step(0x0686, 13);     // 0683 lda 0x2080
  regs.cp(0x02); m.step(0x0688, 7);                   // 0686 cpi 0x02
  if (regs.fNZ) { return m.ret(11); }                 // 0688 rnz
  m.step(0x0689, 5);
  regs.hl = 0x2083; m.step(0x068c, 10);
  regs.a = mem.read8(regs.hl); m.step(0x068d, 7);
  regs.and(regs.a); m.step(0x068e, 4);                // 068d ana a
  if (regs.fZ) { m.step(0x050f, 10); return m.call(0x050f); } // 068e jz 0x050f
  m.step(0x0691, 10);
  regs.a = mem.read8(0x2056); m.step(0x0694, 13);
  regs.and(regs.a); m.step(0x0695, 4);
  if (regs.fNZ) { m.step(0x050f, 10); return m.call(0x050f); } // 0695 jnz 0x050f
  m.step(0x0698, 10);
  regs.hl = (regs.hl + 1) & 0xffff; m.step(0x0699, 5); // 0698 inx h
  regs.a = mem.read8(regs.hl); m.step(0x069a, 7);
  regs.and(regs.a); m.step(0x069b, 4);
  if (regs.fZ) {                                      // 069b jnz 0x06ab (not taken -> guard arm)
    m.step(0x069e, 10);
    regs.a = mem.read8(0x2082); m.step(0x06a1, 13);
    regs.cp(0x08); m.step(0x06a3, 7);
    if (regs.fC) { m.step(0x050f, 10); return m.call(0x050f); } // 06a3 jc 0x050f
    m.step(0x06a6, 10);
    mem.write8(regs.hl, 0x01); m.step(0x06a8, 10);    // 06a6 mvi m,0x01
    m.push16(0x06ab); m.step(0x073c, 17); m.call(0x073c); // 06a8 call 0x073c
  } else {
    m.step(0x06ab, 10);                               // 069b jnz 0x06ab (taken)
  }

  // loc_06ab
  regs.de = 0x208a; m.step(0x06ae, 10);
  m.push16(0x06b1); m.step(0x1a06, 17); m.call(0x1a06); // 06ae call 0x1a06
  if (regs.fNC) { return m.ret(11); }                 // 06b1 rnc
  m.step(0x06b2, 5);
  regs.hl = 0x2085; m.step(0x06b5, 10);
  regs.a = mem.read8(regs.hl); m.step(0x06b6, 7);
  regs.and(regs.a); m.step(0x06b7, 4);
  if (regs.fZ) {                                      // 06b7 jnz 0x06d6 (not taken -> tally arm)
    m.step(0x06ba, 10);
    regs.hl = 0x208a; m.step(0x06bd, 10);
    regs.a = mem.read8(regs.hl); m.step(0x06be, 7);
    regs.hl = (regs.hl + 1) & 0xffff; m.step(0x06bf, 5); // 06be inx h
    regs.hl = (regs.hl + 1) & 0xffff; m.step(0x06c0, 5); // 06bf inx h
    regs.add(mem.read8(regs.hl)); m.step(0x06c1, 7);  // 06c0 add m
    mem.write8(0x208a, regs.a); m.step(0x06c4, 13);
    m.push16(0x06c7); m.step(0x073c, 17); m.call(0x073c); // 06c4 call 0x073c
    regs.hl = 0x208a; m.step(0x06ca, 10);
    regs.a = mem.read8(regs.hl); m.step(0x06cb, 7);
    regs.cp(0x28); m.step(0x06cd, 7);
    if (regs.fC) {                                    // 06cd jc 0x06f9
      m.step(0x06f9, 10);
    } else {
      m.step(0x06d0, 10);
      regs.cp(0xe1); m.step(0x06d2, 7);
      if (regs.fNC) {                                 // 06d2 jnc 0x06f9
        m.step(0x06f9, 10);
      } else {
        m.step(0x06d5, 10);
        return m.ret(10);                             // 06d5 ret
      }
    }
  } else {
    // loc_06d6 (06b7 jnz taken)
    m.step(0x06d6, 10);
    regs.b = 0xfe; m.step(0x06d8, 7);
    m.push16(0x06db); m.step(0x19dc, 17); m.call(0x19dc); // 06d8 call 0x19dc
    regs.hl = (regs.hl + 1) & 0xffff; m.step(0x06dc, 5); // 06db inx h
    regs.decMem8(mem, regs.hl); m.step(0x06dd, 10);   // 06dc dcr m
    regs.a = mem.read8(regs.hl); m.step(0x06de, 7);
    regs.cp(0x1f); m.step(0x06e0, 7);
    if (regs.fZ) { m.step(0x074b, 10); return m.call(0x074b); } // 06e0 jz 0x074b
    m.step(0x06e3, 10);
    regs.cp(0x18); m.step(0x06e5, 7);
    if (regs.fZ) { m.step(0x070c, 10); return m.call(0x070c); } // 06e5 jz 0x070c
    m.step(0x06e8, 10);
    regs.and(regs.a); m.step(0x06e9, 4);
    if (regs.fNZ) { return m.ret(11); }               // 06e9 rnz
    m.step(0x06ea, 5);
    regs.b = 0xef; m.step(0x06ec, 7);
    regs.hl = 0x2098; m.step(0x06ef, 10);
    regs.a = mem.read8(regs.hl); m.step(0x06f0, 7);
    regs.and(regs.b); m.step(0x06f1, 4);              // 06f0 ana b
    mem.write8(regs.hl, regs.a); m.step(0x06f2, 7);   // 06f1 mov m,a
    regs.and(0x20); m.step(0x06f4, 7);                // 06f2 ani 0x20
    m.io.portOut(0x05, regs.a); m.step(0x06f6, 10);   // 06f4 out 0x05
    m.step(0x06f7, 4);                                // 06f6 nop
    m.step(0x06f8, 4);                                // 06f7 nop
    m.step(0x06f9, 4);                                // 06f8 nop
  }

  // loc_06f9
  m.push16(0x06fc); m.step(0x0742, 17); m.call(0x0742); // 06f9 call 0x0742
  m.push16(0x06ff); m.step(0x14cb, 17); m.call(0x14cb); // 06fc call 0x14cb
  regs.hl = 0x2083; m.step(0x0702, 10);
  regs.b = 0x0a; m.step(0x0704, 7);
  m.push16(0x0707); m.step(0x075f, 17); m.call(0x075f); // 0704 call 0x075f
  return m.call(0x0707);                              // fall through into loc_0707
}
