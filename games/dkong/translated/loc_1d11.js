// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_1d11  (ROM 0x1D11–0x1D3E) — shared animation body (ROM 0x1D11). A = delta (LIVE-IN): -2 from.
 * entry_1d03, +2 from the twin loc_1cf2. (0x6205) += delta; toggle phase 0x6222.
 */
export function loc_1d11(m) {
  const { regs, mem } = m;
  regs.hl = 0x6205;
  m.step(0x1d14, 10); // ld hl,0x6205
  regs.add(mem.read8(regs.hl)); // add a,(hl) -- (0x6205) += delta, sets flags
  m.step(0x1d15, 7);
  mem.write8(regs.hl, regs.a);
  m.step(0x1d16, 7); // ld (hl),a
  regs.b = regs.a;
  m.step(0x1d17, 4); // ld b,a
  regs.a = mem.read8(0x6222);
  m.step(0x1d1a, 13); // ld a,(0x6222)
  regs.xor(0x01);
  m.step(0x1d1c, 7); // xor 0x01 -- toggle phase
  mem.write8(0x6222, regs.a);
  m.step(0x1d1f, 13); // ld (0x6222),a
  if (regs.fNZ) { m.step(0x1d51, 10); return m.call(0x1d51); } // jp nz,0x1d51
  m.step(0x1d22, 10); // phase -> 0
  regs.a = regs.b;
  m.step(0x1d23, 4); // ld a,b
  regs.add(0x08);
  m.step(0x1d25, 7); // add a,0x08
  regs.hl = 0x621c;
  m.step(0x1d28, 10); // ld hl,0x621c
  regs.cp(mem.read8(regs.hl));
  m.step(0x1d29, 7); // cp (hl)
  if (regs.fZ) { m.step(0x1d67, 10); return m.call(0x1d67); } // jp z,0x1d67
  m.step(0x1d2c, 10);
  regs.l = (regs.l - 1) & 0xff;
  m.step(0x1d2d, 4); // dec l -> 0x621b
  regs.sub(mem.read8(regs.hl));
  m.step(0x1d2e, 7); // sub (hl)
  if (regs.fZ) { m.step(0x1d67, 10); return m.call(0x1d67); } // jp z,0x1d67
  m.step(0x1d31, 10);
  regs.b = 0x05;
  m.step(0x1d33, 7); // ld b,0x05
  regs.sub(0x08);
  m.step(0x1d35, 7); // sub 0x08
  if (regs.fZ) { m.step(0x1d3f, 10); return m.call(0x1d3f); } // jp z,0x1d3f (frame 5)
  m.step(0x1d38, 10);
  regs.b = regs.dec8(regs.b);
  m.step(0x1d39, 4); // dec b (=4)
  regs.sub(0x04);
  m.step(0x1d3b, 7); // sub 0x04
  if (regs.fZ) { m.step(0x1d3f, 10); return m.call(0x1d3f); } // jp z,0x1d3f (frame 4)
  m.step(0x1d3e, 10);
  regs.b = regs.dec8(regs.b);
  m.step(0x1d3f, 4); // dec b (=3) -- falls into loc_1d3f
  return m.call(0x1d3f);
}
