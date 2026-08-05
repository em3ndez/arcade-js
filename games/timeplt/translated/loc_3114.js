// SPDX-License-Identifier: GPL-3.0-only

// loc_3114  (ROM 0x3114-0x3116, Time Pilot)
export function loc_3114(m) {
  m.step(0x307f, 10); // jp 0x307f -- TAIL transfer to 0x307F
  return m.call(0x307f);
}
