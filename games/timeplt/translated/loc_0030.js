// SPDX-License-Identifier: GPL-3.0-only

// loc_0030  (ROM 0x0030-0x0033) — RST 0x30: THE INLINE JUMP-TABLE DISPATCH.
export function loc_0030(m, label) {
  const { regs, mem } = m;

  const tableBase = m.pop16();
  regs.hl = tableBase;
  m.step(0x0031, 10); // pop hl

  m.push16(0x0032);
  m.step(0x0010, 11); // rst 0x10
  m.call(0x0010);

  const target = regs.de;
  regs.de = regs.hl;
  regs.hl = target;
  m.step(0x0033, 4); // ex de,hl

  m.step(target, 4); // jp (hl)
  return m.call(target);
}
