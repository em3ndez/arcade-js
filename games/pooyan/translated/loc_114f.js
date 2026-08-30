// SPDX-License-Identifier: GPL-3.0-only

// loc_114f  (ROM 0x114f-0x116f, spanning its jr-z target loc_1158 0x1158-0x116f) -- sub-state 5
// handler (reached from the loc_0fd5 main-loop dispatch table; dw 0x114f at 0x0fed). HL=0x8f62 is
// a countdown timer (shared with sub-state 4, loc_113c). While the timer is non-zero: decrement it
// and ret. When the timer hits zero (loc_1158): clear 9 bytes at 0x8f5b via rst 0x10 (loc_0010
// memset, A=0/B=9), call 0x0ecf, set (0x880a)=6, then compute A = (0x882b) + (0x8a3c). If that sum
// is zero, ret; otherwise tail-jump to loc_118d (a shared routine, also entered from loc_117a).
export function loc_114f(m) {
  const { regs, mem } = m;

  regs.hl = 0x8f62;
  m.step(0x1152, 10); // 114f  ld hl,0x8f62
  regs.a = mem.read8(regs.hl);
  m.step(0x1153, 7); // 1152  ld a,(hl)
  regs.and(regs.a);
  m.step(0x1154, 4); // 1153  and a

  if (!regs.fZ) {
    m.step(0x1156, 7); // 1154  jr z not taken -- timer still counting
    regs.decMem8(mem, regs.hl);
    m.step(0x1157, 11); // 1156  dec (hl)
    m.ret(); // 1157  ret
    return;
  }

  m.step(0x1158, 12); // 1154  jr z,0x1158 taken -- timer expired

  // loc_1158
  regs.xor(regs.a);
  m.step(0x1159, 4); // 1158  xor a -> A=0
  regs.l = 0x5b;
  m.step(0x115b, 7); // 1159  ld l,0x5b -- HL=0x8f5b (memset dest)
  regs.b = 0x09;
  m.step(0x115d, 7); // 115b  ld b,0x09 -- memset count

  m.push16(0x115e); // 115d  rst 0x10 pushes its return
  m.step(0x0010, 11);
  m.call(0x0010, "loc_0010 memset: fill B=9 bytes at HL=0x8f5b with A=0");

  m.push16(0x1161); // 115e  call 0x0ecf pushes its return
  m.step(0x0ecf, 17);
  m.call(0x0ecf, "loc_0ecf");

  regs.a = 0x06;
  m.step(0x1163, 7); // 1161  ld a,0x06
  mem.write8(0x880a, regs.a);
  m.step(0x1166, 13); // 1163  ld (0x880a),a
  regs.hl = 0x8a3c;
  m.step(0x1169, 10); // 1166  ld hl,0x8a3c
  regs.a = mem.read8(0x882b);
  m.step(0x116c, 13); // 1169  ld a,(0x882b)
  regs.add(mem.read8(regs.hl));
  m.step(0x116d, 7); // 116c  add a,(hl)
  regs.and(regs.a);
  m.step(0x116e, 4); // 116d  and a

  if (regs.fZ) {
    m.ret(11); // 116e  ret z taken -- sum zero
    return;
  }

  m.step(0x116f, 5); // 116e  ret z not taken
  m.step(0x118d, 12); // 116f  jr 0x118d -- tail jump into loc_118d
  return m.call(0x118d, "tail jump to loc_118d (shared with loc_117a)");
}
