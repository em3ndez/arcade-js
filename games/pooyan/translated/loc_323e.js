// SPDX-License-Identifier: GPL-3.0-only
//
// loc_323e  (ROM 0x323e-0x324c) -- scan 4 display-list slots (IX stepping 2): whenever a slot's tag
// byte (ix+0x01) is 0x8c, run loc_324d on it. Entered by fallthrough from loc_316e (B=4 preset) and
// by `call 0x323e` from loc_30f1. loc_324d via conditional call (pattern A).
export function loc_323e(m) {
  const { regs, mem } = m;

  for (;;) {
    regs.a = mem.read8((regs.ix + 0x01) & 0xffff); m.step(0x3241, 19); // 323e  ld a,(ix+0x01)
    regs.cp(0x8c); m.step(0x3243, 7); // 3241  cp 0x8c
    if (regs.fZ) {
      m.push16(0x3246); m.step(0x324d, 17); m.call(0x324d); // 3243  call z,0x324d
    } else {
      m.step(0x3246, 10); // 3243  call z not taken
    }
    regs.ix = (regs.ix + 1) & 0xffff; m.step(0x3248, 10); // 3246  inc ix
    regs.ix = (regs.ix + 1) & 0xffff; m.step(0x324a, 10); // 3248  inc ix
    if (regs.djnz() !== 0) { m.step(0x323e, 13); continue; } // 324a  djnz 0x323e
    m.step(0x324c, 8); break;
  }
  m.ret(); // 324c  ret
}
