// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_3029 (ROM 0x3029-0x3045, The Pit) -- the publish tail of loc_2f71. Writes four screen-relative
 * bytes to the scroll/sprite block at 0x822c: (x - camerax(0x8051)), sprite frame (0x80dc), (0x80dd),
 * (y + camerax). Then TAIL-JUMPS jp 0x312d -- NO ret of its own, so loc_312d's ret returns to OUR
 * caller (modelled per the thepit tail-jump convention: step + return the tail, no trailing m.ret).
 * Work-RAM stores only. Verbatim internal-label slice of loc_2f71 (its 0x3029 label); the full
 * per-instruction trace lives in loc_2f71.
 */
export function loc_3029(m) {
  const { regs, mem } = m;

  // loc_3029: publish the four screen-relative bytes to the scroll block at 0x822c
  regs.hl = 0x822c;
  m.step(0x302c, 10); // 3029  ld hl,0x822c
  regs.a = mem.read8(0x8051);
  m.step(0x302f, 13); // 302c  ld a,(0x8051) -- hero/camera x
  regs.b = regs.a;
  m.step(0x3030, 4); // 302f  ld b,a
  regs.a = mem.read8(0x80db);
  m.step(0x3033, 13); // 3030  ld a,(0x80db)
  regs.sub(regs.b);
  m.step(0x3034, 4); // 3033  sub b -- x - camera
  mem.write8(regs.hl, regs.a);
  m.step(0x3035, 7); // 3034  ld (hl),a
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x3036, 6); // 3035  inc hl
  regs.a = mem.read8(0x80dc);
  m.step(0x3039, 13); // 3036  ld a,(0x80dc)
  mem.write8(regs.hl, regs.a);
  m.step(0x303a, 7); // 3039  ld (hl),a -- sprite frame
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x303b, 6); // 303a  inc hl
  regs.a = mem.read8(0x80dd);
  m.step(0x303e, 13); // 303b  ld a,(0x80dd)
  mem.write8(regs.hl, regs.a);
  m.step(0x303f, 7); // 303e  ld (hl),a
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x3040, 6); // 303f  inc hl
  regs.a = mem.read8(0x80de);
  m.step(0x3043, 13); // 3040  ld a,(0x80de)
  regs.add(regs.b);
  m.step(0x3044, 4); // 3043  add a,b -- y + camera
  mem.write8(regs.hl, regs.a);
  m.step(0x3045, 7); // 3044  ld (hl),a

  // 3045  jp 0x312d -- unconditional tail-jump; loc_312d's ret returns to OUR caller
  m.step(0x312d, 10);
  return m.call(0x312d);
}
