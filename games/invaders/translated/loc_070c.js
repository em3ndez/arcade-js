// SPDX-License-Identifier: GPL-3.0-only
// loc_070c  (ROM 0x070c-0x073b) -- reached by `jz 0x070c` from loc_0682 when the countdown cell
// hit 0x18. Sets the 0x20f1 flag, scans the 4-entry table at 0x1d4c for the value in B, copies the
// parallel 0x1d50 entry to 0x2087, stores B*16 at 0x20f2, then tail-jumps into loc_08f1. Interior
// labels loc_071d (loop top) and loc_0728 are straight-line JS; each m.step carries its landing.
export function loc_070c(m) {
  const { regs, mem } = m;
  regs.a = 0x01; m.step(0x070e, 7);
  mem.write8(0x20f1, regs.a); m.step(0x0711, 13);
  regs.hl = mem.read16(0x208d); m.step(0x0714, 16);     // 0711 lhld 0x208d
  regs.b = mem.read8(regs.hl); m.step(0x0715, 7);       // 0714 mov b,m
  regs.c = 0x04; m.step(0x0717, 7);
  regs.hl = 0x1d50; m.step(0x071a, 10);
  regs.de = 0x1d4c; m.step(0x071d, 10);
  for (;;) {                                            // loc_071d: scan 0x1d4c[0..3] for B
    regs.a = mem.read8(regs.de); m.step(0x071e, 7);     // 071d ldax d
    regs.cp(regs.b); m.step(0x071f, 4);                 // 071e cmp b
    if (regs.fZ) { m.step(0x0728, 10); break; }         // 071f jz 0x0728
    m.step(0x0722, 10);
    regs.hl = (regs.hl + 1) & 0xffff; m.step(0x0723, 5); // 0722 inx h
    regs.de = (regs.de + 1) & 0xffff; m.step(0x0724, 5); // 0723 inx d
    regs.c = regs.dec8(regs.c); m.step(0x0725, 5);      // 0724 dcr c
    if (regs.fNZ) { m.step(0x071d, 10); continue; }     // 0725 jnz 0x071d
    m.step(0x0728, 10); break;
  }
  regs.a = mem.read8(regs.hl); m.step(0x0729, 7);       // 0728 mov a,m
  mem.write8(0x2087, regs.a); m.step(0x072c, 13);
  regs.h = 0x00; m.step(0x072e, 7);
  regs.l = regs.b; m.step(0x072f, 5);                   // 072e mov l,b
  regs.addHl(regs.hl); m.step(0x0730, 10);              // 072f dad h  (B*2)
  regs.addHl(regs.hl); m.step(0x0731, 10);
  regs.addHl(regs.hl); m.step(0x0732, 10);
  regs.addHl(regs.hl); m.step(0x0733, 10);              // 0732 dad h  (B*16)
  mem.write16(0x20f2, regs.hl); m.step(0x0736, 16);     // 0733 shld 0x20f2
  m.push16(0x0739); m.step(0x0742, 17); m.call(0x0742); // 0736 call 0x0742
  m.step(0x08f1, 10); return m.call(0x08f1);            // 0739 jmp 0x08f1
}
