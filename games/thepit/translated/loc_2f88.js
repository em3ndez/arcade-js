// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_2f88  (ROM 0x2f88-0x2fbf, The Pit) -- frame-gated 6-tile vertical column
 * animation step, then delegates to loc_2fc0.
 *
 * A per-column frame gate at (0x80e5) counts down once per call; while it is still
 * non-zero the step is skipped (`jr nz,0x2fc0`). When it reaches 0 the gate is
 * reloaded from its period (0x80e4), and the table cursor (0x80e6) is stepped back
 * one 6-byte column (`sub 0x06`). If that underflows past the table start the step
 * is skipped too (`jr c,0x2fc0`). Otherwise the advanced cursor indexes a tile
 * table at 0x3048 (via a store/reload through 0x80e1 into IX) and 6 tile codes are
 * copied UP a video-RAM column at 0x938c, walking the destination one tile-row up
 * per byte (de = 0xffe0 = -0x20). Destinations: 0x938c, 0x936c, 0x934c, 0x932c,
 * 0x930c, 0x92ec.
 *
 * ROUTINE BOUNDARY -- loc_2f88 does NOT inline 0x2fc0. loc_2fc0 is entered from a
 * DIFFERENT routine (loc_2f71 does `jp z,0x2fc0` at 0x2f75), so per doc 03 it is
 * its own routine; loc_2f88 stops at 0x2fbf and DELEGATES `return m.call(0x2fc0)`
 * at each of its three exits (the two `jr` skips and the djnz fall-through). Its
 * bytes therefore live only in loc_2fc0's file, never duplicated here. The exits
 * are modelled like the thepit tail-jump convention (loc_2f2f / loc_241c): charge
 * the branch's own T-states, advance PC to 0x2fc0, then `return m.call(0x2fc0)`
 * with no trailing m.ret (loc_2fc0 runs its own ret, which returns to OUR caller).
 *
 * loc_2fb7 is the internal djnz copy loop (reached only from inside this routine),
 * so it is a plain JS loop, not a separate ROM routine. Every store is to work RAM
 * (0x80xx) or video RAM (0x93xx), neither of which is a hardware write, so no
 * write-bus offset is passed. (Role is best-effort from the code; the addresses,
 * arithmetic, cursor stepping and control flow are exact.)
 *
 * loc_2f88:
 *   2f88  3a e5 80     ld   a,(0x80e5)
 *   2f8b  3d           dec  a
 *   2f8c  32 e5 80     ld   (0x80e5),a
 *   2f8f  20 2f        jr   nz,0x2fc0
 *   2f91  3a e4 80     ld   a,(0x80e4)
 *   2f94  32 e5 80     ld   (0x80e5),a
 *   2f97  3a e6 80     ld   a,(0x80e6)
 *   2f9a  d6 06        sub  0x06
 *   2f9c  38 22        jr   c,0x2fc0
 *   2f9e  32 e6 80     ld   (0x80e6),a
 *   2fa1  5f           ld   e,a
 *   2fa2  16 00        ld   d,0x00
 *   2fa4  21 48 30     ld   hl,0x3048
 *   2fa7  19           add  hl,de
 *   2fa8  22 e1 80     ld   (0x80e1),hl
 *   2fab  dd 2a e1 80  ld   ix,(0x80e1)
 *   2faf  21 8c 93     ld   hl,0x938c
 *   2fb2  11 e0 ff     ld   de,0xffe0
 *   2fb5  06 06        ld   b,0x06
 * loc_2fb7:
 *   2fb7  dd 7e 00     ld   a,(ix+0x00)
 *   2fba  77           ld   (hl),a
 *   2fbb  19           add  hl,de
 *   2fbc  dd 23        inc  ix
 *   2fbe  10 f7        djnz 0x2fb7
 *   ---- fall-through into loc_2fc0 (a routine boundary) ----
 */
