// SPDX-License-Identifier: GPL-3.0-only

// loc_4364  (ROM 0x4364-0x4375) -- object state handler: while the (ix+0x11) phase timer is nonzero,
// count it down and return; once it reaches zero, tick loc_4006, then loc_3fd5 (returns carry to
// abort), and tail into loc_3553 on success.
export function loc_4364(m) {
  const { regs, mem } = m;

  regs.a = mem.read8((regs.ix + 0x11) & 0xffff); m.step(0x4367, 19); // 4364  ld a,(ix+0x11)
  regs.and(regs.a);                    m.step(0x4368, 4);            // 4367  and a
  if (regs.fNZ) {                      // 4368  jr z,0x436e not taken
    m.step(0x436a, 7);
    regs.decMem8(mem, (regs.ix + 0x11) & 0xffff); m.step(0x436d, 23); // 436a  dec (ix+0x11)
    return m.ret(10);                  // 436d  ret
  }
  m.step(0x436e, 12);                  // 4368  jr z,0x436e taken

  m.push16(0x4371);
  m.step(0x4006, 17);                  // 436e  call 0x4006
  m.call(0x4006);
  m.push16(0x4374);
  m.step(0x3fd5, 17);                  // 4371  call 0x3fd5
  m.call(0x3fd5);
  if (regs.fC) { return m.ret(11); }   // 4374  ret c
  m.step(0x4375, 5);
  m.step(0x3553, 10);                  // 4375  jp 0x3553 (tail)
  return m.call(0x3553);
}
