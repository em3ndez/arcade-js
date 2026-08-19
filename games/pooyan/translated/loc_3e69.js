// SPDX-License-Identifier: GPL-3.0-only

// loc_3e69  (ROM 0x3e69-0x3e9b) -- object state-5 handler (0x33a7 dispatch, index 5).
// Counts down the frame timer (ix+0x11); on expiry it reads a 5-byte spawn descriptor from the
// linked record (ix+0x14:0x15)+2: the first byte is a type gated to 0x05..0x06 (out of range ->
// loc_3553), the next four seed the object's position (ix+0x03..0x06, with the 0x04 byte pre-decre-
// mented). It clears (ix+0x15), advances the state, and FALLS THROUGH into the state-6 handler
// loc_3e9c.
export function loc_3e69(m) {
  const { regs, mem } = m;

  regs.decMem8(mem, (regs.ix + 0x11) & 0xffff); m.step(0x3e6c, 23);
  if (regs.fNZ) { m.ret(11); return; }
  m.step(0x3e6d, 5);
  regs.l = mem.read8((regs.ix + 0x14) & 0xffff); m.step(0x3e70, 19);
  regs.h = mem.read8((regs.ix + 0x15) & 0xffff); m.step(0x3e73, 19);
  regs.l = regs.inc8(regs.l); m.step(0x3e74, 4);
  regs.l = regs.inc8(regs.l); m.step(0x3e75, 4);
  regs.a = mem.read8(regs.hl); m.step(0x3e76, 7);
  regs.cp(0x05); m.step(0x3e78, 7);
  if (regs.fC) { m.step(0x3553, 10); return m.call(0x3553); }
  m.step(0x3e7b, 10);
  regs.cp(0x07); m.step(0x3e7d, 7);
  if (regs.fNC) { m.step(0x3553, 10); return m.call(0x3553); }
  m.step(0x3e80, 10);
  regs.l = regs.inc8(regs.l); m.step(0x3e81, 4);
  regs.a = mem.read8(regs.hl); m.step(0x3e82, 7);
  mem.write8((regs.ix + 0x03) & 0xffff, regs.a); m.step(0x3e85, 19);
  regs.l = regs.inc8(regs.l); m.step(0x3e86, 4);
  regs.a = mem.read8(regs.hl); m.step(0x3e87, 7);
  regs.a = regs.dec8(regs.a); m.step(0x3e88, 4);
  mem.write8((regs.ix + 0x04) & 0xffff, regs.a); m.step(0x3e8b, 19);
  regs.l = regs.inc8(regs.l); m.step(0x3e8c, 4);
  regs.a = mem.read8(regs.hl); m.step(0x3e8d, 7);
  mem.write8((regs.ix + 0x05) & 0xffff, regs.a); m.step(0x3e90, 19);
  regs.l = regs.inc8(regs.l); m.step(0x3e91, 4);
  regs.a = mem.read8(regs.hl); m.step(0x3e92, 7);
  mem.write8((regs.ix + 0x06) & 0xffff, regs.a); m.step(0x3e95, 19);
  mem.write8((regs.ix + 0x15) & 0xffff, 0x00); m.step(0x3e99, 19);
  regs.incMem8(mem, (regs.ix + 0x02) & 0xffff); m.step(0x3e9c, 23);
  return m.call(0x3e9c);
}
