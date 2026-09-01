// SPDX-License-Identifier: GPL-3.0-only
// loc_17c0  (ROM 0x17c0-0x17cc, interior loc_17ca) -- called from 0x1639/0x1648. Reads flag
// 0x2067; bit0 (via rrc->carry) selects the input port: set -> IN 1, clear -> IN 2. Returns A.
export function loc_17c0(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x2067); m.step(0x17c3, 13); // 17c0  lda 0x2067
  regs.rrca(); m.step(0x17c4, 4); // 17c3  rrc
  if (regs.fNC) { // 17c4  jnc 0x17ca
    m.step(0x17ca, 10);
    regs.a = m.io.portIn(0x02); m.step(0x17cc, 10); // 17ca  in 0x02
    return m.ret(10); // 17cc  ret
  }
  m.step(0x17c7, 10);
  regs.a = m.io.portIn(0x01); m.step(0x17c9, 10); // 17c7  in 0x01
  return m.ret(10); // 17c9  ret
}
