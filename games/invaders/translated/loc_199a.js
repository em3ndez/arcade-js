// SPDX-License-Identifier: GPL-3.0-only
// loc_199a  (ROM 0x199a-0x19bd) -- if the 0x201e flag is zero, read port 1 and on the exact 0x72 code bump
// the flag (else return). Then fall into loc_19ac: re-read port 1 and on the 0x34 code tail-jump to loc_08f3.
export function loc_199a(m) {
  const { regs, mem, io } = m;

  regs.a = mem.read8(0x201e); m.step(0x199d, 13); // 199a  lda 0x201e
  regs.and(regs.a); m.step(0x199e, 4);            // 199d  ana a
  if (regs.fZ) {
    m.step(0x19a1, 10);
    regs.a = io.portIn(0x01); m.step(0x19a3, 10); // 19a1  in 0x01
    regs.and(0x76); m.step(0x19a5, 7);            // 19a3  ani 0x76
    regs.sub(0x72); m.step(0x19a7, 7);            // 19a5  sui 0x72
    if (regs.fNZ) { return m.ret(11); }           // 19a7  rnz (taken)
    m.step(0x19a8, 5);
    regs.a = regs.inc8(regs.a); m.step(0x19a9, 5);      // 19a8  inr a
    mem.write8(0x201e, regs.a); m.step(0x19ac, 13);     // 19a9  sta 0x201e
  } else {
    m.step(0x19ac, 10);                           // 199e  jnz 0x19ac (taken)
  }
  regs.a = io.portIn(0x01); m.step(0x19ae, 10);   // 19ac  in 0x01
  regs.and(0x76); m.step(0x19b0, 7);              // 19ae  ani 0x76
  regs.cp(0x34); m.step(0x19b2, 7);               // 19b0  cpi 0x34
  if (regs.fNZ) { return m.ret(11); }             // 19b2  rnz (taken)
  m.step(0x19b3, 5);
  regs.hl = 0x2e1b; m.step(0x19b6, 10);           // 19b3  lxi h,0x2e1b
  regs.de = 0x0bf7; m.step(0x19b9, 10);           // 19b6  lxi d,0x0bf7
  regs.c = 0x09; m.step(0x19bb, 7);               // 19b9  mvi c,0x09
  m.step(0x08f3, 10); return m.call(0x08f3);      // 19bb  jmp 0x08f3
}
