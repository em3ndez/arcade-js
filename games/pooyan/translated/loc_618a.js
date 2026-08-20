// SPDX-License-Identifier: GPL-3.0-only

// loc_618a  (ROM 0x618a-0x618f) -- clear (0x8d44), then SKIP-RETURN. `pop af` discards the return
// the caller's `call` pushed, so the `ret` lands one frame up (grandparent). Reached by call and by
// `jr 0x618a` (0x619d). No calls.
export function loc_618a(m) {
  const { regs, mem } = m;

  regs.xor(regs.a);            m.step(0x618b, 4);
  mem.write8(0x8d44, regs.a);  m.step(0x618e, 13);
  regs.af = m.pop16();         m.step(0x618f, 10); // discard the call's return -> ret skips a frame
  m.ret(10);
}
