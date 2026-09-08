// SPDX-License-Identifier: GPL-3.0-only
// loc_2b91  (ROM 0x2b91-0x2ba8) -- range-check ($32 & $1f) against $ef and the $14/$0c thresholds; on the
// low band reload X from $88 and DEC $d7,X; RTS.
export function loc_2b91(m) {
  const { regs, mem } = m;
  regs.a = mem.read8(0x0032); regs.setNZ(regs.a); m.step(0x2b93, 3);   // 2b91 lda $32
  regs.and(0x1f); m.step(0x2b95, 2);                                   // 2b93 and #$1f
  regs.x = mem.read8(0x00ef); regs.setNZ(regs.x); m.step(0x2b97, 3);   // 2b95 ldx $ef
  let goto2b9f = false;
  if (regs.fZ) {                                                       // 2b97 beq $2b9f (taken)
    m.step(0x2b9f, 3); goto2b9f = true;
  } else {                                                            // 2b97 beq $2b9f (not taken)
    m.step(0x2b99, 2);
    regs.cmp(0x14); m.step(0x2b9b, 2);                                 // 2b99 cmp #$14
    if (regs.fNC) { m.step(0x2ba7, 3); return m.ret(6); }              // 2b9b bcc $2ba7 -> rts
    m.step(0x2b9d, 2);                                                 // 2b9b bcc $2ba7 (not taken)
    if (regs.fC) {                                                     // 2b9d bcs $2ba3 (taken)
      m.step(0x2ba3, 3);
    } else {                                                          // 2b9d bcs $2ba3 (not taken)
      m.step(0x2b9f, 2); goto2b9f = true;
    }
  }
  if (goto2b9f) {                                                      // --- 2b9f block ---
    regs.cmp(0x0c); m.step(0x2ba1, 2);                                 // 2b9f cmp #$0c
    if (regs.fC) { m.step(0x2ba7, 3); return m.ret(6); }              // 2ba1 bcs $2ba7 -> rts
    m.step(0x2ba3, 2);                                                 // 2ba1 bcs $2ba7 (not taken)
  }
  regs.x = mem.read8(0x0088); regs.setNZ(regs.x); m.step(0x2ba5, 3);   // 2ba3 ldx $88
  const ea = (0xd7 + regs.x) & 0xff; mem.write8(ea, regs.dec8(mem.read8(ea))); m.step(0x2ba7, 6); // 2ba5 dec $d7,x
  return m.ret(6);                                                     // 2ba7 rts
}
