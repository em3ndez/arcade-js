// SPDX-License-Identifier: GPL-3.0-only

// loc_315b  (ROM 0x315B-0x315D, Time Pilot)
export function loc_315b(m) {
  m.step(0x3176, 10); // jp 0x3176 -- TAIL transfer into the 0x3176 data table
  return m.call(0x3176);
}
