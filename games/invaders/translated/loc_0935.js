// SPDX-License-Identifier: GPL-3.0-only
// loc_0935  (ROM 0x0935-0x097b) -- `call 0x0935` from the frame loop (loc_081f): fetch object record via
// 0x1910, bail if state byte (HL-2)==0; pick limit B from port 2 bit3; if counter (HL+1)<B bump it (0x092e), fan a 4-step draw over 0x2501+, redraw (0x1439), clear record, tail-jmp loc_18fa.
export function loc_0935(m) {
  const { regs, mem } = m;

  m.push16(0x0938); m.step(0x1910, 17); m.call(0x1910); // 0935  call 0x1910
  regs.hl = (regs.hl - 1) & 0xffff; m.step(0x0939, 5); // 0938  dcx h
  regs.hl = (regs.hl - 1) & 0xffff; m.step(0x093a, 5);
  regs.a = mem.read8(regs.hl); m.step(0x093b, 7);
  regs.and(regs.a); m.step(0x093c, 4); // 093b  ana a
  if (regs.fZ) { return m.ret(11); } m.step(0x093d, 5); // 093c  rz
  regs.b = 0x15; m.step(0x093f, 7); // 093d  mvi b,0x15
  regs.a = m.io.portIn(0x02); m.step(0x0941, 10); // 093f  in 0x02
  regs.and(0x08); m.step(0x0943, 7); // 0941  ani 0x08
  if (regs.fZ) {
    m.step(0x0948, 10);
  } else {
    m.step(0x0946, 10);
    regs.b = 0x10; m.step(0x0948, 7); // 0946  mvi b,0x10
  }
  m.push16(0x094b); m.step(0x09ca, 17); m.call(0x09ca); // 0948  call 0x09ca
  regs.hl = (regs.hl + 1) & 0xffff; m.step(0x094c, 5);
  regs.a = mem.read8(regs.hl); m.step(0x094d, 7);
  regs.cp(regs.b); m.step(0x094e, 4); // 094d  cmp b
  if (regs.fC) { return m.ret(11); } m.step(0x094f, 5); // 094e  rc
  m.push16(0x0952); m.step(0x092e, 17); m.call(0x092e); // 094f  call 0x092e
  regs.incMem8(mem, regs.hl); m.step(0x0953, 10); // 0952  inr m
  regs.a = mem.read8(regs.hl); m.step(0x0954, 7);
  m.push16(regs.af); m.step(0x0955, 11); // 0954  push psw
  regs.hl = 0x2501; m.step(0x0958, 10); // 0955  lxi h,0x2501
  for (;;) {
    regs.h = regs.inc8(regs.h); m.step(0x0959, 5); // 0958  inr h
    regs.h = regs.inc8(regs.h); m.step(0x095a, 5);
    regs.a = regs.dec8(regs.a); m.step(0x095b, 5);
    if (regs.fNZ) { m.step(0x0958, 10); continue; }
    m.step(0x095e, 10); break;
  }
  regs.b = 0x10; m.step(0x0960, 7); // 095e  mvi b,0x10
  regs.de = 0x1c60; m.step(0x0963, 10); // 0960  lxi d,0x1c60
  m.push16(0x0966); m.step(0x1439, 17); m.call(0x1439); // 0963  call 0x1439
  regs.af = m.pop16(); m.step(0x0967, 10); // 0966  pop psw
  regs.a = regs.inc8(regs.a); m.step(0x0968, 5);
  m.push16(0x096b); m.step(0x1a8b, 17); m.call(0x1a8b); // 0968  call 0x1a8b
  m.push16(0x096e); m.step(0x1910, 17); m.call(0x1910); // 096b  call 0x1910
  regs.hl = (regs.hl - 1) & 0xffff; m.step(0x096f, 5); // 096e  dcx h
  regs.hl = (regs.hl - 1) & 0xffff; m.step(0x0970, 5);
  mem.write8(regs.hl, 0x00); m.step(0x0972, 10); // 0970  mvi m,0x00
  regs.a = 0xff; m.step(0x0974, 7); // 0972  mvi a,0xff
  mem.write8(0x2099, regs.a); m.step(0x0977, 13); // 0974  sta 0x2099
  regs.b = 0x10; m.step(0x0979, 7); // 0977  mvi b,0x10
  m.step(0x18fa, 10); return m.call(0x18fa); // 0979  jmp 0x18fa (tail)
}
