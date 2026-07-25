// SPDX-License-Identifier: GPL-3.0-only

/**
 * shared_1ff6  (ROM 0x1FF6–0x2052) — tail of branch_1fe5/1fef. On (H&7)==3 -> loc_215f.
 *  else clamp via 0x2333, write (ix+5), run 23de/24b4, and set the velocity record.
 */
export function shared_1ff6(m) {
  const { regs, mem } = m;
  const R = (d) => (regs.ix + d) & 0xffff;
  regs.h = mem.read8(R(0x03));
  m.step(0x1ff9, 19); // ld h,(ix+0x03)
  regs.l = mem.read8(R(0x05));
  m.step(0x1ffc, 19); // ld l,(ix+0x05)
  regs.a = regs.h;
  m.step(0x1ffd, 4); // ld a,h
  regs.and(0x07);
  m.step(0x1fff, 7); // and 0x07
  regs.cp(0x03);
  m.step(0x2001, 7); // cp 0x03
  if (regs.fZ) { m.step(0x215f, 10); return m.call(0x215f); } // jp z -- 21xx cluster
  m.step(0x2004, 10);
  regs.l = regs.dec8(regs.l);
  m.step(0x2005, 4); // dec l
  regs.l = regs.dec8(regs.l);
  m.step(0x2006, 4); // dec l
  regs.l = regs.dec8(regs.l);
  m.step(0x2007, 4); // dec l
  m.push16(0x200a);
  m.step(0x2333, 17); // call 0x2333
  m.call(0x2333); // clamp; returns L
  regs.l = regs.inc8(regs.l);
  m.step(0x200b, 4); // inc l
  regs.l = regs.inc8(regs.l);
  m.step(0x200c, 4); // inc l
  regs.l = regs.inc8(regs.l);
  m.step(0x200d, 4); // inc l
  regs.a = regs.l;
  m.step(0x200e, 4); // ld a,l
  mem.write8(R(0x05), regs.a);
  m.step(0x2011, 19); // ld (ix+0x05),a
  m.push16(0x2014);
  m.step(0x23de, 17); // call 0x23de
  m.call(0x23de);
  m.push16(0x2017);
  m.step(0x24b4, 17); // call 0x24b4
  if (!m.call(0x24b4)) return; // skip-capable: spliced to 21ba/loop -> do NOT continue inline
  regs.a = mem.read8(R(0x03));
  m.step(0x201a, 19); // ld a,(ix+0x03)
  regs.cp(0x1c);
  m.step(0x201c, 7); // cp 0x1c
  if (regs.fC) { m.step(0x202f, 10); return m.call(0x202f); } // jp c -- low X
  m.step(0x201f, 10);
  regs.cp(0xe4);
  m.step(0x2021, 7); // cp 0xe4
  if (regs.fC) { m.step(0x21ba, 10); return m.call(0x21ba); } // jp c -- mid X, done
  m.step(0x2024, 10);
  regs.xor(regs.a); // A = 0
  m.step(0x2025, 4); // xor a
  mem.write8(R(0x10), regs.a);
  m.step(0x2028, 19); // ld (ix+0x10),a
  mem.write8(R(0x11), 0x60);
  m.step(0x202c, 19); // ld (ix+0x11),0x60
  m.step(0x2038, 10); // jp 0x2038
  return m.call(0x2038);
}
