// SPDX-License-Identifier: GPL-3.0-only

// loc_0069  (ROM 0x0069-0x00A7)
export function loc_0069(m) {
  const { regs, mem } = m;

  const kick = (next, cyc) => { mem.write8(0xc200, regs.a, 10); m.step(next, cyc); };

  const clear = (base, retAddr, loopTop, afterAddr) => {
    regs.hl = base;
    m.step(retAddr, 10); // ld hl,base
    regs.b = 0x30;
    m.step(loopTop, 7); // ld b,0x30
    for (;;) {
      mem.write8(regs.hl, 0x00, 7);
      m.step(loopTop + 2, 10); // ld (hl),0x00
      regs.hl = (regs.hl + 1) & 0xffff;
      m.step(loopTop + 3, 6); // inc hl
      regs.b = (regs.b - 1) & 0xff;
      if (regs.b !== 0) { m.step(loopTop, 13); continue; } // djnz taken
      m.step(afterAddr, 8); // djnz not taken
      break;
    }
  };

  kick(0x006c, 13); // ld (0xc200),a
  clear(0xb411, 0x006f, 0x0071, 0x0076);
  kick(0x0079, 13); // ld (0xc200),a
  clear(0xb410, 0x007c, 0x007e, 0x0083);
  kick(0x0086, 13); // ld (0xc200),a

  regs.hl = 0xa800;
  m.step(0x0089, 10); // ld hl,0xa800
  regs.de = 0xa801;
  m.step(0x008c, 10); // ld de,0xa801
  regs.bc = 0x07ff;
  m.step(0x008f, 10); // ld bc,0x07ff
  mem.write8(regs.hl, 0x00, 7);
  m.step(0x0091, 10); // ld (hl),0x00
  m.ldirAt(0x0091, 0x0093); // ldir

  kick(0x0096, 13); // ld (0xc200),a

  regs.b = 0x00; // 256 iterations, not zero
  m.step(0x0098, 7); // ld b,0x00
  regs.hl = 0x00d8;
  m.step(0x009b, 10); // ld hl,0x00d8
  regs.xor(regs.a);
  m.step(0x009c, 4); // xor a

  for (;;) {
    regs.add(mem.read8(regs.hl));
    m.step(0x009d, 7); // add a,(hl)
    regs.hl = (regs.hl + 1) & 0xffff;
    m.step(0x009e, 6); // inc hl
    regs.b = (regs.b - 1) & 0xff;
    if (regs.b !== 0) { m.step(0x009c, 13); continue; } // djnz taken
    m.step(0x00a0, 8); // djnz not taken
    break;
  }

  regs.sub(0x87);
  m.step(0x00a2, 7); // sub 0x87

  if (regs.fNZ) {
    m.push16(0x00a5);
    m.step(0x00d8, 17); // call nz,0x00d8
    m.call(0x00d8);
  } else {
    m.step(0x00a5, 10); // call nz not taken
  }

  m.step(0x5866, 10); // jp 0x5866
  return m.call(0x5866);
}
