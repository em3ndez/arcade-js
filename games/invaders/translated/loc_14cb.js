// SPDX-License-Identifier: GPL-3.0-only
// loc_14cb  (ROM 0x14cb) -- clear-a-column entry: zero A, then fall through into loc_14cc (its own
// head, also reached by `jmp 0x14cc` at 0x01d6 with A pre-set). Delegate rather than inline.
export function loc_14cb(m) {
  const { regs } = m;

  regs.xor(regs.a); m.step(0x14cc, 4); // 14cb  xra a
  return m.call(0x14cc); // fall through into loc_14cc
}
