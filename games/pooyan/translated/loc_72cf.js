// SPDX-License-Identifier: GPL-3.0-only

const DISPATCH_TABLE_72DB = "0x72db (eagle-record state, selector (ix+2)): 0..2 = 733c 7395 73ce";

// loc_72cf  (ROM 0x72cf-0x72da) -- per eagle-record dispatch. If the record is inactive (low bit of
// (ix+0)|(ix+1) clear) it returns; otherwise rst 0x28 tail-dispatches on the record state (ix+2)
// through the 3-word table at 0x72db.
export function loc_72cf(m) {
  const { regs, mem } = m;

  regs.a = mem.read8((regs.ix + 0x00) & 0xffff);
  m.step(0x72d2, 19); // 72cf  ld a,(ix+0x00)
  regs.or(mem.read8((regs.ix + 0x01) & 0xffff));
  m.step(0x72d5, 19); // 72d2  or (ix+0x01)
  regs.rrca();
  m.step(0x72d6, 4); // 72d5  rrca
  if (regs.fNC) { m.ret(11); return; } // 72d6  ret nc -- record inactive
  m.step(0x72d7, 5);
  regs.a = mem.read8((regs.ix + 0x02) & 0xffff);
  m.step(0x72da, 19); // 72d7  ld a,(ix+0x02)
  m.push16(0x72db);
  m.step(0x0028, 11); // 72da  rst 0x28 -- pushes inline table base 0x72db
  return m.call(0x0028, DISPATCH_TABLE_72DB);
}
