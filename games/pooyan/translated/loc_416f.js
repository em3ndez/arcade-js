// SPDX-License-Identifier: GPL-3.0-only

// loc_416f  (ROM 0x416f-0x4178) -- per-object dwell-then-dispatch step; object block based at IX.
// loc_4006 animates the object, then (ix+11h) is a dwell countdown: while non-zero, return.
// On expiry, tail into loc_3553 (the object's next-state handler), reusing this frame.
export function loc_416f(m) {
  const { regs, mem } = m;

  m.push16(0x4172);
  m.step(0x4006, 17);                                            // 416f  call 0x4006
  m.call(0x4006);
  regs.decMem8(mem, (regs.ix + 0x11) & 0xffff); m.step(0x4175, 23); // 4172  dec (ix+11h)
  if (regs.fNZ) { return m.ret(11); }                            // 4175  ret nz -- still dwelling
  m.step(0x4176, 5);                                             // 4175  ret nz not taken (5T)
  m.step(0x3553, 10);                                            // 4176  jp 0x3553 (tail)
  return m.call(0x3553);
}
