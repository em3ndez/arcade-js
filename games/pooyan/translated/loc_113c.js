// SPDX-License-Identifier: GPL-3.0-only

// loc_113c  (ROM 0x113c-0x1148, spanning its jr-z target loc_1149 0x1149-0x114e) -- sub-state 4
// handler (reached from the loc_0fd5 main-loop dispatch table). HL := 0x8f62, a countdown timer.
// While the timer is non-zero: decrement it and enqueue display command DE=0x0315 via rst 0x38
// (loc_0038), then ret. When the timer hits zero: reload it to 0x80 and bump the sub-state
// selector (0x8f5c, via `ld l,0x5c` -> HL=0x8f5c) with `inc (hl)`, advancing to the next state.
export function loc_113c(m) {
  const { regs, mem } = m;

  regs.hl = 0x8f62;
  m.step(0x113f, 10); // 113c  ld hl,0x8f62
  regs.a = mem.read8(regs.hl);
  m.step(0x1140, 7); // 113f  ld a,(hl)
  regs.and(regs.a);
  m.step(0x1141, 4); // 1140  and a

  if (regs.fZ) {
    m.step(0x1149, 12); // 1141  jr z,0x1149 taken -- timer expired, reload + advance state
    mem.write8(regs.hl, 0x80);
    m.step(0x114b, 10); // 1149  ld (hl),0x80
    regs.l = 0x5c;
    m.step(0x114d, 7); // 114b  ld l,0x5c -- HL=0x8f5c (sub-state selector)
    regs.incMem8(mem, regs.hl);
    m.step(0x114e, 11); // 114d  inc (hl) -- advance sub-state
    m.ret(); // 114e  ret
    return;
  }

  m.step(0x1143, 7); // 1141  jr z not taken -- timer still counting
  regs.decMem8(mem, regs.hl);
  m.step(0x1144, 11); // 1143  dec (hl)
  regs.de = 0x0315;
  m.step(0x1147, 10); // 1144  ld de,0x0315

  m.push16(0x1148); // 1147  rst 0x38 pushes its return
  m.step(0x0038, 11);
  m.call(0x0038, "loc_0038 display-command enqueue (pattern A: rets to 0x1148)");

  m.ret(); // 1148  ret
}
