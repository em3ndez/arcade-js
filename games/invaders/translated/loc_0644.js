// SPDX-License-Identifier: GPL-3.0-only
// loc_0644 (ROM 0x0644-0x0669) -- from `jnz` at 0x05cc. Decrements counter 0x2078; on ==3 re-seeds
// 0x2079/0x207b-0x207d + tail-jmps loc_066c, else tail-jmps loc_0675 (counter 0) or rets.
export function loc_0644(m) {
  const { regs, mem } = m;

  regs.hl = 0x2078; m.step(0x0647, 10);                 // 0644  lxi h,0x2078
  regs.decMem8(mem, regs.hl); m.step(0x0648, 10);       // 0647  dcr m
  regs.a = mem.read8(regs.hl); m.step(0x0649, 7);       // 0648  mov a,m
  regs.cp(0x03); m.step(0x064b, 7);                     // 0649  cpi 0x03
  if (regs.fNZ) {
    m.step(0x0667, 10);
    regs.and(regs.a); m.step(0x0668, 4);               // 0667  ana a
    if (regs.fNZ) { return m.ret(11); }
    m.step(0x0669, 5);
    m.step(0x0675, 10); return m.call(0x0675);
  }
  m.step(0x064e, 10);
  m.push16(0x0651); m.step(0x0675, 17); m.call(0x0675); // 064e  call 0x0675
  regs.hl = 0x1cdc; m.step(0x0654, 10);                 // 0651  lxi h,0x1cdc
  mem.write16(0x2079, regs.hl); m.step(0x0657, 16);     // 0654  shld 0x2079
  regs.hl = 0x207c; m.step(0x065a, 10);                 // 0657  lxi h,0x207c
  regs.decMem8(mem, regs.hl); m.step(0x065b, 10);       // 065a  dcr m
  regs.decMem8(mem, regs.hl); m.step(0x065c, 10);       // 065b  dcr m
  regs.hl = (regs.hl - 1) & 0xffff; m.step(0x065d, 5);  // 065c  dcx h
  regs.decMem8(mem, regs.hl); m.step(0x065e, 10);       // 065d  dcr m
  regs.decMem8(mem, regs.hl); m.step(0x065f, 10);       // 065e  dcr m
  regs.a = 0x06; m.step(0x0661, 7);                     // 065f  mvi a,0x06
  mem.write8(0x207d, regs.a); m.step(0x0664, 13);       // 0661  sta 0x207d
  m.step(0x066c, 10); return m.call(0x066c);            // 0664  jmp 0x066c (delegate)
}
