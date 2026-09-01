// SPDX-License-Identifier: GPL-3.0-only
// loc_0100  (ROM 0x0100-0x013a) -- if 0x2002 set bail to 0x1538; else read object byte at (0x2067:0x2006),
// and if active build a sprite pointer (base 0x1c00, +0x0030 via loc_013b when B!=0), blit via 0x15d3, clear 0x2000.
export function loc_0100(m) {
  const { regs, mem } = m;

  regs.hl = 0x2002; m.step(0x0103, 10); // 0100  lxi h,0x2002
  regs.a = mem.read8(regs.hl); m.step(0x0104, 7); // 0103  mov a,m
  regs.and(regs.a); m.step(0x0105, 4); // 0104  ana a
  if (regs.fNZ) { m.step(0x1538, 10); return m.call(0x1538); } // 0105  jnz 0x1538
  m.step(0x0108, 10);
  m.push16(regs.hl); m.step(0x0109, 11);
  regs.a = mem.read8(0x2006); m.step(0x010c, 13); // 0109  lda 0x2006
  regs.l = regs.a; m.step(0x010d, 5); // 010c  mov l,a
  regs.a = mem.read8(0x2067); m.step(0x0110, 13); // 010d  lda 0x2067
  regs.h = regs.a; m.step(0x0111, 5); // 0110  mov h,a
  regs.a = mem.read8(regs.hl); m.step(0x0112, 7); // 0111  mov a,m
  regs.and(regs.a); m.step(0x0113, 4); // 0112  ana a
  regs.hl = m.pop16(); m.step(0x0114, 10);
  if (regs.fZ) {
    m.step(0x0136, 10);
  } else {
    m.step(0x0117, 10);
    regs.hl = (regs.hl + 1) & 0xffff; m.step(0x0118, 5); // 0117  inx h
    regs.hl = (regs.hl + 1) & 0xffff; m.step(0x0119, 5);
    regs.a = mem.read8(regs.hl); m.step(0x011a, 7); // 0119  mov a,m
    regs.hl = (regs.hl + 1) & 0xffff; m.step(0x011b, 5); // 011a  inx h
    regs.b = mem.read8(regs.hl); m.step(0x011c, 7); // 011b  mov b,m
    regs.and(0xfe); m.step(0x011e, 7); // 011c  ani 0xfe
    regs.rlca(); m.step(0x011f, 4); // 011e  rlc
    regs.rlca(); m.step(0x0120, 4);
    regs.rlca(); m.step(0x0121, 4);
    regs.e = regs.a; m.step(0x0122, 5); // 0121  mov e,a
    regs.d = 0x00; m.step(0x0124, 7); // 0122  mvi d,0x00
    regs.hl = 0x1c00; m.step(0x0127, 10); // 0124  lxi h,0x1c00
    regs.addHl(regs.de); m.step(0x0128, 10); // 0127  dad d
    regs.exDeHl(); m.step(0x0129, 4); // 0128  xchg
    regs.a = regs.b; m.step(0x012a, 5); // 0129  mov a,b
    regs.and(regs.a); m.step(0x012b, 4); // 012a  ana a
    if (regs.fNZ) {
      m.push16(0x012e); m.step(0x013b, 17); m.call(0x013b);
    } else {
      m.step(0x012e, 11);
    }
    regs.hl = mem.read16(0x200b); m.step(0x0131, 16); // 012e  lhld 0x200b
    regs.b = 0x10; m.step(0x0133, 7); // 0131  mvi b,0x10
    m.push16(0x0136); m.step(0x15d3, 17); m.call(0x15d3); // 0133  call 0x15d3
  }
  regs.xor(regs.a); m.step(0x0137, 4); // 0136  xra a
  mem.write8(0x2000, regs.a); m.step(0x013a, 13); // 0137  sta 0x2000
  return m.ret(10); // 013a  ret
}
