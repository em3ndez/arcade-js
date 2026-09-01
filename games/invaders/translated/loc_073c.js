// SPDX-License-Identifier: GPL-3.0-only
// loc_073c  (ROM 0x073c-0x0741) -- calls the 0x0742 sprite helper, then tail-jumps into loc_1439.
// Called from loc_0682's object handler and re-entered from loc_074b's tail.
export function loc_073c(m) {
  m.push16(0x073f); m.step(0x0742, 17); m.call(0x0742); // 073c call 0x0742
  m.step(0x1439, 10); return m.call(0x1439);            // 073f jmp 0x1439
}
