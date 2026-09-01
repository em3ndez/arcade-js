// SPDX-License-Identifier: GPL-3.0-only
// loc_19e6  (ROM 0x19e6-0x19f9) -- seeds HL:=0x2701. If entered with Z set, skip straight to
// loc_19fa. Otherwise run the A-counted loop at loc_19ec (each pass fills a 16-row block via
// loc_1439), then fall through into loc_19fa. Both exits delegate to loc_19fa (a head).
export function loc_19e6(m) {
  const { regs } = m;

  regs.hl = 0x2701; m.step(0x19e9, 10); // 19e6  lxi h,0x2701
  if (regs.fZ) {                        // 19e9  jz 0x19fa (taken)
    m.step(0x19fa, 10); return m.call(0x19fa);
  }
  m.step(0x19ec, 10);                   // 19e9  jz 0x19fa (not taken)
  for (;;) {
    regs.de = 0x1c60; m.step(0x19ef, 10);              // 19ec  lxi d,0x1c60
    regs.b = 0x10; m.step(0x19f1, 7);                  // 19ef  mvi b,0x10
    regs.c = regs.a; m.step(0x19f2, 5);               // 19f1  mov c,a
    m.push16(0x19f5); m.step(0x1439, 17); m.call(0x1439); // 19f2  call 0x1439
    regs.a = regs.c; m.step(0x19f6, 5);               // 19f5  mov a,c
    regs.a = regs.dec8(regs.a); m.step(0x19f7, 5);    // 19f6  dcr a
    if (regs.fNZ) { m.step(0x19ec, 10); continue; }   // 19f7  jnz 0x19ec (taken)
    m.step(0x19fa, 10); break;                        // 19f7  jnz 0x19ec (not taken)
  }
  return m.call(0x19fa);               // 19fa  fall through into loc_19fa
}
