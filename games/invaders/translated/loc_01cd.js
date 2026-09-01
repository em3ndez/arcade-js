// SPDX-License-Identifier: GPL-3.0-only
// loc_01cd  (ROM 0x01cd-0x01ce) -- abort target of `jz 0x01cd` in loc_01a1. Pops the caller's
// return frame into HL (discarding it), then rets to the frame below it (a two-level unwind).
export function loc_01cd(m) {
  const { regs } = m;

  regs.hl = m.pop16(); m.step(0x01ce, 10); // 01cd  pop h
  return m.ret(10); // 01ce  ret
}
