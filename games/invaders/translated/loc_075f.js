// SPDX-License-Identifier: GPL-3.0-only
// loc_075f  (ROM 0x075f-0x0764) -- seats DE at table 0x1b83, then tail-jumps into loc_1a32.
// Called from loc_0682 (0x0704) with B and HL preset by the caller.
export function loc_075f(m) {
  m.regs.de = 0x1b83; m.step(0x0762, 10);    // 075f lxi d,0x1b83
  m.step(0x1a32, 10); return m.call(0x1a32); // 0762 jmp 0x1a32
}
