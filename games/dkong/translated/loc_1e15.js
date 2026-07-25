// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_1e15  (ROM 0x1E15–0x1E24) — convergence of loc_1e00 / loc_1e08 / loc_1e10.
 *
 *   1e15  cd 9f 30     call 0x309f        ; consumes B, DE (the setters' params)
 *   1e18  2a 43 63     ld   hl,(0x6343)   ; INDIRECT: HL = word at 0x6343
 *   1e1b  7e           ld   a,(hl)        ; read byte 0
 *   1e1c  36 00        ld   (hl),0x00     ; CLEAR byte 0 (after reading into A)
 *   1e1e  2c           inc  l             ; L-only, wraps within page; sets flags
 *   1e1f  2c           inc  l
 *   1e20  2c           inc  l
 *   1e21  4e           ld   c,(hl)        ; read byte 3 into C
 *   1e22  c3 36 1e     jp   0x1e36
 *
 * Live-in B, DE (from the setters) consumed by the first call; HL reloaded here.
 * Ends in a TAIL JUMP to untranslated 0x1E36 -> NotImplemented.
 */
export function loc_1e15(m) {
  const { regs, mem } = m;

  m.push16(0x1e18); // call 0x309f pushes the return address 0x1E18
  m.step(0x309f, 17);
  m.call(0x309f); // consumes B, DE; preserves HL (push/pop)

  // INDIRECT load: HL from the WORD at 0x6343, not the literal 0x6343 (2A vs 21).
  regs.hl = mem.read16(0x6343);
  m.step(0x1e1b, 16); // ld hl,(0x6343)

  regs.a = mem.read8(regs.hl);
  m.step(0x1e1c, 7); // ld a,(hl) -- READ byte 0 first...
  mem.write8(regs.hl, 0x00);
  m.step(0x1e1e, 10); // ld (hl),0x00 -- ...THEN clear. Order-critical (S8).

  // inc l x3 -- L-only (no carry into H), and SETS flags via inc8; the last
  // one's flags escape to loc_1e36. NOT (regs.l+1)&0xff, which would drop them.
  regs.l = regs.inc8(regs.l);
  m.step(0x1e1f, 4); // inc l
  regs.l = regs.inc8(regs.l);
  m.step(0x1e20, 4); // inc l
  regs.l = regs.inc8(regs.l);
  m.step(0x1e21, 4); // inc l

  regs.c = mem.read8(regs.hl);
  m.step(0x1e22, 7); // ld c,(hl) -- byte 3

  m.step(0x1e36, 10); // jp 0x1e36 (tail jump, no push)
  return m.call(0x1e36);
}
