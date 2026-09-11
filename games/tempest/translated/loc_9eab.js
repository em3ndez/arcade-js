// SPDX-License-Identifier: GPL-3.0-only
// loc_9eab (ROM 0x9eab-0x9ed6) -- gated per-slot(x) bit6 toggle on $0283,x. If global gate $0111==0,
// rts immediately. Else, when bit6 of $0283,x is SET: clear it only if $02b9,x >= 0x0e (bcc keeps it).
// When bit6 is CLEAR: set it only if $02b9,x == 0 (bne leaves it clear). All paths merge at the rts
// (9ec6 clv;bvc is an unconditional join). abs,x loads model the +1 page-cross; abs,x store = 5 fixed.
export function loc_9eab(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x0111); regs.setNZ(regs.a); m.step(0x9eae, 4);
  if (regs.fZ) { m.step(0x9ed6, 3); return m.ret(6); } // beq -> rts (gate off)
  m.step(0x9eb0, 2);

  { const p = 0x0283, e = (p + regs.x) & 0xffff;
    regs.a = mem.read8(e); regs.setNZ(regs.a); m.step(0x9eb3, 4 + ((p & 0xff00) !== (e & 0xff00) ? 1 : 0)); }
  regs.and(0x40); m.step(0x9eb5, 2);
  if (regs.fZ) {
    m.step(0x9ec9, 3); // beq taken -> bit6-clear path
    // 9ec9: set bit6 iff $02b9,x == 0
    { const p = 0x02b9, e = (p + regs.x) & 0xffff;
      regs.a = mem.read8(e); regs.setNZ(regs.a); m.step(0x9ecc, 4 + ((p & 0xff00) !== (e & 0xff00) ? 1 : 0)); }
    if (regs.fNZ) { m.step(0x9ed6, 3); return m.ret(6); } // bne -> rts (leave clear)
    m.step(0x9ece, 2);
    { const p = 0x0283, e = (p + regs.x) & 0xffff;
      regs.a = mem.read8(e); regs.setNZ(regs.a); m.step(0x9ed1, 4 + ((p & 0xff00) !== (e & 0xff00) ? 1 : 0)); }
    regs.ora(0x40); m.step(0x9ed3, 2);
    mem.write8((0x0283 + regs.x) & 0xffff, regs.a); m.step(0x9ed6, 5);
    return m.ret(6);
  }
  m.step(0x9eb7, 2); // beq not taken -> bit6 set path

  { const p = 0x02b9, e = (p + regs.x) & 0xffff;
    regs.a = mem.read8(e); regs.setNZ(regs.a); m.step(0x9eba, 4 + ((p & 0xff00) !== (e & 0xff00) ? 1 : 0)); }
  regs.cmp(0x0e); m.step(0x9ebc, 2);
  if (regs.fNC) {
    m.step(0x9ec6, 3); // bcc -> keep bit6 ($02b9,x < 0x0e)
  } else {
    m.step(0x9ebe, 2);
    { const p = 0x0283, e = (p + regs.x) & 0xffff;
      regs.a = mem.read8(e); regs.setNZ(regs.a); m.step(0x9ec1, 4 + ((p & 0xff00) !== (e & 0xff00) ? 1 : 0)); }
    regs.and(0xbf); m.step(0x9ec3, 2);
    mem.write8((0x0283 + regs.x) & 0xffff, regs.a); m.step(0x9ec6, 5);
  }

  // 9ec6: clv; bvc 0x9ed6 (unconditional join to rts)
  regs.clv(); m.step(0x9ec7, 2);
  m.step(0x9ed6, 3);
  return m.ret(6);
}
