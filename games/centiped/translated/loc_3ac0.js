// SPDX-License-Identifier: GPL-3.0-only
// loc_3ac0  (ROM 0x3ac0-0x3b04) -- every 4th frame pulses $1680, and when $fa's low bit is set decrements
// the $f9 cursor; the SEI region scans $0178,X (calling 0x3aa7) for a slot matching A, writing $1600,X and
// bumping $fa on a mismatch. RTS.
export function loc_3ac0(m) {
  const { regs, mem } = m;
  let label = 0x3ac0;
  for (;;) {
    switch (label) {
      case 0x3ac0: {
        regs.a = mem.read8(0x0000); regs.setNZ(regs.a); m.step(0x3ac2, 3);
        regs.and(0x03); m.step(0x3ac4, 2);
        if (regs.fNZ) { m.step(0x3add, 3); label = 0x3add; continue; }                                  // 3ac4 bne $3add
        m.step(0x3ac6, 2);                                                                              // 3ac4 bne (fall)
        mem.write8(0x1680, regs.a); m.step(0x3ac9, 4);
        regs.x = mem.read8(0x00f9); regs.setNZ(regs.x); m.step(0x3acb, 3);
        if (regs.fN) { m.step(0x3add, 3); label = 0x3add; continue; }                                   // 3acb bmi $3add
        m.step(0x3acd, 2);                                                                              // 3acb bmi (fall)
        mem.write8(0x00fa, regs.lsr(mem.read8(0x00fa))); m.step(0x3acf, 5);                             // 3acd lsr $fa
        if (regs.fNC) { m.step(0x3ade, 3); label = 0x3ade; continue; }                                  // 3acf bcc $3ade
        m.step(0x3ad1, 2);                                                                              // 3acf bcc (fall)
        regs.a = 0x02; regs.setNZ(regs.a); m.step(0x3ad3, 2);
        mem.write8(0x1680, regs.a); m.step(0x3ad6, 4);
        regs.a = 0x0a; regs.setNZ(regs.a); m.step(0x3ad8, 2);
        mem.write8(0x1680, regs.a); m.step(0x3adb, 4);
        mem.write8(0x00f9, regs.dec8(mem.read8(0x00f9))); m.step(0x3add, 5);                            // 3adb dec $f9
        label = 0x3add; continue;
      }
      case 0x3add: {
        return m.ret(6);                                                                                // 3add rts
      }
      case 0x3ade: {
        regs.sei(); m.step(0x3adf, 2);                                                                  // 3ade sei
        label = 0x3adf; continue;
      }
      case 0x3adf: {
        m.push16(0x3ae1); m.step(0x3ae2, 6); m.call(0x3aa7);                                                              // 3adf jsr $3aa7
        { const base = 0x0178; const ea = (base + regs.x) & 0xffff; regs.cmp(mem.read8(ea)); m.step(0x3ae5, 4 + ((base & 0xff00) !== (ea & 0xff00) ? 1 : 0)); } // 3ae2 cmp $0178,x
        if (regs.fNZ) { m.step(0x3aee, 3); label = 0x3aee; continue; }                                  // 3ae5 bne $3aee
        m.step(0x3ae7, 2);                                                                              // 3ae5 bne (fall)
        regs.x = regs.dec8(regs.x); m.step(0x3ae8, 2);                                                  // 3ae7 dex
        if (regs.fPl) { m.step(0x3adf, 3); label = 0x3adf; continue; }                                  // 3ae8 bpl $3adf
        m.step(0x3aea, 2);                                                                              // 3ae8 bpl (fall)
        regs.cli(); m.step(0x3aeb, 2);                                                                  // 3aea cli
        mem.write8(0x00f9, regs.x); m.step(0x3aed, 3);                                                  // 3aeb stx $f9
        return m.ret(6);                                                                                // 3aed rts
      }
      case 0x3aee: {
        regs.cli(); m.step(0x3aef, 2);                                                                  // 3aee cli
        mem.write8(0x00f9, regs.x); m.step(0x3af1, 3);                                                  // 3aef stx $f9
        regs.a = 0x06; regs.setNZ(regs.a); m.step(0x3af3, 2);                                           // 3af1 lda #$06
        mem.write8(0x1680, regs.a); m.step(0x3af6, 4);                                                  // 3af3 sta $1680
        { const base = 0x0178; const ea = (base + regs.x) & 0xffff; regs.a = mem.read8(ea); regs.setNZ(regs.a); m.step(0x3af9, 4 + ((base & 0xff00) !== (ea & 0xff00) ? 1 : 0)); } // 3af6 lda $0178,x
        mem.write8((0x1600 + regs.x) & 0xffff, regs.a); m.step(0x3afc, 5);                              // 3af9 sta $1600,x
        regs.a = 0x0e; regs.setNZ(regs.a); m.step(0x3afe, 2);                                           // 3afc lda #$0e
        mem.write8(0x1680, regs.a); m.step(0x3b01, 4);                                                  // 3afe sta $1680
        mem.write8(0x00fa, regs.inc8(mem.read8(0x00fa))); m.step(0x3b03, 5);                            // 3b01 inc $fa
        return m.ret(6);                                                                                // 3b03 rts
      }
    }
  }
}
