// SPDX-License-Identifier: GPL-3.0-only
// loc_19fa  (ROM 0x19fa-0x1a05) -- repeatedly calls loc_14cb with B:=0x10 until H reaches 0x35
// (walks a 16-entry-per-pass structure to a terminator row), then returns.
export function loc_19fa(m) {
  const { regs } = m;
  for (;;) {
    regs.b = 0x10; m.step(0x19fc, 7);                     // 19fa  mvi b,0x10
    m.push16(0x19ff); m.step(0x14cb, 17); m.call(0x14cb); // 19fc  call 0x14cb
    regs.a = regs.h; m.step(0x1a00, 5);                   // 19ff  mov a,h
    regs.cp(0x35); m.step(0x1a02, 7);                     // 1a00  cpi 0x35
    if (regs.fNZ) { m.step(0x19fa, 10); continue; }       // 1a02  jnz 0x19fa (taken)
    m.step(0x1a05, 10); break;                            // 1a02  jnz 0x19fa (not taken)
  }
  return m.ret(10);                                       // 1a05  ret
}
