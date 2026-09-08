// SPDX-License-Identifier: GPL-3.0-only
// loc_2b60  (ROM 0x2b60-0x2b79) -- reads $72 and subtracts $8D once ($EF!=0 subtracts at 2b67, else beq to
// 2b6d subtracts there); a per-path carry test branches out to loc_2b79, else JSRs the $382B fold and exits
// to loc_2b86 when the folded delta >=5, otherwise falls through to loc_2b79.
export function loc_2b60(m) {
  const { regs, mem } = m;
  regs.a = mem.read8(0x0072); regs.setNZ(regs.a); m.step(0x2b62, 3);     // 2b60 lda $72
  regs.x = mem.read8(0x00ef); regs.setNZ(regs.x); m.step(0x2b64, 3);     // 2b62 ldx $ef
  let at2b6d = false;
  if (regs.fZ) { m.step(0x2b6d, 3); at2b6d = true; }                     // 2b64 beq $2b6d (taken)
  else {
    m.step(0x2b66, 2);                                                   // 2b64 beq (not taken)
    regs.sec(); m.step(0x2b67, 2);                                       // 2b66 sec
    regs.sbc(mem.read8(0x008d)); m.step(0x2b69, 3);                      // 2b67 sbc $8d
    if (regs.fC) { m.step(0x2b79, 3); return m.call(0x2b79); }           // 2b69 bcs $2b79 (out -> loc_2b79)
    m.step(0x2b6b, 2);                                                   // 2b69 bcs (not taken)
    if (regs.fNC) { m.step(0x2b72, 3); }                                 // 2b6b bcc $2b72 (taken)
    else { m.step(0x2b6d, 2); at2b6d = true; }                          // 2b6b bcc (not taken) -> 2b6d
  }
  if (at2b6d) {
    regs.sec(); m.step(0x2b6e, 2);                                       // 2b6d sec
    regs.sbc(mem.read8(0x008d)); m.step(0x2b70, 3);                      // 2b6e sbc $8d
    if (regs.fNC) { m.step(0x2b79, 3); return m.call(0x2b79); }          // 2b70 bcc $2b79 (out -> loc_2b79)
    m.step(0x2b72, 2);                                                   // 2b70 bcc (not taken) -> 2b72
  }
  m.step(0x2b75, 6); m.call(0x382b);                                     // 2b72 jsr $382b
  regs.cmp(0x05); m.step(0x2b77, 2);                                     // 2b75 cmp #$05
  if (regs.fC) { m.step(0x2b86, 3); return m.call(0x2b86); }             // 2b77 bcs $2b86 (out)
  m.step(0x2b79, 2); return m.call(0x2b79);                              // 2b77 bcs (nt) -> fall through to loc_2b79
}
