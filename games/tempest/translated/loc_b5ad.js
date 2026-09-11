// SPDX-License-Identifier: GPL-3.0-only
// loc_b5ad  (ROM 0xb5ad-0xb5d6) -- if $0106>=0, loops X=$37 6..0 over $02df,x (skip if 0): stores to $57,
// splits $0283,x into $55 (bits 3-4 >>3) and A ((bits 0-2)<<1), then jsr $b5d7 (RTS-trick dispatch). rts.
export function loc_b5ad(m) {
  const { regs, mem } = m;
  regs.a = mem.read8(0x0106); regs.setNZ(regs.a); m.step(0xb5b0, 4);
  if (regs.fN) { m.step(0xb5d6, 3); return m.ret(6); }
  m.step(0xb5b2, 2);
  regs.x = 0x06; regs.setNZ(regs.x); m.step(0xb5b4, 2);
  mem.write8(0x37, regs.x); m.step(0xb5b6, 3);
  while (true) {
    regs.x = mem.read8(0x37); regs.setNZ(regs.x); m.step(0xb5b8, 3);
    { const a = (0x02df + regs.x) & 0xffff;
      regs.a = mem.read8(a); regs.setNZ(regs.a); m.step(0xb5bb, 4 + ((0x02df & 0xff00) !== (a & 0xff00) ? 1 : 0)); }
    if (regs.fZ) {
      m.step(0xb5d2, 3);
    } else {
      m.step(0xb5bd, 2);
      mem.write8(0x57, regs.a); m.step(0xb5bf, 3);
      { const a = (0x0283 + regs.x) & 0xffff;
        regs.a = mem.read8(a); regs.setNZ(regs.a); m.step(0xb5c2, 4 + ((0x0283 & 0xff00) !== (a & 0xff00) ? 1 : 0)); }
      regs.and(0x18); m.step(0xb5c4, 2);
      regs.a = regs.lsr(regs.a); m.step(0xb5c5, 2);
      regs.a = regs.lsr(regs.a); m.step(0xb5c6, 2);
      regs.a = regs.lsr(regs.a); m.step(0xb5c7, 2);
      mem.write8(0x55, regs.a); m.step(0xb5c9, 3);
      { const a = (0x0283 + regs.x) & 0xffff;
        regs.a = mem.read8(a); regs.setNZ(regs.a); m.step(0xb5cc, 4 + ((0x0283 & 0xff00) !== (a & 0xff00) ? 1 : 0)); }
      regs.and(0x07); m.step(0xb5ce, 2);
      regs.a = regs.asl(regs.a); m.step(0xb5cf, 2);
      m.push16(0xb5d1); m.step(0xb5d2, 6); m.call(0xb5d7);
    }
    { const dv = (mem.read8(0x37) - 1) & 0xff; mem.write8(0x37, dv); regs.setNZ(dv); m.step(0xb5d4, 5); }
    if (!regs.fN) { m.step(0xb5b6, 3); continue; }
    m.step(0xb5d6, 2); break;
  }
  return m.ret(6);
}
