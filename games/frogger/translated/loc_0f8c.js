// SPDX-License-Identifier: GPL-3.0-only

// loc_0f8c  (ROM 0x0F8C-0x0FAE) — frog-anim pre-helper (called by arm loc_1058). Guarded by (0x8118):
// blits 8 rows of a 2-byte tile pair from the source at 0x1413 down VRAM (stride 0x1F), then clears
// (0x8118). Returns immediately when (0x8118) == 0.
export function loc_0f8c(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x8118); // trigger flag
  m.step(0x0f8f, 13);
  regs.and(regs.a);
  m.step(0x0f90, 4); // Z iff trigger clear
  if (regs.fZ) {
    m.ret(11); // ret z
    return;
  }
  m.step(0x0f91, 5);
  regs.de = 0xa806; // VRAM dest
  m.step(0x0f94, 10);
  regs.b = 0x08; // 8 rows
  m.step(0x0f96, 7);
  regs.hl = 0x1413; // tile-pair source
  m.step(0x0f99, 10);

  for (;;) {
    // loc_0f99:
    regs.a = mem.read8(regs.hl);
    m.step(0x0f9a, 7);
    mem.write8(regs.de, regs.a);
    m.step(0x0f9b, 7);
    regs.hl = (regs.hl + 1) & 0xffff;
    m.step(0x0f9c, 6);
    regs.de = (regs.de + 1) & 0xffff;
    m.step(0x0f9d, 6);
    regs.a = mem.read8(regs.hl);
    m.step(0x0f9e, 7);
    mem.write8(regs.de, regs.a);
    m.step(0x0f9f, 7);
    regs.hl = (regs.hl + 1) & 0xffff;
    m.step(0x0fa0, 6);
    m.push16(regs.bc);
    m.step(0x0fa1, 11);
    regs.bc = 0x001f; // dest row stride
    m.step(0x0fa4, 10);
    regs.exDeHl();
    m.step(0x0fa5, 4);
    regs.addHl(regs.bc);
    m.step(0x0fa6, 11); // advance dest by 0x1f
    regs.exDeHl();
    m.step(0x0fa7, 4);
    regs.bc = m.pop16();
    m.step(0x0fa8, 10);
    if (regs.djnz() !== 0) {
      m.step(0x0f99, 13); // djnz 0x0f99
      continue;
    }
    m.step(0x0faa, 8);
    break;
  }

  regs.xor(regs.a);
  m.step(0x0fab, 4);
  mem.write8(0x8118, regs.a);
  m.step(0x0fae, 13); // clear the trigger
  m.ret(10);
}
