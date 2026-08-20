// SPDX-License-Identifier: GPL-3.0-only

const DISPATCH_TABLE_08A1 = "0x08a1 (attract sub-state, selector 0x8e51)";

// loc_0899  (ROM 0x0899-0x08a0) -- push 0x0bb5, read selector 0x8e51, rst 0x28 -> loc_0028 reads
// table 0x08a1 (states 0..6: 08b3 08e9 092c 0986 099c 0ac8 0b32) and jp (hl)'s to the handler.
// Each handler ret's to 0x0bb5 (the shared epilogue loc_0bb5), which ret's to the caller's seated
// return (0x06fa in the NMI). m.ret only unwinds the JS stack, so loc_0899 must run loc_0bb5 after
// the dispatch -- else loc_0bb5's body is skipped and its ret leaks 2 bytes/NMI.
export function loc_0899(m) {
  const { regs, mem } = m;

  regs.hl = 0x0bb5;
  m.step(0x089c, 10);
  m.push16(regs.hl); // 089c  push hl -- handler return address
  m.step(0x089d, 11);
  regs.a = mem.read8(0x8e51);
  m.step(0x08a0, 13);

  m.push16(0x08a1); // 08a0  rst 0x28 pushes its return = table base
  m.step(0x0028, 11);
  m.call(0x0028, DISPATCH_TABLE_08A1); // dispatch -> handler runs, ret's to 0x0bb5 (pops it)
  return m.call(0x0bb5); // 0bb5  the shared handler epilogue the handler ret'd into
}
