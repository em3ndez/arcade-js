// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_287a  (ROM 0x287a-0x28a8, The Pit) -- object/state control-block initialiser.
 * Seeds a work-RAM control block: writes the fixed header 0x80aa=0x30, 0x80ab=0x07;
 * zeroes the scratch/counter bytes 0x80a9, 0x80ac, 0x80b1, 0x80bd, 0x80c1, 0x80c0;
 * block-copies a 24-byte (0x18) parameter table from ROM 0x2dab into work RAM 0x80c3;
 * sets 0x80c2=0x20; then tail-jumps into 0x2f2f to continue. (Role is best-effort from
 * the code; the addresses, constants, the 0x18 copy length and the control flow are
 * exact.)
 *
 * The final `jp 0x2f2f` is a TAIL-JUMP, not a call: loc_287a keeps no frame of its own,
 * so 0x2f2f's own `ret` returns to loc_287a's caller. It is modelled as
 * `m.step(0x2f2f, 10); return m.call(0x2f2f)` with NO trailing m.ret -- a second ret
 * would double-pop the caller's return address. LDIR costs 21 T per repeating
 * iteration and 16 T on the final one (0x18 bytes => 21*23 + 16 = 499 T).
 *
 *   287a  3e 30        ld   a,0x30
 *   287c  32 aa 80     ld   (0x80aa),a
 *   287f  3e 07        ld   a,0x07
 *   2881  32 ab 80     ld   (0x80ab),a
 *   2884  3e 00        ld   a,0x00
 *   2886  32 a9 80     ld   (0x80a9),a
 *   2889  32 ac 80     ld   (0x80ac),a
 *   288c  32 b1 80     ld   (0x80b1),a
 *   288f  32 bd 80     ld   (0x80bd),a
 *   2892  32 c1 80     ld   (0x80c1),a
 *   2895  32 c0 80     ld   (0x80c0),a
 *   2898  11 c3 80     ld   de,0x80c3
 *   289b  21 ab 2d     ld   hl,0x2dab
 *   289e  01 18 00     ld   bc,0x0018
 *   28a1  ed b0        ldir
 *   28a3  3e 20        ld   a,0x20
 *   28a5  32 c2 80     ld   (0x80c2),a
 *   28a8  c3 2f 2f     jp   0x2f2f
 */
export function loc_287a(m) {
  const { regs, mem } = m;

  regs.a = 0x30;
  m.step(0x287c, 7); // 287a  ld a,0x30

  mem.write8(0x80aa, regs.a);
  m.step(0x287f, 13); // 287c  ld (0x80aa),a

  regs.a = 0x07;
  m.step(0x2881, 7); // 287f  ld a,0x07

  mem.write8(0x80ab, regs.a);
  m.step(0x2884, 13); // 2881  ld (0x80ab),a

  regs.a = 0x00;
  m.step(0x2886, 7); // 2884  ld a,0x00

  mem.write8(0x80a9, regs.a);
  m.step(0x2889, 13); // 2886  ld (0x80a9),a

  mem.write8(0x80ac, regs.a);
  m.step(0x288c, 13); // 2889  ld (0x80ac),a

  mem.write8(0x80b1, regs.a);
  m.step(0x288f, 13); // 288c  ld (0x80b1),a

  mem.write8(0x80bd, regs.a);
  m.step(0x2892, 13); // 288f  ld (0x80bd),a

  mem.write8(0x80c1, regs.a);
  m.step(0x2895, 13); // 2892  ld (0x80c1),a

  mem.write8(0x80c0, regs.a);
  m.step(0x2898, 13); // 2895  ld (0x80c0),a

  regs.de = 0x80c3;
  m.step(0x289b, 10); // 2898  ld de,0x80c3

  regs.hl = 0x2dab;
  m.step(0x289e, 10); // 289b  ld hl,0x2dab

  regs.bc = 0x0018;
  m.step(0x28a1, 10); // 289e  ld bc,0x0018

  m.ldirAt(0x28a1, 0x28a3); // 28a1  ldir -- copy 0x18 bytes from ROM 0x2dab -> 0x80c3

  regs.a = 0x20;
  m.step(0x28a5, 7); // 28a3  ld a,0x20

  mem.write8(0x80c2, regs.a);
  m.step(0x28a8, 13); // 28a5  ld (0x80c2),a

  // 28a8  jp 0x2f2f -- tail-jump: 0x2f2f's ret returns to loc_287a's caller.
  m.step(0x2f2f, 10);
  return m.call(0x2f2f);
}
