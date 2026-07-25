// SPDX-License-Identifier: GPL-3.0-only

/**
 * sub_13c9  (ROM 0x13c9-0x13db) — the per-frame gate at the head of the main
 * player/state dispatcher. Reads the countdown timer at 0x807c: while it is
 * non-zero, decrement it and (unless it just reached zero) return early; the
 * frame the timer expires it vectors on the mode byte at 0x807d
 * (0 -> 0x0278, else 0x02fd). When the timer is already zero it drops into the
 * real dispatch body at loc_13de.
 *
 * This is only the ENTRY block: every path leaves via `ret` or a jump-out, so
 * loc_13de, 0x0278 and 0x02fd are their own translated routines reached as
 * tail-jumps (`return m.call(target)`, whose own `ret` returns to OUR caller).
 *
 *   13c9  3a 7c 80     ld   a,(0x807c)
 *   13cc  a7           and  a
 *   13cd  28 0f        jr   z,0x13de
 *   13cf  3d           dec  a
 *   13d0  32 7c 80     ld   (0x807c),a
 *   13d3  c0           ret  nz
 *   13d4  3a 7d 80     ld   a,(0x807d)
 *   13d7  a7           and  a
 *   13d8  ca 78 02     jp   z,0x0278
 *   13db  c3 fd 02     jp   0x02fd
 */
export function sub_13c9(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x807c);
  m.step(0x13cc, 13); // ld a,(0x807c)
  regs.and(regs.a);
  m.step(0x13cd, 4); // and a -- test the timer, clear carry
  if (regs.fZ) {
    m.step(0x13de, 12); // jr z taken -- timer already zero, run the dispatcher
    return m.call(0x13de);
  }
  m.step(0x13cf, 7); // jr z not taken

  regs.a = regs.dec8(regs.a);
  m.step(0x13d0, 4); // dec a
  mem.write8(0x807c, regs.a);
  m.step(0x13d3, 13); // ld (0x807c),a
  if (regs.fNZ) {
    m.ret(11); // ret nz taken -- timer still running, wait another frame
    return;
  }
  m.step(0x13d4, 5); // ret nz not taken -- timer just expired

  regs.a = mem.read8(0x807d);
  m.step(0x13d7, 13); // ld a,(0x807d)
  regs.and(regs.a);
  m.step(0x13d8, 4); // and a -- test the mode byte
  if (regs.fZ) {
    m.step(0x0278, 10); // jp z taken
    return m.call(0x0278);
  }
  m.step(0x13db, 10); // jp z not taken

  m.step(0x02fd, 10); // jp 0x02fd
  return m.call(0x02fd);
}
