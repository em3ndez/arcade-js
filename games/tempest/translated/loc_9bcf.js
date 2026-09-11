// SPDX-License-Identifier: GPL-3.0-only
// loc_9bcf (ROM 0x9bcf-0x9bcf) -- a bare rts: a single 0x60 byte, a no-op leaf/dispatch stub.
export function loc_9bcf(m) {
  return m.ret(6); // rts
}
