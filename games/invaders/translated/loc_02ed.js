// SPDX-License-Identifier: GPL-3.0-only
// loc_02ed (ROM 0x02ed-0x02f7) -- jmp'd at 0x16c6. Reads flag 0x2067, saves it (push psw), and
// rotates bit0 into carry: carry set -> tail into loc_0332 (which calls 0x0209 then joins loc_02f8);
// carry clear -> call 0x020e then fall through into loc_02f8 (a routine head), delegating.
export function loc_02ed(m) {
  const { regs, mem } = m;
  regs.a = mem.read8(0x2067); m.step(0x02f0, 13);       // 02ed  lda 0x2067
  m.push16(regs.af); m.step(0x02f1, 11);                // 02f0  push psw
  regs.rrca(); m.step(0x02f2, 4);                       // 02f1  rrc
  if (regs.fC) {                                        // 02f2  jc 0x0332 (taken)
    m.step(0x0332, 10);
    return m.call(0x0332);
  }
  m.step(0x02f5, 10);                                   // 02f2  jc 0x0332 (fall through)
  m.push16(0x02f8); m.step(0x020e, 17); m.call(0x020e); // 02f5  call 0x020e
  return m.call(0x02f8);                                // 02f8  fall through into loc_02f8
}
