// SPDX-License-Identifier: GPL-3.0-only

// loc_1a02  (ROM 0x1A02-0x1A54) — object-animation state init: seed the per-lane animation
// frame/sprite cells at 0x8021-0x803b and the 0x800d..0x801f block. PURE LEAF (ret).
export function loc_1a02(m) {
  const { regs, mem } = m;

  regs.a = 0x05;
  m.step(0x1a04, 7);
  mem.write8(0x8025, regs.a);
  m.step(0x1a07, 13);
  mem.write8(0x8027, regs.a);
  m.step(0x1a0a, 13);

  regs.a = 0x04;
  m.step(0x1a0c, 7);
  mem.write8(0x802d, regs.a);
  m.step(0x1a0f, 13);
  mem.write8(0x802f, regs.a);
  m.step(0x1a12, 13);

  regs.a = 0x07;
  m.step(0x1a14, 7);
  mem.write8(0x8035, regs.a);
  m.step(0x1a17, 13);
  mem.write8(0x8037, regs.a);
  m.step(0x1a1a, 13);

  regs.a = 0x06;
  m.step(0x1a1c, 7);
  mem.write8(0x8021, regs.a);
  m.step(0x1a1f, 13);
  mem.write8(0x8023, regs.a);
  m.step(0x1a22, 13);
  mem.write8(0x8039, regs.a);
  m.step(0x1a25, 13);
  mem.write8(0x803b, regs.a);
  m.step(0x1a28, 13);

  regs.a = 0x05;
  m.step(0x1a2a, 7);
  regs.b = 0x0a;
  m.step(0x1a2c, 7); // B = 0x0a loop count
  regs.hl = 0x800d;
  m.step(0x1a2f, 10);

  for (;;) {
    // loc_1a2f: seed A into every 2nd cell from 0x800d, B times
    mem.write8(regs.hl, regs.a);
    m.step(0x1a30, 7);
    regs.hl = (regs.hl + 1) & 0xffff;
    m.step(0x1a31, 6);
    regs.hl = (regs.hl + 1) & 0xffff;
    m.step(0x1a32, 6);
    if (regs.djnz() !== 0) {
      m.step(0x1a2f, 13);
      continue;
    }
    m.step(0x1a34, 8);
    break;
  }

  mem.write8(0x8029, regs.a);
  m.step(0x1a37, 13);
  mem.write8(0x802b, regs.a);
  m.step(0x1a3a, 13);
  mem.write8(0x8031, regs.a);
  m.step(0x1a3d, 13);
  mem.write8(0x8033, regs.a);
  m.step(0x1a40, 13);

  regs.a = 0x02;
  m.step(0x1a42, 7);
  mem.write8(0x800d, regs.a);
  m.step(0x1a45, 13);
  mem.write8(0x800f, regs.a);
  m.step(0x1a48, 13);
  mem.write8(0x8015, regs.a);
  m.step(0x1a4b, 13);
  mem.write8(0x8017, regs.a);
  m.step(0x1a4e, 13);
  mem.write8(0x8019, regs.a);
  m.step(0x1a51, 13);
  mem.write8(0x801b, regs.a);
  m.step(0x1a54, 13);

  m.ret();
}
