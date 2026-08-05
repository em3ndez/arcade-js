// SPDX-License-Identifier: GPL-3.0-only

// loc_4194  (ROM 0x4194-0x41B7, Time Pilot)
export function loc_4194(m) {
  const { regs, mem } = m;

  regs.a = mem.read8((regs.ix + 0x04) & 0xffff);
  m.step(0x4197, 19); // ld a,(ix+0x04) -- the delay counter

  regs.and(regs.a);
  m.step(0x4198, 4); // and a

  if (regs.fZ) {
    m.step(0x41a4, 10); // jp z,0x41a4 taken -- the counter has expired

    m.push16(regs.bc);
    m.step(0x41a5, 11); // push bc

    m.push16(0x41a8);
    m.step(0x58b6, 17); // call 0x58b6
    m.call(0x58b6);

    m.push16(0x41ab);
    m.step(0x41f1, 17); // call 0x41f1
    m.call(0x41f1);

    m.push16(0x41ae);
    m.step(0x2b83, 17); // call 0x2b83 -- answers in carry
    m.call(0x2b83);

    regs.bc = m.pop16(); // pop bc -- no flags, so 0x2B83's carry survives
    m.step(0x41af, 10);

    if (regs.fNC) {
      m.step(0x410b, 10); // jp nc,0x410b taken -- TAIL
      return m.call(0x410b);
    }
    m.step(0x41b2, 10); // jp nc not taken

    m.push16(0x41b5);
    m.step(0x40ab, 17); // call 0x40ab
    m.call(0x40ab);

    m.step(0x410b, 10); // jp 0x410b -- TAIL
    return m.call(0x410b);
  }
  m.step(0x419b, 10); // jp z not taken (jp costs 10 either way)

  regs.decMem8(mem, (regs.ix + 0x04) & 0xffff);
  m.step(0x419e, 23); // dec (ix+0x04)

  m.push16(0x41a1);
  m.step(0x41b8, 17); // call 0x41b8
  m.call(0x41b8);

  m.step(0x410b, 10); // jp 0x410b -- TAIL
  return m.call(0x410b);
}
