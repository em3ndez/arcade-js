// SPDX-License-Identifier: GPL-3.0-only

// loc_705f  (ROM 0x705f-0x7070) -- level-intro phase 6 (final). Counts the (0x8f48) delay down; on
// expiry it runs 0x0ecf (screen/actor setup), clears (0x8f52), writes (0x880a)=6 and returns -- the
// round is now ready to hand off to gameplay.
export function loc_705f(m) {
  const { regs, mem } = m;

  regs.hl = 0x8f48;
  m.step(0x7062, 10); // 705f  ld hl,0x8f48
  regs.decMem8(mem, regs.hl);
  m.step(0x7063, 11); // 7062  dec (hl)
  if (regs.fNZ) { m.ret(11); return; } // 7063  ret nz
  m.step(0x7064, 5);
  m.push16(0x7067);
  m.step(0x0ecf, 17); // 7064  call 0x0ecf
  m.call(0x0ecf);
  regs.xor(regs.a);
  m.step(0x7068, 4); // 7067  xor a
  mem.write8(0x8f52, regs.a);
  m.step(0x706b, 13); // 7068  ld (0x8f52),a
  regs.a = 0x06;
  m.step(0x706d, 7); // 706b  ld a,0x06
  mem.write8(0x880a, regs.a);
  m.step(0x7070, 13); // 706d  ld (0x880a),a
  m.ret(); // 7070  ret
}
