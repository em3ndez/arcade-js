// SPDX-License-Identifier: GPL-3.0-only

// loc_0a16  (ROM 0x0A16-0x0A47) — render the time-remaining bar: pick the countdown byte
// ((0x83E4)/(0x83E5)/(0x83E6) per player state), then draw B copies of tile 0x4D up the column at
// 0xABBE stepping -0x20, capped with tile 0x10. Returns early if (0x83E4)==0xFF. Called from
// loc_0425 (0x0432).
export function loc_0a16(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x83e4);
  m.step(0x0a19, 13);
  regs.a = regs.inc8(regs.a);
  m.step(0x0a1a, 4); // Z iff (0x83e4) == 0xff
  if (regs.fZ) {
    m.ret(11);
    return;
  }
  m.step(0x0a1b, 5);

  regs.a = mem.read8(0x83fe);
  m.step(0x0a1e, 13);
  regs.or(regs.a);
  m.step(0x0a1f, 4);
  if (regs.fNZ) {
    m.step(0x0a26, 12);
    return block_0a26();
  }
  m.step(0x0a21, 7);
  regs.hl = 0x83e4;
  m.step(0x0a24, 10);
  m.step(0x0a34, 12);
  return block_0a34();

  function block_0a26() {
    regs.a = mem.read8(0x83fd);
    m.step(0x0a29, 13);
    regs.a = regs.dec8(regs.a);
    m.step(0x0a2a, 4);
    if (regs.fNZ) {
      m.step(0x0a31, 12);
      return block_0a31();
    }
    m.step(0x0a2c, 7);
    regs.hl = 0x83e5;
    m.step(0x0a2f, 10);
    m.step(0x0a34, 12);
    return block_0a34();
  }

  function block_0a31() {
    regs.hl = 0x83e6;
    m.step(0x0a34, 10);
    return block_0a34();
  }

  function block_0a34() {
    regs.b = mem.read8(regs.hl);
    m.step(0x0a35, 7); // B = the selected countdown byte
    regs.a = regs.b;
    m.step(0x0a36, 4);
    regs.or(regs.a);
    m.step(0x0a37, 4); // Z iff B == 0
    regs.a = 0x4d;
    m.step(0x0a39, 7); // tile 0x4d (ld leaves Z intact)
    regs.de = 0xffe0;
    m.step(0x0a3c, 10); // DE = -0x20 (one row up)
    regs.hl = 0xabbe;
    m.step(0x0a3f, 10);
    if (regs.fZ) {
      m.step(0x0a45, 12);
      return block_0a45();
    }
    m.step(0x0a41, 7);
    return block_0a41();
  }

  function block_0a41() {
    for (;;) {
      // loc_0a41: draw one bar tile
      mem.write8(regs.hl, regs.a);
      m.step(0x0a42, 7);
      regs.addHl(regs.de);
      m.step(0x0a43, 11);
      if (m.regs.djnz() !== 0) {
        m.step(0x0a41, 13);
        continue;
      }
      m.step(0x0a45, 8);
      break;
    }
    return block_0a45();
  }

  function block_0a45() {
    mem.write8(regs.hl, 0x10);
    m.step(0x0a47, 10); // cap the bar with tile 0x10
    m.ret();
  }
}
