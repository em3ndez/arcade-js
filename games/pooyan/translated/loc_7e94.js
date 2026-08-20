// SPDX-License-Identifier: GPL-3.0-only

const DISPATCH_TABLE_7EAC = "0x7eac (selector 0x8e26 -> 0:0x7eb2 1:0x7f0e 2:0x7f5d)";

// loc_7e94  (ROM 0x7e94-0x7eab) -- rst 0x28 write-anim dispatcher. Pushes 0x7fd6 (the shared epilogue
// every exit ret's into), gates on the 0x8e2a run-once latch and 0x89fc, else reads selector 0x8e26 and
// rst 0x28 -> loc_0028 reads inline table 0x7eac (states 0..2: 7eb2 7f0e 7f5d) and jp (hl)'s to it.
// The two pre-dispatch `ret`s and the handler's own ret all pop the pushed 0x7fd6; m.ret only unwinds
// the JS stack, so loc_7e94 runs loc_7fd6 explicitly after each -- else the epilogue body is skipped.
export function loc_7e94(m) {
  const { regs, mem } = m;

  regs.hl = 0x7fd6;            m.step(0x7e97, 10);
  m.push16(regs.hl);          m.step(0x7e98, 11); // push the shared epilogue return address
  regs.a = mem.read8(0x8e2a); m.step(0x7e9b, 13);
  regs.and(regs.a);           m.step(0x7e9c, 4);
  if (regs.fNZ) {             // 7e9c  ret nz -- latch already set: pop 0x7fd6, run the epilogue
    const epi = m.pop16();
    m.step(epi, 11);
    return m.call(epi);
  }
  m.step(0x7e9d, 5);          // ret nz not taken
  regs.a = mem.read8(0x89fc); m.step(0x7ea0, 13);
  regs.and(regs.a);           m.step(0x7ea1, 4);
  if (regs.fZ) {              // 7ea1  jr nz not taken -- 0x89fc==0: arm the latch, then epilogue
    m.step(0x7ea3, 7);
    regs.a = regs.inc8(regs.a); m.step(0x7ea4, 4);
    mem.write8(0x8e2a, regs.a); m.step(0x7ea7, 13);
    const epi = m.pop16();      // 7ea7  ret -- pop 0x7fd6, run the epilogue
    m.step(epi, 10);
    return m.call(epi);
  }
  m.step(0x7ea8, 12);         // jr nz,0x7ea8 taken
  regs.a = mem.read8(0x8e26); m.step(0x7eab, 13);
  m.push16(0x7eac);           m.step(0x0028, 11); // rst 0x28 pushes its return = inline table base
  m.call(0x0028, DISPATCH_TABLE_7EAC); // dispatch -> handler runs and ret's into 0x7fd6 (pops it)
  return m.call(0x7fd6);      // run the shared epilogue the handler ret'd into
}
