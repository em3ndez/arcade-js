// SPDX-License-Identifier: GPL-3.0-only
// loc_9bdd (ROM 0x9bdd-0x9bed) -- demo-state leaf: bumps counter $010b, reads table $a0f7,y with it, uses
// that byte as a zero-page pointer index (lda $0000,y), and stores the fetched byte into slot x's $0298,x.
export function loc_9bdd(m) {
  const { regs, mem } = m;
  { const e = 0x010b; mem.write8(e, regs.inc8(mem.read8(e))); m.step(0x9be0, 6); } // inc $010b (abs rmw)
  regs.y = mem.read8(0x010b); regs.setNZ(regs.y); m.step(0x9be3, 4);                 // ldy $010b
  { const b = 0xa0f7, e = (b + regs.y) & 0xffff; regs.a = mem.read8(e); regs.setNZ(regs.a); m.step(0x9be6, 4 + ((b & 0xff00) !== (e & 0xff00) ? 1 : 0)); } // lda $a0f7,y
  regs.y = regs.a; regs.setNZ(regs.y); m.step(0x9be7, 2);                            // tay
  { const b = 0x0000, e = (b + regs.y) & 0xffff; regs.a = mem.read8(e); regs.setNZ(regs.a); m.step(0x9bea, 4 + ((b & 0xff00) !== (e & 0xff00) ? 1 : 0)); } // lda $0000,y
  mem.write8((0x0298 + regs.x) & 0xffff, regs.a); m.step(0x9bed, 5);                 // sta $0298,x (fixed 5)
  return m.ret(6); // rts
}
