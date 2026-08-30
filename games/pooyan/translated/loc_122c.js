// SPDX-License-Identifier: GPL-3.0-only

// Inline word table at 0x123d-0x125e: 17 sub-state handlers selected by ((ix+0x02) & 0x1f).
// 0->0x125f 1->0x1270 2->0x3536 3->0x12af 4->0x3865 5->0x1496 6->0x3be3 7->0x3c92 8->0x14dc
// 9->0x1518 10->0x154d 11->0x3e69 12->0x3e9c 13->0x3f5c 14->0x3f72 15->0x3f7c 16->0x3fe9
const DISPATCH_TABLE_123D = "0x123d (per-object sub-state, selector (ix+0x02) & 0x1f)";

// loc_122c  (ROM 0x122c-0x123c) -- per-object state dispatcher, called per record by loc_1222
// (IX walks the object array). Guard 1: if ((ix+0)|(ix+1)) has bit0 clear (rrca -> nc) the
// record is inactive -> ret. Guard 2: state = (ix+2)&0x1f; if state >= 0x11 (cp 0x11 -> nc)
// it is out of range -> ret. Otherwise rst 0x28 -> loc_0028 reads the inline table at 0x123d
// and jp (hl)'s to table[state]. The selected handler `ret`s straight to loc_122c's caller
// (no tail pushed here). Code-level; MAME grounding pending.
export function loc_122c(m) {
  const { regs, mem } = m;

  regs.a = mem.read8((regs.ix + 0x00) & 0xffff);
  m.step(0x122f, 19); // 122c  ld a,(ix+0x00)
  regs.or(mem.read8((regs.ix + 0x01) & 0xffff));
  m.step(0x1232, 19); // 122f  or (ix+0x01)
  regs.rrca();
  m.step(0x1233, 4); // 1232  rrca -- carry = bit0 of (ix+0|ix+1)

  if (!regs.fC) { m.ret(11); return; } // 1233  ret nc -- record inactive (bit0 clear)
  m.step(0x1234, 5);

  regs.a = mem.read8((regs.ix + 0x02) & 0xffff);
  m.step(0x1237, 19); // 1234  ld a,(ix+0x02)
  regs.and(0x1f);
  m.step(0x1239, 7); // 1237  and 0x1f -- mask to sub-state
  regs.cp(0x11);
  m.step(0x123b, 7); // 1239  cp 0x11

  if (!regs.fC) { m.ret(11); return; } // 123b  ret nc -- state >= 0x11: out of range
  m.step(0x123c, 5);

  m.push16(0x123d); // 123c  rst 0x28 pushes its return = inline table base
  m.step(0x0028, 11);
  m.call(0x0028, DISPATCH_TABLE_123D);
}
