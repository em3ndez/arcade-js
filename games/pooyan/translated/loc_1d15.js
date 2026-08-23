// SPDX-License-Identifier: GPL-3.0-only

// loc_1d15  (ROM 0x1d15-0x1d3b) -- full-clear tail of the 0x15a8 dispatch handler, a distinct
// routine (reached by `jr z,0x1d15` from loc_1c66 and by `m.call(0x1d15)` from loc_1cf6). Clears
// 0xbf bytes at 0x8900 (rst 0x10), reseeds one player via a sprite-slot mid-entry -- (0x880e)==0
// -> loc_1d0d else loc_1ce7 -- then either finishes the player-continue path (0x8805=1/0x881f=1)
// and returns, or delegates to the cold teardown loc_1d3c.
// -- The call z,0x1d0d / call nz,0x1ce7 pair both read the Z of `and a` at 0x1d1f: Z survives
//    loc_1d0d (its only flag op, add hl,de, preserves S/Z/PV on the Z80), so exactly one fires.
export function loc_1d15(m) {
  const { regs, mem } = m;

  regs.xor(regs.a);            m.step(0x1d16, 4);
  regs.hl = 0x8900;            m.step(0x1d19, 10);
  regs.b = 0xbf;               m.step(0x1d1b, 7);
  m.push16(0x1d1c); m.step(0x0010, 11); m.call(0x0010); // rst 0x10 -- fill 0x8900.. (B=0xbf)
  regs.a = mem.read8(0x880e);  m.step(0x1d1f, 13);
  regs.and(regs.a);            m.step(0x1d20, 4);
  if (regs.fZ) { m.push16(0x1d23); m.step(0x1d0d, 17); m.call(0x1d0d); } // call z,0x1d0d
  else { m.step(0x1d23, 10); }
  if (regs.fNZ) { m.push16(0x1d26); m.step(0x1ce7, 17); m.call(0x1ce7); } // call nz,0x1ce7
  else { m.step(0x1d26, 10); }
  regs.a = mem.read8(0x8802);  m.step(0x1d29, 13);
  regs.and(regs.a);            m.step(0x1d2a, 4);
  if (regs.fZ) { m.step(0x1d3c, 12); return m.call(0x1d3c); } // jr z,0x1d3c -- cold teardown
  m.step(0x1d2c, 7);
  regs.xor(regs.a);            m.step(0x1d2d, 4);
  mem.write8(0x8806, regs.a);  m.step(0x1d30, 13);
  mem.write8(0x880a, regs.a);  m.step(0x1d33, 13);
  regs.a = regs.inc8(regs.a);  m.step(0x1d34, 4);
  mem.write8(0x881f, regs.a);  m.step(0x1d37, 13);
  regs.a = regs.inc8(regs.a);  m.step(0x1d38, 4);
  mem.write8(0x8805, regs.a);  m.step(0x1d3b, 13);
  return m.ret();
}
