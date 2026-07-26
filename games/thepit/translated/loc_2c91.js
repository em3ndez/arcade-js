// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_2c91  (ROM 0x2c91-0x2cb6, The Pit) -- the shared overlap-record tail: tests
 * whether the just-placed cell (target bytes 0x80a9/0x80ac) overlaps the tracked
 * object at 0x8068/0x806b, publishes the 0/1 result to the per-tick flag 0x8080, then
 * tail-jumps to 0x2bd3 to build the 4-byte record. This is the exact tail that
 * loc_2c04 falls into in-line and that loc_2cb7 reaches via `jp nz,0x2c91` when its
 * countdown has not yet expired. (Role is best-effort from the code; the addresses,
 * arithmetic and branch senses are exact.)
 *
 * d starts at 0 (default "no overlap") and is raised to 1 only when BOTH axes hit:
 *   - row band:  (0x80ac)+0x0c == (0x806b)         ; exact match, else jr nz -> d stays 0
 *   - X window:  (0x80a9) < (0x8068) <= (0x80a9)+8 ; the two guards below
 *       (0x80a9)      >= (0x8068)  -> jr nc 0x2cb0  ; object not right of the cell -> d=0
 *       (0x80a9)+0x08 <  (0x8068)  -> jr c  0x2cb0  ; object past the 8px window   -> d=0
 * then loc_2cb0: (0x8080) = d ; jp 0x2bd3.
 *
 * The three `jr` guards all target 0x2cb0, an internal forward label still inside this
 * routine -- modelled as nested JS conditionals that converge on the loc_2cb0 block (a
 * taken guard charges the 12-T jr and skips to loc_2cb0; a not-taken guard charges 7 T
 * and falls through). The final `jp 0x2bd3` is a TAIL-JUMP: loc_2c91 keeps no frame of
 * its own, so 0x2bd3's own `ret` (through 0x2f71) returns to loc_2c91's caller --
 * modelled `m.step(0x2bd3, 10); return m.call(0x2bd3)` with NO trailing m.ret (a second
 * ret would double-pop).
 *
 * `ld a,d` at 0x2cb0 does not disturb d, and `ld (nn),a` touches no flags, so the flag
 * consumed by nothing after the last cp is dead -- only d (0 or 1) survives to 0x8080.
 *
 *   2c91  16 00        ld   d,0x00
 *   2c93  3a 6b 80     ld   a,(0x806b)
 *   2c96  47           ld   b,a
 *   2c97  3a ac 80     ld   a,(0x80ac)
 *   2c9a  c6 0c        add  a,0x0c
 *   2c9c  b8           cp   b
 *   2c9d  20 11        jr   nz,0x2cb0
 *   2c9f  3a 68 80     ld   a,(0x8068)
 *   2ca2  4f           ld   c,a
 *   2ca3  3a a9 80     ld   a,(0x80a9)
 *   2ca6  b9           cp   c
 *   2ca7  30 07        jr   nc,0x2cb0
 *   2ca9  c6 08        add  a,0x08
 *   2cab  b9           cp   c
 *   2cac  38 02        jr   c,0x2cb0
 *   2cae  16 01        ld   d,0x01
 * loc_2cb0:
 *   2cb0  7a           ld   a,d
 *   2cb1  32 80 80     ld   (0x8080),a
 *   2cb4  c3 d3 2b     jp   0x2bd3
 */
export function loc_2c91(m) {
  const { regs, mem } = m;

  // 2c91  ld d,0x00 -- default: no overlap
  regs.d = 0x00;
  m.step(0x2c93, 7);
  // 2c93  ld a,(0x806b) -- tracked object coord (row band)
  regs.a = mem.read8(0x806b);
  m.step(0x2c96, 13);
  // 2c96  ld b,a
  regs.b = regs.a;
  m.step(0x2c97, 4);
  // 2c97  ld a,(0x80ac) -- cell column base
  regs.a = mem.read8(0x80ac);
  m.step(0x2c9a, 13);
  // 2c9a  add a,0x0c
  regs.add(0x0c);
  m.step(0x2c9c, 7);
  // 2c9c  cp b -- same row band?
  regs.cp(regs.b);
  m.step(0x2c9d, 4);
  // 2c9d  jr nz,0x2cb0 -- different band: leave d = 0
  if (regs.fNZ) {
    m.step(0x2cb0, 12);
  } else {
    m.step(0x2c9f, 7);
    // 2c9f  ld a,(0x8068) -- tracked object X
    regs.a = mem.read8(0x8068);
    m.step(0x2ca2, 13);
    // 2ca2  ld c,a
    regs.c = regs.a;
    m.step(0x2ca3, 4);
    // 2ca3  ld a,(0x80a9) -- cell row/X value
    regs.a = mem.read8(0x80a9);
    m.step(0x2ca6, 13);
    // 2ca6  cp c
    regs.cp(regs.c);
    m.step(0x2ca7, 4);
    // 2ca7  jr nc,0x2cb0 -- object not to the right of the cell: leave d = 0
    if (regs.fNC) {
      m.step(0x2cb0, 12);
    } else {
      m.step(0x2ca9, 7);
      // 2ca9  add a,0x08 -- top of the 8-pixel window
      regs.add(0x08);
      m.step(0x2cab, 7);
      // 2cab  cp c
      regs.cp(regs.c);
      m.step(0x2cac, 4);
      // 2cac  jr c,0x2cb0 -- object beyond the 8-pixel window: leave d = 0
      if (regs.fC) {
        m.step(0x2cb0, 12);
      } else {
        m.step(0x2cae, 7);
        // 2cae  ld d,0x01 -- overlap detected
        regs.d = 0x01;
        m.step(0x2cb0, 7);
      }
    }
  }

  // loc_2cb0:
  // 2cb0  ld a,d
  regs.a = regs.d;
  m.step(0x2cb1, 4);
  // 2cb1  ld (0x8080),a -- publish the overlap flag
  mem.write8(0x8080, regs.a);
  m.step(0x2cb4, 13);
  // 2cb4  jp 0x2bd3 -- tail-jump: 0x2bd3's ret returns to loc_2c91's caller
  m.step(0x2bd3, 10);
  return m.call(0x2bd3);
}
