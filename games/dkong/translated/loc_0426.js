// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_0426  (ROM 0x0426–0x044D) — the frame counter (0x6390); 0x80 -> reset (loc_0464); 32-frame boundary -> table copy.
 */
export function loc_0426(m) {
  const { regs, mem } = m;
  regs.hl = 0x6390;
  m.step(0x0429, 10); // ld hl,0x6390
  mem.write8(regs.hl, regs.inc8(mem.read8(regs.hl)));
  m.step(0x042a, 11); // inc (hl) -- (0x6390)++
  regs.a = mem.read8(regs.hl);
  m.step(0x042b, 7); // ld a,(hl)
  regs.cp(0x80);
  m.step(0x042d, 7); // cp 0x80
  if (regs.fZ) { m.step(0x0464, 10); return m.call(0x0464); } // jp z,0x0464
  m.step(0x0430, 10);
  regs.a = mem.read8(0x6393);
  m.step(0x0433, 13); // ld a,(0x6393)
  regs.and(regs.a);
  m.step(0x0434, 4); // and a
  if (regs.fNZ) { m.step(0x0486, 10); return m.call(0x0486); } // jp nz,0x0486
  m.step(0x0437, 10);
  regs.a = mem.read8(regs.hl); // hl still 0x6390
  m.step(0x0438, 7); // ld a,(hl)
  regs.b = regs.a;
  m.step(0x0439, 4); // ld b,a
  regs.and(0x1f);
  m.step(0x043b, 7); // and 0x1f
  if (regs.fNZ) { m.step(0x0486, 10); return m.call(0x0486); } // jp nz,0x0486
  m.step(0x043e, 10); // NOT taken: 32-frame boundary
  regs.hl = 0x39cf;
  m.step(0x0441, 10); // ld hl,0x39cf
  const b5 = regs.bit(5, regs.b);
  m.step(0x0443, 8); // bit 5,b
  if (b5) {
    m.step(0x0448, 12); // jr nz,0x0448 (taken)
  } else {
    m.step(0x0445, 7); // jr nz NOT taken
    regs.hl = 0x39f7;
    m.step(0x0448, 10); // ld hl,0x39f7
  }
  m.push16(0x044b); m.step(0x004e, 17); m.call(0x004e); // call 0x004e
  regs.a = 0x03;
  m.step(0x044d, 7); // ld a,0x03
  mem.write8(0x6082, regs.a);
  m.step(0x0450, 13); // ld (0x6082),a -- falls into 0x0450
  return m.call(0x0450);
}
