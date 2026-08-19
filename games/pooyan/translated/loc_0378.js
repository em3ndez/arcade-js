// SPDX-License-Identifier: GPL-3.0-only

// loc_0378  (ROM 0x0378-0x039a) -- vertical-mirror a 24-entry sprite table at 0x8840
// (4 bytes/entry; DE walks it by `inc e`). Per entry: byte0 := -(byte0)-0x10 (neg then
// sub 0x10); byte1 keeps its low nibble but flips its two high bits (and 0xc0 / xor 0xc0);
// byte2 := -(byte2)-0x10; byte3 skipped. B counts the 24 entries.
export function loc_0378(m) {
  const { regs, mem } = m;

  regs.de = 0x8840;
  m.step(0x037b, 10); // 0378  ld de,0x8840
  regs.b = 0x18;
  m.step(0x037d, 7); // 037b  ld b,0x18

  for (;;) {
    // 037d  byte0 := -(byte0) - 0x10
    regs.a = mem.read8(regs.de);
    m.step(0x037e, 7);
    regs.neg();
    m.step(0x0380, 8);
    regs.sub(0x10);
    m.step(0x0382, 7);
    mem.write8(regs.de, regs.a);
    m.step(0x0383, 7);
    regs.e = regs.inc8(regs.e);
    m.step(0x0384, 4);
    // byte1: keep low nibble, flip the two high bits
    regs.a = mem.read8(regs.de);
    m.step(0x0385, 7);
    regs.and(0xc0);
    m.step(0x0387, 7);
    regs.xor(0xc0);
    m.step(0x0389, 7);
    regs.c = regs.a;
    m.step(0x038a, 4);
    regs.a = mem.read8(regs.de);
    m.step(0x038b, 7);
    regs.and(0x0f);
    m.step(0x038d, 7);
    regs.or(regs.c);
    m.step(0x038e, 4);
    mem.write8(regs.de, regs.a);
    m.step(0x038f, 7);
    regs.e = regs.inc8(regs.e);
    m.step(0x0390, 4);
    // byte2 := -(byte2) - 0x10, then skip byte3
    regs.a = mem.read8(regs.de);
    m.step(0x0391, 7);
    regs.neg();
    m.step(0x0393, 8);
    regs.sub(0x10);
    m.step(0x0395, 7);
    mem.write8(regs.de, regs.a);
    m.step(0x0396, 7);
    regs.e = regs.inc8(regs.e);
    m.step(0x0397, 4);
    regs.e = regs.inc8(regs.e);
    m.step(0x0398, 4);
    if (regs.djnz() !== 0) {
      m.step(0x037d, 13); // 0398  djnz 0x037d (taken)
      continue;
    }
    m.step(0x039a, 8); // 0398  djnz (not taken)
    break;
  }

  m.ret(); // 039a  ret
}
