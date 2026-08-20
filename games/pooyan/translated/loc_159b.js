// SPDX-License-Identifier: GPL-3.0-only

// loc_159b  (ROM 0x159b-0x15a0) -- tick the BCD counter (loc_7912), then load HL=0x15d1 and FALL
// THROUGH into loc_15a1, which reads the state index and rst 0x28-dispatches. HL=0x15d1 is the address
// the dispatched state handler ret's to: 0x15d1 is loc_159b's OWN post-dispatch continuation (a routine
// past the 0x15a8 jump table), which runs after the handler returns and itself ret's to the caller (the
// NMI epilogue 0x06fa that loc_066d pushed). So the dispatch is NOT a never-return tail -- control comes
// back at 0x15d1 and must continue there, or the pushed 0x06fa is left on the stack and the NMI epilogue
// pops a saved register as its return.
export function loc_159b(m) {
  const { regs } = m;

  m.push16(0x159e);
  m.step(0x7912, 17); // 159b  call 0x7912 (pattern A: rets to 0x159e)
  m.call(0x7912);

  regs.hl = 0x15d1;
  m.step(0x15a1, 10); // 159e  ld hl,0x15d1 -- the address the dispatched handler ret's to
  m.call(0x15a1); // 15a1  fall through into loc_15a1's rst-0x28 dispatch; the handler ret's to 0x15d1
  return m.call(0x15d1); // 15d1  loc_159b's post-dispatch continuation (ret's to 0x06fa)
}
