// SPDX-License-Identifier: GPL-3.0-only
//
// loc_2b23  (ROM 0x2b23-0x2b33) -- ticks the 0x8808 countdown; when the 0x8e2a flag is armed and the
// countdown reached zero it re-enters the reset scan loc_2b59, otherwise it tail-calls loc_7e94, which
// pushes 0x7fd6 and rets (redirecting control there); the pushed 0x2b34 is consumed by the redirect
// chain's later ret, so 0x2b34 is NOT the immediate fall-through but the entry of a separate routine
// that still needs translating (it is code, not data). Reached by `jp 0x2b23` from loc_29a0;
// loc_7e94 lives in another batch; treated as a tail delegation.
export function loc_2b23(m) {
  const { regs, mem } = m;

  regs.hl = 0x8808; m.step(0x2b26, 10); // 2b23  ld hl,0x8808
  regs.decMem8(mem, regs.hl); m.step(0x2b27, 11); // 2b26  dec (hl)
  regs.a = mem.read8(0x8e2a); m.step(0x2b2a, 13); // 2b27  ld a,(0x8e2a)
  regs.and(regs.a); m.step(0x2b2b, 4); // 2b2a  and a
  if (regs.fZ) {
    m.step(0x2b31, 12); // 2b2b  jr z,0x2b31
  } else {
    m.step(0x2b2d, 7);
    regs.a = mem.read8(regs.hl); m.step(0x2b2e, 7); // 2b2d  ld a,(hl)
    regs.and(regs.a); m.step(0x2b2f, 4); // 2b2e  and a
    if (regs.fZ) { m.step(0x2b59, 12); return m.call(0x2b59); } // 2b2f  jr z,0x2b59
    m.step(0x2b31, 7);
  }
  m.push16(0x2b34); m.step(0x7e94, 17); return m.call(0x7e94); // 2b31  call 0x7e94 (no-return)
}
