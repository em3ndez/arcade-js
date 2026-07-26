// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_2bd3  (ROM 0x2bd3-0x2bef, The Pit) -- composes a 4-byte record at work RAM
 * 0x8228 from the object state bytes 0x80a9..0x80ac, applying the horizontal
 * offset held at 0x8051 symmetrically to the two end bytes.
 *
 * Let b = (0x8051). Then:
 *   0x8228 = (0x80a9) - b      ; sub b   -- first coord biased DOWN by the offset
 *   0x8229 = (0x80aa)
 *   0x822a = (0x80ab)
 *   0x822b = (0x80ac) + b      ; add a,b -- last coord biased UP by the offset
 * B is loaded once from 0x8051 and reused for both the sub and the add, so a single
 * offset shifts the record's two ends in opposite directions. Then tail-jumps to
 * 0x2f71 to continue. (Role is best-effort from the code; the addresses, the sub/add
 * bias arithmetic, and the control flow are exact.)
 *
 * The final `jp 0x2f71` is a TAIL-JUMP, not a call: loc_2bd3 keeps no frame of its
 * own, so 0x2f71's own `ret` returns to loc_2bd3's caller. It is modelled as
 * `m.step(0x2f71, 10); return m.call(0x2f71)` with NO trailing m.ret -- a second ret
 * would double-pop the caller's return address.
 *
 * Exit flags are those of the final `add a,b`; the earlier `sub b` flags are dead
 * (overwritten before any branch reads them).
 *
 *   2bd3  21 28 82     ld   hl,0x8228
 *   2bd6  3a 51 80     ld   a,(0x8051)
 *   2bd9  47           ld   b,a
 *   2bda  3a a9 80     ld   a,(0x80a9)
 *   2bdd  90           sub  b
 *   2bde  77           ld   (hl),a
 *   2bdf  23           inc  hl
 *   2be0  3a aa 80     ld   a,(0x80aa)
 *   2be3  77           ld   (hl),a
 *   2be4  23           inc  hl
 *   2be5  3a ab 80     ld   a,(0x80ab)
 *   2be8  77           ld   (hl),a
 *   2be9  23           inc  hl
 *   2bea  3a ac 80     ld   a,(0x80ac)
 *   2bed  80           add  a,b
 *   2bee  77           ld   (hl),a
 *   2bef  c3 71 2f     jp   0x2f71
 */
export function loc_2bd3(m) {
  const { regs, mem } = m;

  regs.hl = 0x8228;
  m.step(0x2bd6, 10); // 2bd3  ld hl,0x8228

  regs.a = mem.read8(0x8051);
  m.step(0x2bd9, 13); // 2bd6  ld a,(0x8051)

  regs.b = regs.a;
  m.step(0x2bda, 4); // 2bd9  ld b,a

  regs.a = mem.read8(0x80a9);
  m.step(0x2bdd, 13); // 2bda  ld a,(0x80a9)

  regs.sub(regs.b);
  m.step(0x2bde, 4); // 2bdd  sub b

  mem.write8(regs.hl, regs.a);
  m.step(0x2bdf, 7); // 2bde  ld (hl),a

  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x2be0, 6); // 2bdf  inc hl

  regs.a = mem.read8(0x80aa);
  m.step(0x2be3, 13); // 2be0  ld a,(0x80aa)

  mem.write8(regs.hl, regs.a);
  m.step(0x2be4, 7); // 2be3  ld (hl),a

  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x2be5, 6); // 2be4  inc hl

  regs.a = mem.read8(0x80ab);
  m.step(0x2be8, 13); // 2be5  ld a,(0x80ab)

  mem.write8(regs.hl, regs.a);
  m.step(0x2be9, 7); // 2be8  ld (hl),a

  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x2bea, 6); // 2be9  inc hl

  regs.a = mem.read8(0x80ac);
  m.step(0x2bed, 13); // 2bea  ld a,(0x80ac)

  regs.add(regs.b);
  m.step(0x2bee, 4); // 2bed  add a,b

  mem.write8(regs.hl, regs.a);
  m.step(0x2bef, 7); // 2bee  ld (hl),a

  // 2bef  jp 0x2f71 -- tail-jump: 0x2f71's ret returns to loc_2bd3's caller.
  m.step(0x2f71, 10);
  return m.call(0x2f71);
}
