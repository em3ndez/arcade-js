// SPDX-License-Identifier: GPL-3.0-only
// loc_0248 (ROM 0x0248) -- CALLed at 0x007b. Seats HL at the object/timer table base 0x2010,
// then falls through into loc_024b (its own entry; also CALLed at 0x00a8 and jmp'd at 0x0285/0x0aae),
// so it delegates rather than inlining across the boundary.
export function loc_0248(m) {
  const { regs } = m;
  regs.hl = 0x2010; m.step(0x024b, 10); // 0248  lxi h,0x2010
  return m.call(0x024b);                // 024b  fall through into loc_024b (its own entry)
}
