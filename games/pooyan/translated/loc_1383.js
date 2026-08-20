// SPDX-License-Identifier: GPL-3.0-only

// loc_1383  (ROM 0x1383-0x1388) -- B-range guard: if B >= 0x20 return; otherwise tail jp to the
// 0x13bc handler (untranslated boundary). Code-level; MAME grounding pending.
export function loc_1383(m) {
  const { regs } = m;

  regs.a = regs.b;  m.step(0x1384, 4); // 1383  ld a,b
  regs.cp(0x20);    m.step(0x1386, 7); // 1384  cp 0x20
  if (regs.fNC) { m.ret(11); return; } // 1386  ret nc (B >= 0x20)
  m.step(0x1387, 5);
  m.step(0x13bc, 12); return m.call(0x13bc); // 1387  jr 0x13bc (tail; boundary)
}
