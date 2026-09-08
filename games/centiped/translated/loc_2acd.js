// SPDX-License-Identifier: GPL-3.0-only
// loc_2acd  (ROM 0x2acd) -- the bare RTS tail of loc_2ac7, exposed as a second entry: loc_2a92 tail-calls here.
export function loc_2acd(m) { return m.ret(6); } // 2acd rts (bare-RTS entry; loc_2a92 tail-calls here)
