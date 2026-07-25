// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_12de  (ROM 0x12DE–0x12F1) — 0x639D arm 2: advance 0x600A, re-arm the gate.
 *
 *   12de  df           rst  0x18
 *   12df  cd db 30     call 0x30db        ; entry_30db (falls through to sub_30e4)
 *   12e2  21 0a 60     ld   hl,0x600a
 *   12e5  3a 0e 60     ld   a,(0x600e)    ; player index
 *   12e8  a7           and  a
 *   12e9  ca ed 12     jp   z,0x12ed      ; player 1 -> one inc; player 2 -> two
 *   12ec  34           inc  (hl)          ; the EXTRA inc (player 2 only)
 *   12ed  34           inc  (hl)          ; ALWAYS
 *   12ee  2b           dec  hl            ; 0x600A -> 0x6009
 *   12ef  36 01        ld   (hl),0x01     ; 0x6009 = 1 -> next rst 0x18 expires now
 *   12f1  c9           ret
 */
export function loc_12de(m) {
  const { regs, mem } = m;

  m.push16(0x12df);
  m.step(0x0018, 11); // rst 0x18
  if (!m.call(0x0018)) return; // counter did not expire -- dispatch abandoned

  m.push16(0x12e2);
  m.step(0x30db, 17); // call 0x30db -- entry_30db, falls through into sub_30e4
  m.call(0x30db);

  regs.hl = 0x600a;
  m.step(0x12e5, 10); // ld hl,0x600a
  regs.a = mem.read8(0x600e); // the player index
  m.step(0x12e8, 13); // ld a,(0x600e)
  regs.and(regs.a);
  m.step(0x12e9, 4); // and a
  if (regs.fZ) {
    m.step(0x12ed, 10); // jp z,0x12ed -- player 1: only one inc
  } else {
    m.step(0x12ec, 10); // jp z NOT taken
    mem.write8(regs.hl, regs.inc8(mem.read8(regs.hl))); // the EXTRA inc (player 2)
    m.step(0x12ed, 11);
  }

  mem.write8(regs.hl, regs.inc8(mem.read8(regs.hl))); // ALWAYS executed
  m.step(0x12ee, 11); // inc (hl)
  regs.hl = (regs.hl - 1) & 0xffff; // dec hl -- 16-bit, no flags. 0x600A -> 0x6009
  m.step(0x12ef, 6);
  mem.write8(regs.hl, 0x01); // 0x6009 = 1 -> next rst 0x18 expires immediately
  m.step(0x12f1, 10);
  m.ret(10); // ret (0x12F1)
}
