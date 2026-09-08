// SPDX-License-Identifier: GPL-3.0-only
// loc_3a1d  (ROM 0x3a1d-0x3a69) -- copies the 0x30-byte $3a69 table to $02, calls 0x3a08, and on a fresh
// $fd&$7c value validates the $0178 high-score entry into $1a,X; else zero-fills $0178..$01b6 and stores
// $fd&$7c to $018a. RTS.
export function loc_3a1d(m) {
  const { regs, mem } = m;
  let label = 0x3a1d;
  for (;;) {
    switch (label) {
      case 0x3a1d: {
        regs.x = 0x2f; regs.setNZ(regs.x); m.step(0x3a1f, 2);
        label = 0x3a1f; continue;
      }
      case 0x3a1f: {
        { const base = 0x3a69; const ea = (base + regs.x) & 0xffff; regs.a = mem.read8(ea); regs.setNZ(regs.a); m.step(0x3a22, 4 + ((base & 0xff00) !== (ea & 0xff00) ? 1 : 0)); }
        mem.write8((0x0002 + regs.x) & 0xff, regs.a); m.step(0x3a24, 4);
        regs.x = regs.dec8(regs.x); m.step(0x3a25, 2);
        if (regs.fPl) { m.step(0x3a1f, 3); label = 0x3a1f; continue; }                                  // 3a25 bpl $3a1f
        m.step(0x3a27, 2);                                                                              // 3a25 bpl (fall)
        label = 0x3a27; continue;
      }
      case 0x3a27: {
        m.step(0x3a2a, 6); m.call(0x3a08);
        if (regs.fNZ) { m.step(0x3a57, 3); label = 0x3a57; continue; }                                  // 3a2a bne $3a57
        m.step(0x3a2c, 2);                                                                              // 3a2a bne (fall)
        regs.a = mem.read8(0x00fd); regs.setNZ(regs.a); m.step(0x3a2e, 3);
        regs.and(0x7c); m.step(0x3a30, 2);
        regs.cmp(mem.read8(0x018a)); m.step(0x3a33, 4);
        mem.write8(0x018a, regs.a); m.step(0x3a36, 4);
        if (regs.fNZ) { m.step(0x3a56, 3); label = 0x3a56; continue; }                                  // 3a36 bne $3a56
        m.step(0x3a38, 2);                                                                              // 3a36 bne (fall)
        regs.a = mem.read8(0x017a); regs.setNZ(regs.a); m.step(0x3a3b, 4);
        if (regs.fZ) { m.step(0x3a57, 3); label = 0x3a57; continue; }                                   // 3a3b beq $3a57
        m.step(0x3a3d, 2);                                                                              // 3a3b beq (fall)
        regs.x = 0x08; regs.setNZ(regs.x); m.step(0x3a3f, 2);
        label = 0x3a3f; continue;
      }
      case 0x3a3f: {
        { const base = 0x0178; const ea = (base + regs.x) & 0xffff; regs.a = mem.read8(ea); regs.setNZ(regs.a); m.step(0x3a42, 4 + ((base & 0xff00) !== (ea & 0xff00) ? 1 : 0)); }
        mem.write8((0x0002 + regs.x) & 0xff, regs.a); m.step(0x3a44, 4);
        regs.cmp(0x9a); m.step(0x3a46, 2);
        if (regs.fC) { m.step(0x3a57, 3); label = 0x3a57; continue; }                                   // 3a46 bcs $3a57
        m.step(0x3a48, 2);                                                                              // 3a46 bcs (fall)
        regs.and(0x0f); m.step(0x3a4a, 2);
        regs.cmp(0x0a); m.step(0x3a4c, 2);
        if (regs.fC) { m.step(0x3a57, 3); label = 0x3a57; continue; }                                   // 3a4c bcs $3a57
        m.step(0x3a4e, 2);                                                                              // 3a4c bcs (fall)
        { const base = 0x0181; const ea = (base + regs.x) & 0xffff; regs.a = mem.read8(ea); regs.setNZ(regs.a); m.step(0x3a51, 4 + ((base & 0xff00) !== (ea & 0xff00) ? 1 : 0)); }
        mem.write8((0x001a + regs.x) & 0xff, regs.a); m.step(0x3a53, 4);
        regs.x = regs.dec8(regs.x); m.step(0x3a54, 2);
        if (regs.fPl) { m.step(0x3a3f, 3); label = 0x3a3f; continue; }                                  // 3a54 bpl $3a3f
        m.step(0x3a56, 2);                                                                              // 3a54 bpl (fall)
        label = 0x3a56; continue;
      }
      case 0x3a56: {
        return m.ret(6);                                                                                // 3a56 rts
      }
      case 0x3a57: {
        regs.a = 0x00; regs.setNZ(regs.a); m.step(0x3a59, 2);
        regs.x = 0x3e; regs.setNZ(regs.x); m.step(0x3a5b, 2);
        label = 0x3a5b; continue;
      }
      case 0x3a5b: {
        mem.write8((0x0178 + regs.x) & 0xffff, regs.a); m.step(0x3a5e, 5);
        regs.x = regs.dec8(regs.x); m.step(0x3a5f, 2);
        if (regs.fPl) { m.step(0x3a5b, 3); label = 0x3a5b; continue; }                                  // 3a5f bpl $3a5b
        m.step(0x3a61, 2);                                                                              // 3a5f bpl (fall)
        regs.a = mem.read8(0x00fd); regs.setNZ(regs.a); m.step(0x3a63, 3);
        regs.and(0x7c); m.step(0x3a65, 2);
        mem.write8(0x018a, regs.a); m.step(0x3a68, 4);
        return m.ret(6);                                                                                // 3a68 rts
      }
    }
  }
}
