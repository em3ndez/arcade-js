// SPDX-License-Identifier: GPL-3.0-only
// loc_1868  (ROM 0x1868-0x189d) -- bump 0x20c2; C=(0x20c3), call loc_01d9->B. If (0x20ca)==B set
// 0x20cb=1 and return (loc_1898); else HL=(0x20cc)+(bit2 of 0x20c2 ? 0 : 0x30), store to 0x20c7, call loc_1a3b, XCHG, tail-jmp loc_15d3.
export function loc_1868(m) {
  const { regs, mem } = m;

  regs.hl = 0x20c2; m.step(0x186b, 10); // 1868  lxi h,0x20c2
  regs.incMem8(mem, regs.hl); m.step(0x186c, 10); // 186b  inr m
  regs.hl = (regs.hl + 1) & 0xffff; m.step(0x186d, 5);
  regs.c = mem.read8(regs.hl); m.step(0x186e, 7); // 186d  mov c,m
  m.push16(0x1871); m.step(0x01d9, 17); m.call(0x01d9); // 186e  call 0x01d9
  regs.b = regs.a; m.step(0x1872, 5); // 1871  mov b,a
  regs.a = mem.read8(0x20ca); m.step(0x1875, 13); // 1872  lda 0x20ca
  regs.cp(regs.b); m.step(0x1876, 4);
  if (regs.fZ) { // 1876  jz 0x1898
    m.step(0x1898, 10);
    regs.a = 0x01; m.step(0x189a, 7); // 1898  mvi a,0x01
    mem.write8(0x20cb, regs.a); m.step(0x189d, 13); // 189a  sta 0x20cb
    return m.ret(10); // 189d  ret
  }
  m.step(0x1879, 10);
  regs.a = mem.read8(0x20c2); m.step(0x187c, 13); // 1879  lda 0x20c2
  regs.and(0x04); m.step(0x187e, 7); // 187c  ani 0x04
  regs.hl = mem.read16(0x20cc); m.step(0x1881, 16); // 187e  lhld 0x20cc
  if (regs.fNZ) { // 1881  jnz 0x1888
    m.step(0x1888, 10);
  } else {
    m.step(0x1884, 10);
    regs.de = 0x0030; m.step(0x1887, 10); // 1884  lxi d,0x0030
    regs.addHl(regs.de); m.step(0x1888, 10); // 1887  dad d
  }
  mem.write16(0x20c7, regs.hl); m.step(0x188b, 16); // 1888  shld 0x20c7
  regs.hl = 0x20c5; m.step(0x188e, 10); // 188b  lxi h,0x20c5
  m.push16(0x1891); m.step(0x1a3b, 17); m.call(0x1a3b); // 188e  call 0x1a3b
  regs.exDeHl(); m.step(0x1892, 4); // 1891  xchg
  m.step(0x15d3, 10); return m.call(0x15d3); // 1892  jmp 0x15d3
}
