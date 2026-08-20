// SPDX-License-Identifier: GPL-3.0-only

// loc_403c  (ROM 0x403c-0x4071) -- animation-sequence stepper for the actor at IY.
// (iy+0x0e) is a frame-hold counter: while non-zero it decrements and returns (hold the current
// frame). On expiry it walks the sequence stream pointed by (iy+0x0c:0x0d): a 0xff opcode reloads
// that pointer from the next two stream bytes and re-reads; any other byte is a 3-byte frame record
// -- byte0->(iy+0x10), byte1->(iy+0x0f), byte2->(iy+0x0e) (new hold) -- after which the advanced
// pointer is stored back and it returns. Pure leaf (no calls). Called by loc_3cae to prime a child.
export function loc_403c(m) {
  const { regs, mem } = m;

  regs.a = mem.read8((regs.iy + 0x0e) & 0xffff); m.step(0x403f, 19);
  regs.and(regs.a);                              m.step(0x4040, 4);
  if (regs.fZ) {
    m.step(0x4046, 12); // 4040  jr z,0x4046 -- hold expired, advance the sequence
  } else {
    m.step(0x4042, 7);
    regs.decMem8(mem, (regs.iy + 0x0e) & 0xffff); m.step(0x4045, 23); // 4042  dec (iy+0x0e)
    m.ret(); return; // 4045  ret -- still holding this frame
  }

  for (;;) { // 4046  loop head: read the next stream record
    regs.l = mem.read8((regs.iy + 0x0c) & 0xffff); m.step(0x4049, 19);
    regs.h = mem.read8((regs.iy + 0x0d) & 0xffff); m.step(0x404c, 19);
    regs.a = mem.read8(regs.hl);                   m.step(0x404d, 7);
    regs.cp(0xff);                                 m.step(0x404f, 7);
    if (regs.fZ) {
      m.step(0x4066, 12); // 404f  jr z,0x4066 -- 0xff: reload the stream pointer
      regs.hl = (regs.hl + 1) & 0xffff;              m.step(0x4067, 6);
      regs.a = mem.read8(regs.hl);                   m.step(0x4068, 7);
      mem.write8((regs.iy + 0x0c) & 0xffff, regs.a); m.step(0x406b, 19);
      regs.hl = (regs.hl + 1) & 0xffff;              m.step(0x406c, 6);
      regs.a = mem.read8(regs.hl);                   m.step(0x406d, 7);
      mem.write8((regs.iy + 0x0d) & 0xffff, regs.a); m.step(0x4070, 19);
      m.step(0x4046, 12); // 4070  jr 0x4046
      continue;
    }
    m.step(0x4051, 7); // 404f  jr z not taken -- frame record
    mem.write8((regs.iy + 0x10) & 0xffff, regs.a); m.step(0x4054, 19);
    regs.hl = (regs.hl + 1) & 0xffff;              m.step(0x4055, 6);
    regs.a = mem.read8(regs.hl);                   m.step(0x4056, 7);
    mem.write8((regs.iy + 0x0f) & 0xffff, regs.a); m.step(0x4059, 19);
    regs.hl = (regs.hl + 1) & 0xffff;              m.step(0x405a, 6);
    regs.a = mem.read8(regs.hl);                   m.step(0x405b, 7);
    mem.write8((regs.iy + 0x0e) & 0xffff, regs.a); m.step(0x405e, 19);
    regs.hl = (regs.hl + 1) & 0xffff;              m.step(0x405f, 6);
    mem.write8((regs.iy + 0x0c) & 0xffff, regs.l); m.step(0x4062, 19);
    mem.write8((regs.iy + 0x0d) & 0xffff, regs.h); m.step(0x4065, 19);
    m.ret(); return; // 4065  ret
  }
}
