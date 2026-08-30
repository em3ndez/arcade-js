// SPDX-License-Identifier: GPL-3.0-only

// Inline word table at 0x0fe3-0x0fee: 6 sub-state handlers selected by (0x8f5c & 7).
// state 0->0x0fef  1->0x1016  2->0x1090  3->0x10a2  4->0x113c  5->0x114f
const DISPATCH_TABLE_0FE3 = "0x0fe3 (main-loop sub-state, selector 0x8f5c & 7)";

// loc_0fd5  (ROM 0x0fd5-0x0fe2) -- main-loop sub-state dispatcher. A = (0x8f5c & 7). For states
// >= 2 it first pushes 0x1035 (the post-handler tail the selected handler `ret`s to); states 0/1
// `ret` straight to the caller. Then rst 0x28 -> loc_0028 reads the inline table at 0x0fe3 and
// jp (hl)'s to table[A]. m.ret only unwinds the JS stack, so the handler's ret pops 0x1035 without
// executing it -- run loc_1035 explicitly after the dispatch for states >= 2 (mirror loc_0899).
export function loc_0fd5(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x8f5c);
  m.step(0x0fd8, 13); // 0fd5  ld a,(0x8f5c)
  regs.and(0x07);
  m.step(0x0fda, 7); // 0fd8  and 0x07
  regs.cp(0x02);
  m.step(0x0fdc, 7); // 0fda  cp 0x02

  const hasTail = !regs.fC; // state >= 2 seats the loc_1035 tail
  if (regs.fC) {
    m.step(0x0fe2, 12); // 0fdc  jr c,0x0fe2 -- state 0/1: skip the tail push
  } else {
    m.step(0x0fde, 7); // 0fdc  jr c (not taken)
    regs.hl = 0x1035;
    m.step(0x0fe1, 10); // 0fde  ld hl,0x1035
    m.push16(regs.hl);
    m.step(0x0fe2, 11); // 0fe1  push hl -- handler tail return
  }

  m.push16(0x0fe3); // 0fe2  rst 0x28 pushes its return = inline table base
  m.step(0x0028, 11);
  m.call(0x0028, DISPATCH_TABLE_0FE3);
  if (hasTail) return m.call(0x1035); // handler ret'd to 0x1035; run the post-handler tail
}
