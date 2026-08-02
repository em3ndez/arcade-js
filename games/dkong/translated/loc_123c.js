// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_123c  (ROM 0x123C–0x127B) — 0x0748 table entry 2, game state 1.
 *
 *   123c  df           rst  0x18
 *   123d  3a 27 62     ld   a,(0x6227)
 *   1240  fe 03        cp   0x03
 *   1242  01 16 e0     ld   bc,0xe016
 *   1245  ca 4b 12     jp   z,0x124b
 *   1248  01 3f f0     ld   bc,0xf03f
 *   124b  dd 21 00 62  ld   ix,0x6200     ; loc_124b, the jp z target
 *   124f  21 4c 69     ld   hl,0x694c
 *   1252  dd 36 00 01  ld   (ix+0x00),0x01
 *   1256  dd 71 03     ld   (ix+0x03),c
 *   1259  71           ld   (hl),c
 *   125a  2c           inc  l
 *   125b  dd 36 07 80  ld   (ix+0x07),0x80
 *   125f  36 80        ld   (hl),0x80
 *   1261  2c           inc  l
 *   1262  dd 36 08 02  ld   (ix+0x08),0x02
 *   1266  36 02        ld   (hl),0x02
 *   1268  2c           inc  l
 *   1269  dd 70 05     ld   (ix+0x05),b
 *   126c  70           ld   (hl),b
 *   126d  dd 36 0f 01  ld   (ix+0x0f),0x01
 *   1271  21 0a 60     ld   hl,0x600a
 *   1274  34           inc  (hl)
 *   1275  11 01 06     ld   de,0x0601
 *   1278  cd 9f 30     call 0x309f
 *   127b  c9           ret
 *
 * FIRST SUB-STATE OF GAME STATE 1, reached from the 0x0748 table at index 2.
 * It seeds a sprite record at IX = 0x6200 and a mirror at HL = 0x694C, then
 * advances the sub-state counter (0x600A) and enqueues task (D=0x06, E=0x01).
 *
 * `rst 0x18` AT 0x123C CAN SKIP THE WHOLE HANDLER. sub_0018 decrements the
 * counter at 0x6009 and, while it is still counting down, returns to THIS
 * handler's caller rather than to 0x123D -- so the body runs only on the frame
 * the counter expires. Modelled as an early return, its `false` result.
 *
 * BC IS SET TO ONE OF TWO CONSTANTS BY (0x6227), then B and C are stored into
 * DIFFERENT fields: C to (ix+0x03) and the mirror, B to (ix+0x05) and its
 * mirror. So the two halves of BC carry two independent field values, and
 * naming the register by either field names it wrong for the other. 0xE016 vs
 * 0xF03F is a full BC swap on the (0x6227)==3 branch.
 *
 * THE IX WRITES ARE PAIRED WITH HL MIRROR WRITES and the offsets are not
 * contiguous -- +00,+03,+07,+08,+05,+0F on IX against a walking `inc l` on HL.
 * The order is load-bearing for the write trace exactly as in sub_11fa; left
 * in ROM order.
 *
 * `ld (ix+d),r` (dd 70/71) is the register-source indexed store, 19 T --
 * confirmed against mame0288 z80.lst, identical microcode to `ld (ix+d),a`.
 * The immediate form `ld (ix+d),n` (dd 36) is also 19 T, already precedented.
 */
export function loc_123c(m) {
  const { regs, mem } = m;

  m.push16(0x123d);
  m.step(0x0018, 11); // rst 0x18
  if (!m.call(0x0018)) return; // counter still ticking -- skipped this frame

  regs.a = mem.read8(0x6227);
  m.step(0x1240, 13); // ld a,(0x6227)
  regs.cp(0x03);
  m.step(0x1242, 7); // cp 0x03
  regs.bc = 0xe016;
  m.step(0x1245, 10); // ld bc,0xe016
  if (regs.fZ) {
    m.step(0x124b, 10); // jp z,0x124b taken
  } else {
    m.step(0x1248, 10); // jp z not taken
    regs.bc = 0xf03f;
    m.step(0x124b, 10); // ld bc,0xf03f
  }

  regs.ix = 0x6200;
  m.step(0x124f, 14); // ld ix,0x6200
  regs.hl = 0x694c;
  m.step(0x1252, 10); // ld hl,0x694c

  mem.write8((regs.ix + 0x00) & 0xffff, 0x01);
  m.step(0x1256, 19); // ld (ix+0x00),0x01
  mem.write8((regs.ix + 0x03) & 0xffff, regs.c);
  m.step(0x1259, 19); // ld (ix+0x03),c
  mem.write8(regs.hl, regs.c);
  m.step(0x125a, 7); // ld (hl),c
  regs.l = regs.inc8(regs.l);
  m.step(0x125b, 4); // inc l

  mem.write8((regs.ix + 0x07) & 0xffff, 0x80);
  m.step(0x125f, 19); // ld (ix+0x07),0x80
  mem.write8(regs.hl, 0x80);
  m.step(0x1261, 10); // ld (hl),0x80
  regs.l = regs.inc8(regs.l);
  m.step(0x1262, 4); // inc l

  mem.write8((regs.ix + 0x08) & 0xffff, 0x02);
  m.step(0x1266, 19); // ld (ix+0x08),0x02
  mem.write8(regs.hl, 0x02);
  m.step(0x1268, 10); // ld (hl),0x02
  regs.l = regs.inc8(regs.l);
  m.step(0x1269, 4); // inc l

  mem.write8((regs.ix + 0x05) & 0xffff, regs.b);
  m.step(0x126c, 19); // ld (ix+0x05),b
  mem.write8(regs.hl, regs.b);
  m.step(0x126d, 7); // ld (hl),b
  mem.write8((regs.ix + 0x0f) & 0xffff, 0x01);
  m.step(0x1271, 19); // ld (ix+0x0f),0x01

  regs.hl = 0x600a;
  m.step(0x1274, 10); // ld hl,0x600a
  mem.write8(regs.hl, regs.inc8(mem.read8(regs.hl)), 8); // inc (hl)
  m.step(0x1275, 11);
  regs.de = 0x0601;
  m.step(0x1278, 10); // ld de,0x0601

  m.push16(0x127b);
  m.step(0x309f, 17); // call 0x309f -- enqueue task (D=0x06, E=0x01)
  m.call(0x309f);

  m.ret(); // 127b
}
