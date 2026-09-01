// SPDX-License-Identifier: GPL-3.0-only
// loc_017a  (ROM 0x017a-0x01a0) -- called from 0x0163. Given L, walks a 2-byte record at
// 0x2009/0x200a (B,C) forward in units of 0x10: loop1 subtracts 0x0b from A while A>=0x0b
// (signed), stepping B by 0x10 and bumping D each time; loop2 then adds 0x10 to C the
// remaining A times. Interior labels 0x0183/0x0194/0x0195 are the two loop tops.
export function loc_017a(m) {
  const { regs, mem } = m;

  regs.d = 0x00; m.step(0x017c, 7);
  regs.a = regs.l; m.step(0x017d, 5);
  regs.hl = 0x2009; m.step(0x0180, 10);
  regs.b = mem.read8(regs.hl); m.step(0x0181, 7); // 0180  mov b,m
  regs.hl = (regs.hl + 1) & 0xffff; m.step(0x0182, 5);
  regs.c = mem.read8(regs.hl); m.step(0x0183, 7); // 0182  mov c,m

  for (;;) { // loop1 @ 0x0183
    regs.cp(0x0b); m.step(0x0185, 7);
    if (regs.fM) { m.step(0x0194, 10); break; } // 0185  jm 0x0194
    m.step(0x0188, 10);
    regs.sbc(0x0b); m.step(0x018a, 7); // 0188  sbi 0x0b (SBB imm)
    regs.e = regs.a; m.step(0x018b, 5);
    regs.a = regs.b; m.step(0x018c, 5);
    regs.add(0x10); m.step(0x018e, 7);
    regs.b = regs.a; m.step(0x018f, 5);
    regs.a = regs.e; m.step(0x0190, 5);
    regs.d = regs.inc8(regs.d); m.step(0x0191, 5);
    m.step(0x0183, 10); // 0191  jmp 0x0183
  }

  regs.l = regs.b; m.step(0x0195, 5); // 0194  mov l,b

  for (;;) { // loop2 @ 0x0195
    regs.and(regs.a); m.step(0x0196, 4);
    if (regs.fZ) { return m.ret(11); } // 0196  rz
    m.step(0x0197, 5);
    regs.e = regs.a; m.step(0x0198, 5);
    regs.a = regs.c; m.step(0x0199, 5);
    regs.add(0x10); m.step(0x019b, 7);
    regs.c = regs.a; m.step(0x019c, 5);
    regs.a = regs.e; m.step(0x019d, 5);
    regs.a = regs.dec8(regs.a); m.step(0x019e, 5);
    m.step(0x0195, 10); // 019e  jmp 0x0195
  }
}
