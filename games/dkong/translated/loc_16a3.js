// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_16a3  (ROM 0x16A3–0x16BA) — board load: spawn (0x1708), copy 0x385C, rst 0x38, advance 0x6388.
 */
export function loc_16a3(m) {
  const { regs, mem } = m;
  m.push16(0x16a6); m.step(0x1708, 17); m.call(0x1708); // call 0x1708
  regs.a = mem.read8(0x6910);
  m.step(0x16a9, 13);
  regs.sub(0x3b);
  m.step(0x16ab, 7);
  regs.hl = 0x385c;
  m.step(0x16ae, 10);
  m.push16(0x16b1); m.step(0x004e, 17); m.call(0x004e); // call 0x004e
  regs.hl = 0x6908;
  m.step(0x16b4, 10);
  regs.c = regs.a;
  m.step(0x16b5, 4); // ld c,a
  m.push16(0x16b6); m.step(0x0038, 11); m.call(0x0038); // rst 0x38
  regs.hl = 0x6388;
  m.step(0x16b9, 10);
  regs.incMem8(mem, regs.hl);
  m.step(0x16ba, 11); // inc (0x6388)
  m.ret(10);
}
