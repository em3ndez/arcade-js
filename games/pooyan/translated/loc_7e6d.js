// SPDX-License-Identifier: GPL-3.0-only

// loc_7e6d  (ROM 0x7e6d-0x7e93) -- integrity/anti-tamper guard. Gated on (0x8988) >= 4 and
// (0x8a5f) == 0; then sums ROM from 0x64be DOWNWARD (byte sum -> C, carry count -> E) until the
// 0x34 sentinel is met, and if (E + C) & 0xb0 is non-zero bumps the tamper counter at 0x89ef.
// Straight-line + one loop, every exit a ret; each m.step carries its landing.
export function loc_7e6d(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x8988);
  m.step(0x7e70, 13); // 7e6d  ld a,(0x8988)
  regs.cp(0x04);
  m.step(0x7e72, 7); // 7e70  cp 0x04
  if (regs.fC) { m.ret(11); return; } // 7e72  ret c
  m.step(0x7e73, 5); // 7e72  ret c (not taken)

  regs.a = mem.read8(0x8a5f);
  m.step(0x7e76, 13); // 7e73  ld a,(0x8a5f)
  regs.and(regs.a);
  m.step(0x7e77, 4); // 7e76  and a
  if (regs.fNZ) { m.ret(11); return; } // 7e77  ret nz
  m.step(0x7e78, 5); // 7e77  ret nz (not taken)

  regs.hl = 0x64be;
  m.step(0x7e7b, 10); // 7e78  ld hl,0x64be
  regs.c = 0x00;
  m.step(0x7e7d, 7); // 7e7b  ld c,0x00
  regs.e = regs.c;
  m.step(0x7e7e, 4); // 7e7d  ld e,c

  for (;;) {
    regs.a = mem.read8(regs.hl);
    m.step(0x7e7f, 7); // 7e7e  ld a,(hl)
    regs.hl = (regs.hl - 1) & 0xffff;
    m.step(0x7e80, 6); // 7e7f  dec hl
    regs.add(regs.c);
    m.step(0x7e81, 4); // 7e80  add a,c
    regs.c = regs.a;
    m.step(0x7e82, 4); // 7e81  ld c,a
    if (regs.fNC) {
      m.step(0x7e85, 12); // 7e82  jr nc
    } else {
      m.step(0x7e84, 7);
      regs.e = regs.inc8(regs.e);
      m.step(0x7e85, 4); // 7e84  inc e  -- carry count
    }
    regs.a = 0x34;
    m.step(0x7e87, 7); // 7e85  ld a,0x34
    regs.cp(mem.read8(regs.hl));
    m.step(0x7e88, 7); // 7e87  cp (hl)  -- sentinel test
    if (regs.fNZ) { m.step(0x7e7e, 12); continue; } // 7e88  jr nz (loop)
    m.step(0x7e8a, 7); // 7e88  jr nz (not taken)
    break;
  }

  regs.a = regs.e;
  m.step(0x7e8b, 4); // 7e8a  ld a,e
  regs.add(regs.c);
  m.step(0x7e8c, 4); // 7e8b  add a,c
  regs.and(0xb0);
  m.step(0x7e8e, 7); // 7e8c  and 0xb0
  if (regs.fZ) { m.ret(11); return; } // 7e8e  ret z
  m.step(0x7e8f, 5); // 7e8e  ret z (not taken)

  regs.hl = 0x89ef;
  m.step(0x7e92, 10); // 7e8f  ld hl,0x89ef
  regs.incMem8(mem, regs.hl);
  m.step(0x7e93, 11); // 7e92  inc (hl)  -- tamper counter
  m.ret(); // 7e93  ret
}
