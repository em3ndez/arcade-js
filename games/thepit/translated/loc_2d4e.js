// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_2d4e  (ROM 0x2d4e-0x2d6a, The Pit) -- the "matched tile" arm of the object
 * scanner that ends at 0x2d4b. It is entered (via `jr z` from 0x2d43/0x2d47, or by
 * fall-through when the 0x2d49 `cp 0x41` matches) once the tilemap cell under the
 * display pointer IX (loaded from 0x80af, an address inside video RAM 0x9000+) holds
 * one of the tile codes 0x2a / 0x2b / 0x41. On that hit it:
 *   - requests sound 0x11 (call 0x4c93 -> loc_4ca5 enqueue),
 *   - stamps tile 0x41 into the ADJACENT cell (ix-0x1f) of the tilemap,
 *   - clears 0x80bd and 0x80a9, and seeds 0x80aa=0x09 / 0x80ab=0x07 -- the small
 *     target/prize state block that the capture-window handlers (loc_2c91/loc_2cb7)
 *     read at 0x80a9.. ,
 * then TAIL-JUMPS to 0x2bd3 to build the 4-byte record and continue. (The role
 * labels are best-effort from the code; addresses, values and control flow are exact.)
 *
 * The routine has NO conditional branches -- it is one straight line. `call 0x4c93`
 * is a REGULAR call: it pushes its own return address 0x2d51 and resumes in-line
 * (loc_4c93 tail-jumps to loc_4ca5, whose `ret` unwinds to the 0x2d51 we pushed).
 * The closing `jp 0x2bd3` is a TAIL-JUMP: loc_2d4e keeps no frame of its own, so
 * 0x2bd3's own `ret` returns to loc_2d4e's caller -- modelled `m.step(0x2bd3, 10);
 * return m.call(0x2bd3)` with NO trailing m.ret (a second ret would double-pop).
 *
 * IX is inherited from the caller (loaded at 0x2d3a from 0x80af); this routine never
 * touches it, only dereferences (ix-0x1f). None of the immediate loads/stores here
 * are branched on, so the residual flags are dead on the path to 0x2bd3.
 *
 *   2d4e  cd 93 4c     call 0x4c93        ; request sound 0x11 (resumes in-line)
 *   2d51  3e 41        ld   a,0x41
 *   2d53  dd 77 e1     ld   (ix-0x1f),a   ; stamp tile 0x41 into the adjacent VRAM cell
 *   2d56  3e 00        ld   a,0x00
 *   2d58  32 bd 80     ld   (0x80bd),a
 *   2d5b  32 a9 80     ld   (0x80a9),a
 *   2d5e  3e 09        ld   a,0x09
 *   2d60  32 aa 80     ld   (0x80aa),a
 *   2d63  3e 07        ld   a,0x07
 *   2d65  32 ab 80     ld   (0x80ab),a
 *   2d68  c3 d3 2b     jp   0x2bd3
 */
export function loc_2d4e(m) {
  const { regs, mem } = m;

  // 2d4e  call 0x4c93 -- request sound 0x11; pushes 0x2d51, resumes in-line
  m.push16(0x2d51);
  m.step(0x4c93, 17);
  m.call(0x4c93);
  // 2d51  ld a,0x41 -- the tile code to stamp
  regs.a = 0x41;
  m.step(0x2d53, 7);
  // 2d53  ld (ix-0x1f),a -- stamp tile 0x41 into the cell just before (ix-0x1e)
  mem.write8((regs.ix - 0x1f) & 0xffff, regs.a);
  m.step(0x2d56, 19);
  // 2d56  ld a,0x00
  regs.a = 0x00;
  m.step(0x2d58, 7);
  // 2d58  ld (0x80bd),a -- clear 0x80bd
  mem.write8(0x80bd, regs.a);
  m.step(0x2d5b, 13);
  // 2d5b  ld (0x80a9),a -- clear the target/prize X byte 0x80a9
  mem.write8(0x80a9, regs.a);
  m.step(0x2d5e, 13);
  // 2d5e  ld a,0x09
  regs.a = 0x09;
  m.step(0x2d60, 7);
  // 2d60  ld (0x80aa),a -- seed 0x80aa = 0x09
  mem.write8(0x80aa, regs.a);
  m.step(0x2d63, 13);
  // 2d63  ld a,0x07
  regs.a = 0x07;
  m.step(0x2d65, 7);
  // 2d65  ld (0x80ab),a -- seed 0x80ab = 0x07
  mem.write8(0x80ab, regs.a);
  m.step(0x2d68, 13);
  // 2d68  jp 0x2bd3 -- tail-jump: 0x2bd3's ret returns to loc_2d4e's caller
  m.step(0x2bd3, 10);
  return m.call(0x2bd3);
}
