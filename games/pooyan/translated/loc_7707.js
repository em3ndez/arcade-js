// SPDX-License-Identifier: GPL-3.0-only

const DISPATCH_TABLE_7715 = "0x7715 (object state, selector (ix+2)&3): 0=771d 1=7740 2=7790 3=7881";

// loc_7707  (ROM 0x7707-0x7714) -- per-object state machine, called by loc_76f4 with IX = record.
// If the record is inactive (bit0 of (ix+0)|(ix+1) clear) it returns immediately; otherwise it
// selects (ix+2)&3 and rst 0x28-dispatches through the inline word table at 0x7715 to handlers
// 0x771d/0x7740/0x7790/0x7881. No handler-return is pre-pushed, so a handler `ret`s to loc_7707's
// own caller (loc_76f4's in-loop return).
export function loc_7707(m) {
  const { regs, mem } = m;

  regs.a = mem.read8((regs.ix + 0x00) & 0xffff);
  m.step(0x770a, 19); // 7707  ld a,(ix+0)
  regs.or(mem.read8((regs.ix + 0x01) & 0xffff));
  m.step(0x770d, 19); // 770a  or (ix+1)
  regs.rrca();
  m.step(0x770e, 4); // 770d  rrca -- bit0 -> carry
  if (regs.fNC) { m.ret(11); return; } // 770e  ret nc -- inactive record
  m.step(0x770f, 5);

  regs.a = mem.read8((regs.ix + 0x02) & 0xffff);
  m.step(0x7712, 19); // 770f  ld a,(ix+2) -- state byte
  regs.and(0x03);
  m.step(0x7714, 7); // 7712  and 0x03

  m.push16(0x7715); // 7714  rst 0x28 pushes the inline table base
  m.step(0x0028, 11);
  m.call(0x0028, DISPATCH_TABLE_7715);
}
