// SPDX-License-Identifier: GPL-3.0-only
// loc_2ec5  (ROM 0x2ec5-0x2ec6) -- lone RTS; the shared no-op return landing for the loc_2e0b steer paths.
export function loc_2ec5(m) {
  return m.ret(6);                                                   // 2ec5 rts
}
