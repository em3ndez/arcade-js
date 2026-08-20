// SPDX-License-Identifier: GPL-3.0-only

// loc_159b  (ROM 0x159b-0x15a0) -- tick the BCD counter (loc_7912), then load HL=0x15d1 (the return
// the dispatched state handler will ret to) and FALL THROUGH into loc_15a1, which reads the state
// index and rst 0x28-dispatches. The fall-through is a tail delegate: loc_15a1's dispatch returns to
// loc_159b's caller chain, never back here.
export function loc_159b(m) {
  const { regs } = m;

  m.push16(0x159e);
  m.step(0x7912, 17); // 159b  call 0x7912 (pattern A: rets to 0x159e)
  m.call(0x7912);

  regs.hl = 0x15d1;
  m.step(0x15a1, 10); // 159e  ld hl,0x15d1 -- handler return address
  return m.call(0x15a1); // 15a1  fall through into loc_15a1 (delegate)
}
