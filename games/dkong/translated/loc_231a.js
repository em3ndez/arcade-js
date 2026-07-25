// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_231a  (ROM 0x231A–0x2332) — sub_22cb diff-5 velocity: 2-bit direction code (from playerX-objX sign, rotated) into (ix+0x10), delta into (ix+0x11). IX live-in.
 */
export function loc_231a(m) {
  const { regs, mem } = m;
  regs.a = mem.read8(0x6203);
  m.step(0x231d, 13);
  regs.sub(mem.read8((regs.ix + 0x03) & 0xffff));
  m.step(0x2320, 19); // playerX - objX
  regs.c = 0xff;
  m.step(0x2322, 7);
  if (!regs.fC) {
    m.step(0x2325, 10);
    regs.c = regs.inc8(regs.c);
    m.step(0x2326, 4); // player right -> C=0
  } else {
    m.step(0x2326, 10);
  }
  regs.rlca();
  m.step(0x2327, 4);
  regs.c = regs.rl(regs.c);
  m.step(0x2329, 8);
  regs.rlca();
  m.step(0x232a, 4);
  regs.c = regs.rl(regs.c);
  m.step(0x232c, 8);
  mem.write8((regs.ix + 0x10) & 0xffff, regs.c);
  m.step(0x232f, 19); // (ix+0x10) = code
  mem.write8((regs.ix + 0x11) & 0xffff, regs.a);
  m.step(0x2332, 19); // (ix+0x11) = delta
  m.ret(10);
}
