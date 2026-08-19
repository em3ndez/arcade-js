// SPDX-License-Identifier: GPL-3.0-only

// loc_7059  (ROM 0x7059-0x705e) -- (0x8f47) tick helper called by phase 5: decrement (0x8f47) (HL
// points at it on entry) and queue sound command 0x0315 (rst 0x38), then return.
export function loc_7059(m) {
  const { regs, mem } = m;

  regs.decMem8(mem, regs.hl);
  m.step(0x705a, 11); // 7059  dec (hl)
  regs.de = 0x0315;
  m.step(0x705d, 10); // 705a  ld de,0x0315
  m.push16(0x705e);
  m.step(0x0038, 11); // 705d  rst 0x38 -- queue sound 0x0315
  m.call(0x0038);
  m.ret(); // 705e  ret
}
