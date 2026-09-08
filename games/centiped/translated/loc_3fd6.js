// SPDX-License-Identifier: GPL-3.0-only
// loc_3fd6  (ROM 0x3fd6-0x3fd9) -- a JMP $3d57 trampoline: unconditional tail-jump to loc_3d57.
export function loc_3fd6(m) {
  m.step(0x3d57, 3); return m.call(0x3d57); // 3fd6 jmp $3d57
}