export function loc_2f88(m) {
  const { regs, mem } = m;

  // 2f88  ld a,(0x80e5) -- the per-column frame-gate countdown
  regs.a = mem.read8(0x80e5);
  m.step(0x2f8b, 13);
  // 2f8b  dec a (dec8 sets Z for the jr below; leaves carry alone)
  regs.a = regs.dec8(regs.a);
  m.step(0x2f8c, 4);
  // 2f8c  ld (0x80e5),a -- store the decremented gate
  mem.write8(0x80e5, regs.a);
  m.step(0x2f8f, 13);
  // 2f8f  jr nz,0x2fc0 -- gate not yet 0: skip this step, delegate to loc_2fc0
  if (regs.fNZ) { m.step(0x2fc0, 12); return m.call(0x2fc0); }
  m.step(0x2f91, 7); // jr nz NOT taken (gate hit 0)

  // 2f91  ld a,(0x80e4) -- the gate's reload period
  regs.a = mem.read8(0x80e4);
  m.step(0x2f94, 13);
  // 2f94  ld (0x80e5),a -- reload the gate
  mem.write8(0x80e5, regs.a);
  m.step(0x2f97, 13);
  // 2f97  ld a,(0x80e6) -- the table cursor (byte offset into 0x3048)
  regs.a = mem.read8(0x80e6);
  m.step(0x2f9a, 13);
  // 2f9a  sub 0x06 -- step the cursor back one 6-tile column (sets carry on underflow)
  regs.sub(0x06);
  m.step(0x2f9c, 7);
  // 2f9c  jr c,0x2fc0 -- cursor underflowed past the table start: skip, delegate
  if (regs.fC) { m.step(0x2fc0, 12); return m.call(0x2fc0); }
  m.step(0x2f9e, 7); // jr c NOT taken

  // 2f9e  ld (0x80e6),a -- store the advanced cursor
  mem.write8(0x80e6, regs.a);
  m.step(0x2fa1, 13);
  // 2fa1  ld e,a
  regs.e = regs.a;
  m.step(0x2fa2, 4);
  // 2fa2  ld d,0x00 -- de = cursor (0..0xff)
  regs.d = 0x00;
  m.step(0x2fa4, 7);
  // 2fa4  ld hl,0x3048 -- base of the tile-pattern table
  regs.hl = 0x3048;
  m.step(0x2fa7, 10);
  // 2fa7  add hl,de -- hl = &table[cursor]
  regs.addHl(regs.de);
  m.step(0x2fa8, 11);
  // 2fa8  ld (0x80e1),hl -- stash the source pointer
  mem.write16(0x80e1, regs.hl);
  m.step(0x2fab, 16);
  // 2fab  ld ix,(0x80e1) -- ix = the source pointer (same value, reloaded via memory)
  regs.ix = mem.read16(0x80e1);
  m.step(0x2faf, 20);
  // 2faf  ld hl,0x938c -- destination: bottom cell of a video-RAM column
  regs.hl = 0x938c;
  m.step(0x2fb2, 10);
  // 2fb2  ld de,0xffe0 -- -0x20: walk one tile-row UP per byte written
  regs.de = 0xffe0;
  m.step(0x2fb5, 10);
  // 2fb5  ld b,0x06 -- 6 tiles in the column
  regs.b = 0x06;
  m.step(0x2fb7, 7);

  // loc_2fb7: copy 6 table bytes up the video-RAM column (djnz loop, B iterations)
  for (;;) {
    // 2fb7  ld a,(ix+0x00) -- next table byte
    regs.a = mem.read8(regs.ix);
    m.step(0x2fba, 19);
    // 2fba  ld (hl),a -- write the tile code
    mem.write8(regs.hl, regs.a);
    m.step(0x2fbb, 7);
    // 2fbb  add hl,de -- destination up one tile-row
    regs.addHl(regs.de);
    m.step(0x2fbc, 11);
    // 2fbc  inc ix -- advance the source pointer
    regs.ix = (regs.ix + 1) & 0xffff;
    m.step(0x2fbe, 10);
    // 2fbe  djnz 0x2fb7 (affects no flags; taken = 13 T, fall-through = 8 T)
    if (regs.djnz()) { m.step(0x2fb7, 13); continue; }
    m.step(0x2fc0, 8); // djnz falls through -> into loc_2fc0
    break;
  }

  // ---- fall-through into loc_2fc0 (a routine boundary; see header) ----
  return m.call(0x2fc0);
}
