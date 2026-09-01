// SPDX-License-Identifier: GPL-3.0-only
// loc_0000 (ROM 0x0000-0x0005) -- 8080 reset vector: three NOPs then JMP to the init routine at 0x18d4.
// The first §3 translation (template). Cycle counts are 8080 (NOP=4, JMP=10).
export function loc_0000(m) {
  m.step(0x0001, 4);  // 0000  nop
  m.step(0x0002, 4);  // 0001  nop
  m.step(0x0003, 4);  // 0002  nop
  m.step(0x18d4, 10); // 0003  jmp 0x18d4
  return m.call(0x18d4); // unconditional tail-jump to init
}
