// SPDX-License-Identifier: GPL-3.0-only

// loc_5871  (ROM 0x5871-0x588d) -- eagle-launch gate. Stores A into 0x8900, then compares the
// threshold (0x8901) against the current count (0x8d40): returns if equal, below, or if the count
// already reached 6. Otherwise it marks the eagle active (0x8d4a=1), points IX at the eagle sprite
// block base (0x8ae0), sets B=6, and falls through into loc_588e to run the per-eagle init loop.
export function loc_5871(m) {
  const { regs, mem } = m;

  mem.write8(0x8900, regs.a);       m.step(0x5874, 13);
  regs.a = mem.read8(0x8901);       m.step(0x5877, 13);
  regs.hl = 0x8d40;                 m.step(0x587a, 10);
  regs.sub(mem.read8(regs.hl));     m.step(0x587b, 7); // sub (hl)
  if (regs.fZ) { m.ret(11); return; } // ret z
  m.step(0x587c, 5);
  if (regs.fC) { m.ret(11); return; } // ret c
  m.step(0x587d, 5);
  regs.a = mem.read8(0x8d40);       m.step(0x5880, 13);
  regs.cp(0x06);                    m.step(0x5882, 7);
  if (regs.fNC) { m.ret(11); return; } // ret nc
  m.step(0x5883, 5);

  regs.a = 0x01;                    m.step(0x5885, 7);
  mem.write8(0x8d4a, regs.a);       m.step(0x5888, 13);
  regs.ix = 0x8ae0;                 m.step(0x588c, 14);
  regs.b = 0x06;                    m.step(0x588e, 7); // ld b,0x06 -- falls through to loc_588e
  return m.call(0x588e);
}
