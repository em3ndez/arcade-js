// SPDX-License-Identifier: GPL-3.0-only
// loc_0707  (ROM 0x0707-0x070b) -- loads B=0xfe then tail-jumps into loc_19dc. Reached by both
// fall-through from loc_0682 (after the 0x0704 call) and by `jz 0x0707` at 0x1809.
export function loc_0707(m) {
  m.regs.b = 0xfe; m.step(0x0709, 7);        // 0707 mvi b,0xfe
  m.step(0x19dc, 10); return m.call(0x19dc); // 0709 jmp 0x19dc
}
