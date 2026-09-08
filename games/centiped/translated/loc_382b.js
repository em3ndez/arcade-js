// SPDX-License-Identifier: GPL-3.0-only
// loc_382b  (ROM 0x382b-0x382d) -- one BPL: A non-negative lands on the 0x3832 RTS, else falls into the 0x382d negate.
export function loc_382b(m) {
  const { regs } = m;
  if (regs.fPl) { m.step(0x3832, 3); return m.ret(6); }       // 382b bpl $3832 (taken: A>=0, skip negate -> RTS @3832)
  m.step(0x382d, 2); return m.call(0x382d);                   // 382b bpl $3832 (not taken: negate A)
}
