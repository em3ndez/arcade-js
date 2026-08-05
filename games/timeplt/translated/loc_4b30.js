// SPDX-License-Identifier: GPL-3.0-only

// loc_4b30  (ROM 0x4B30-0x4B4A)
export function loc_4b30(m) {
  const { regs, mem } = m;

  regs.hl = 0x0d1b;
  m.step(0x4b33, 10); // 4b30  ld hl,0x0d1b
  regs.b = 0x03;
  m.step(0x4b35, 7); // 4b33  ld b,0x03

  for (;;) {
    regs.e = mem.read8(regs.hl);
    m.step(0x4b36, 7); // 4b35  ld e,(hl)
    regs.hl = (regs.hl + 1) & 0xffff;
    m.step(0x4b37, 6); // 4b36  inc hl
    regs.d = mem.read8(regs.hl);
    m.step(0x4b38, 7); // 4b37  ld d,(hl)
    regs.hl = (regs.hl + 1) & 0xffff;
    m.step(0x4b39, 6); // 4b38  inc hl

    regs.a = mem.read8(regs.de);
    m.step(0x4b3a, 7); // 4b39  ld a,(de) -- the first byte
    regs.exAf();
    m.step(0x4b3b, 4); // 4b3a  ex af,af' -- parked in A'

    regs.a = 0x04;
    m.step(0x4b3d, 7); // 4b3b  ld a,0x04
    regs.add(regs.d);
    m.step(0x4b3e, 4); // 4b3d  add a,d
    regs.d = regs.a;
    m.step(0x4b3f, 4); // 4b3e  ld d,a -- DE += 0x0400

    regs.a = mem.read8(regs.de);
    m.step(0x4b40, 7); // 4b3f  ld a,(de) -- the second byte

    regs.e = mem.read8(regs.hl);
    m.step(0x4b41, 7); // 4b40  ld e,(hl)
    regs.hl = (regs.hl + 1) & 0xffff;
    m.step(0x4b42, 6); // 4b41  inc hl
    regs.d = mem.read8(regs.hl);
    m.step(0x4b43, 7); // 4b42  ld d,(hl)
    regs.hl = (regs.hl + 1) & 0xffff;
    m.step(0x4b44, 6); // 4b43  inc hl

    mem.write8(regs.de, regs.a);
    m.step(0x4b45, 7); // 4b44  ld (de),a
    regs.e = regs.inc8(regs.e);
    m.step(0x4b46, 4); // 4b45  inc e -- low byte only
    regs.exAf();
    m.step(0x4b47, 4); // 4b46  ex af,af' -- the parked byte is live again
    mem.write8(regs.de, regs.a);
    m.step(0x4b48, 7); // 4b47  ld (de),a

    if (regs.djnz() !== 0) {
      m.step(0x4b35, 13); // 4b48  djnz 0x4b35 (taken)
      continue;
    }
    m.step(0x4b4a, 8); // 4b48  djnz (not taken)
    break;
  }

  m.ret(); // 4b4a  ret
}
