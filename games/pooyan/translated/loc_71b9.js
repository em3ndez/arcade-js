// SPDX-License-Identifier: GPL-3.0-only

const DISPATCH_TABLE_71C1 = "0x71c1 (bonus/eagle phase, selector 0x8f38): 0..2 = 71c7 72a0 7421";

// loc_71b9  (ROM 0x71b9-0x71c0) -- bonus/eagle-stage phase dispatcher. Pushes the shared epilogue
// address 0x02ef (the handler ret's into it), reads phase (0x8f38) and rst 0x28 dispatches through
// the 3-word table at 0x71c1.
export function loc_71b9(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x8f38);
  m.step(0x71bc, 13); // 71b9  ld a,(0x8f38)
  regs.hl = 0x02ef;
  m.step(0x71bf, 10); // 71bc  ld hl,0x02ef
  m.push16(regs.hl);
  m.step(0x71c0, 11); // 71bf  push hl -- handler return address
  m.push16(0x71c1);
  m.step(0x0028, 11); // 71c0  rst 0x28 -- pushes inline table base 0x71c1
  m.call(0x0028, DISPATCH_TABLE_71C1);
  return m.call(0x02ef); // handler ret's to 0x02ef (pushed above); run it -- its ret returns to loc_71b9's caller
}
