// SPDX-License-Identifier: GPL-3.0-only

// loc_5f6a  (ROM 0x5f6a-0x5f82) -- actor-sweep driver (ungated variant of loc_5e78). Walks the
// 0x8848 table B=2 times (stride DE=4), calling loc_5f83 per pass with the I register carrying the
// loop counter (I = B before each djnz: 0 then 2, then 1 on the reload). The exx pair parks B and
// DE in the shadow set across the call so the handler cannot clobber them. The 0x5f76 loop head is
// internal (djnz only) -- inlined here, not emitted as its own routine.
export function loc_5f6a(m) {
  const { regs, mem } = m;

  regs.iy = 0x8848;                  m.step(0x5f6e, 14);
  regs.b = 0x02;                     m.step(0x5f70, 7);
  regs.de = 0x0004;                  m.step(0x5f73, 10);
  regs.xor(regs.a);                  m.step(0x5f74, 4);
  regs.i = regs.a;                   m.step(0x5f76, 9); // I=0 for the first pass

  for (;;) { // loc_5f76: per-slot handler with B/DE parked in the shadow set
    regs.exx();                      m.step(0x5f77, 4);
    m.push16(0x5f7a);
    m.step(0x5f83, 17);              // 5f77  call 0x5f83 (per-slot handler)
    m.call(0x5f83);
    regs.exx();                      m.step(0x5f7b, 4);
    regs.addIy(regs.de);             m.step(0x5f7d, 15);
    regs.a = regs.b;                 m.step(0x5f7e, 4);
    regs.i = regs.a;                 m.step(0x5f80, 9); // I <- loop counter
    if (regs.djnz()) { m.step(0x5f76, 13); } else { m.step(0x5f82, 8); break; }
  }

  return m.ret(10); // 5f82 ret
}
