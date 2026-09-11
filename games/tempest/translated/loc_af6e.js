// SPDX-License-Identifier: GPL-3.0-only
// loc_af6e  (ROM 0xaf6e) -- the bare RTS tail of loc_af3f, exposed as a second entry (loc_af26 tail-calls here).
export function loc_af6e(m) { return m.ret(6); }
