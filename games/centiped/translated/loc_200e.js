// SPDX-License-Identifier: GPL-3.0-only
// loc_200e  (ROM 0x200e-0x2015) -- calls $2872 then $2d5c with interrupts enabled, then runs on into $2015.
export function loc_200e(m) {
  const { regs, mem } = m;
  m.step(0x2011, 6); m.call(0x2872);                                            // 200e jsr $2872
  regs.cli(); m.step(0x2012, 2);                                                // 2011 cli
  m.step(0x2015, 6); m.call(0x2d5c);                                            // 2012 jsr $2d5c
  return m.call(0x2015);                                                        // fall into loc_2015
}
