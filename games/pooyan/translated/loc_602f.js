// SPDX-License-Identifier: GPL-3.0-only

// loc_602f  (ROM 0x602f-0x6047) -- run subsystem handler 0x6048 once per slot for both slots.
// Seeds IY=0x8848, B=2, I=0, DE=4, then the B-count loop (loop top 0x603b): exx guards the main
// BC/DE/HL across the call, invokes 0x6048, exx back, advances IY by 4, and latches I to the
// remaining count before djnz. The 0x603b loop body is INLINED -- it is this routine's loop top,
// not a separate entry (no external call/table reference; reached only by fall-through + its djnz).
export function loc_602f(m) {
  const { regs } = m;

  regs.iy = 0x8848;                m.step(0x6033, 14);
  regs.b = 0x02;                   m.step(0x6035, 7);
  regs.xor(regs.a);                m.step(0x6036, 4);
  regs.i = regs.a;                 m.step(0x6038, 9); // ld i,a -- slot index 0
  regs.de = 0x0004;                m.step(0x603b, 10);

  for (;;) { // loc_603b: per-slot loop body
    regs.exx();                      m.step(0x603c, 4); // guard main BC/DE/HL across the call
    m.push16(0x603f);
    m.step(0x6048, 17);              // 603c  call 0x6048 (slot handler, pattern A -> 0x603f)
    m.call(0x6048);
    if (m.pc !== 0x603f) return;     // 0x6048 subtree hit-exit skip-returned past this loop to loc_5ae4; propagate
    regs.exx();                      m.step(0x6040, 4);
    regs.addIy(regs.de);             m.step(0x6042, 15);
    regs.a = regs.b;                 m.step(0x6043, 4);
    regs.i = regs.a;                 m.step(0x6045, 9); // ld i,a -- slot index = remaining count
    if (regs.djnz()) { m.step(0x603b, 13); continue; }
    m.step(0x6047, 8);               // djnz not taken
    break;
  }

  return m.ret(10); // 6047  ret
}
