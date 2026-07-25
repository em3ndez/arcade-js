// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_2b53  (ROM 0x2B53–0x2B71) — (0x6227)!=1 arm: probe (X-3, Y+7), classify, maybe a second probe (D+7, E).
 */
export function loc_2b53(m) {
  const { regs, mem } = m;
  regs.a = mem.read8(0x6203);
  m.step(0x2b56, 13); // ld a,(0x6203)
  regs.sub(0x03);
  m.step(0x2b58, 7); // sub 0x03
  regs.h = regs.a;
  m.step(0x2b59, 4); // ld h,a
  regs.a = mem.read8(0x6205);
  m.step(0x2b5c, 13); // ld a,(0x6205)
  regs.add(0x07);
  m.step(0x2b5e, 7); // add a,0x07
  regs.l = regs.a;
  m.step(0x2b5f, 4); // ld l,a
  m.push16(0x2b62); m.step(0x2b9b, 17); // call 0x2b9b
  if (m.call(0x2b9b) === false) return false; // double-skip
  regs.cp(0x02);
  m.step(0x2b64, 7); // cp 0x02
  if (regs.fZ) { m.step(0x2b7a, 10); return m.call(0x2b7a); } // jp z,0x2b7a (success-2, A==2)
  m.step(0x2b67, 10);
  regs.a = regs.d; // D = original H (X-3)
  m.step(0x2b68, 4); // ld a,d
  regs.add(0x07);
  m.step(0x2b6a, 7); // add a,0x07
  regs.h = regs.a;
  m.step(0x2b6b, 4); // ld h,a
  regs.l = regs.e; // L = E
  m.step(0x2b6c, 4); // ld l,e
  m.push16(0x2b6f); m.step(0x2b9b, 17); // call 0x2b9b
  if (m.call(0x2b9b) === false) return false; // double-skip
  regs.and(regs.a);
  m.step(0x2b70, 4); // and a
  if (regs.fZ) { m.ret(11); return true; } // ret z -- NORMAL return (entry_2b1c continues)
  m.step(0x2b71, 5); // ret z not taken
  m.step(0x2b7a, 10); // jp 0x2b7a
  return m.call(0x2b7a);
}
