// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_48c4  (ROM 0x48C4–0x48E4, The Pit) — recolours a 9-cell column, advancing
 * its colour value one step per call: seats the row count (0x8055=9), then reads
 * the colour byte at 0x8057, BUMPS it (`inc a`) and masks bit 3 off (`and 0xf7`)
 * and writes it back — a counter that cycles but never sets bit 3. It seats the
 * column/row coordinate (0x8058=6, 0x8059=0x0A), derives that cell's colour/video
 * addresses (call 0x3dae -> 0x3dc9), then tail-jumps to the column fill at 0x3e01,
 * which lays 9 cells of the 0x8057 byte down the colour-RAM column (base at 0x805e)
 * and runs its own `ret`. Unlike the sibling column routines it loads NO IX and
 * runs no copy (0x3dea/0x3ddb) — it only recolours. Straight-line, no conditionals;
 * the one flag-affecting instruction is `and 0xf7`, whose flags nothing here reads.
 * (Role is best-effort from the code; addresses, cycles and control flow are exact.)
 *
 *   48c4  3e 09        ld   a,0x09
 *   48c6  32 55 80     ld   (0x8055),a
 *   48c9  3a 57 80     ld   a,(0x8057)
 *   48cc  3c           inc  a
 *   48cd  e6 f7        and  0xf7
 *   48cf  32 57 80     ld   (0x8057),a
 *   48d2  3e 06        ld   a,0x06
 *   48d4  32 58 80     ld   (0x8058),a
 *   48d7  3e 0a        ld   a,0x0a
 *   48d9  32 59 80     ld   (0x8059),a
 *   48dc  cd ae 3d     call 0x3dae
 *   48df  cd c9 3d     call 0x3dc9
 *   48e2  c3 01 3e     jp   0x3e01
 *
 * Control-flow note: the closing `jp 0x3e01` is a tail-jump into another routine,
 * not a loop back-edge. Nothing is pushed, so it is modelled
 * `m.step(0x3e01,10); return m.call(0x3e01)` -- loc_3e01 ends in its OWN `ret`,
 * which pops OUR caller's return address. Adding a second `m.ret()` here would
 * double-pop the stack (same convention as the sibling loc_48e5 tail-jump).
 */
export function loc_48c4(m) {
  const { regs, mem } = m;

  // 48c4  ld a,0x09
  regs.a = 0x09;
  m.step(0x48c6, 7);
  // 48c6  ld (0x8055),a -- row count for the 0x3e01 tail (9 cells)
  mem.write8(0x8055, regs.a);
  m.step(0x48c9, 13);
  // 48c9  ld a,(0x8057) -- the current colour byte
  regs.a = mem.read8(0x8057);
  m.step(0x48cc, 13);
  // 48cc  inc a -- advance the colour one step (inc8 preserves carry)
  regs.a = regs.inc8(regs.a);
  m.step(0x48cd, 4);
  // 48cd  and 0xf7 -- clear bit 3: the counter cycles but never sets bit 3
  regs.and(0xf7);
  m.step(0x48cf, 7);
  // 48cf  ld (0x8057),a -- write the bumped colour back (also the 0x3e01 fill byte)
  mem.write8(0x8057, regs.a);
  m.step(0x48d2, 13);
  // 48d2  ld a,0x06
  regs.a = 0x06;
  m.step(0x48d4, 7);
  // 48d4  ld (0x8058),a -- column coordinate
  mem.write8(0x8058, regs.a);
  m.step(0x48d7, 13);
  // 48d7  ld a,0x0a
  regs.a = 0x0a;
  m.step(0x48d9, 7);
  // 48d9  ld (0x8059),a -- row coordinate
  mem.write8(0x8059, regs.a);
  m.step(0x48dc, 13);
  // 48dc  call 0x3dae -- row/col -> tilemap offset word (0x805a)
  m.push16(0x48df); m.step(0x3dae, 17); m.call(0x3dae);
  // 48df  call 0x3dc9 -- offset -> colour (0x805e) + video (0x8060) addresses
  m.push16(0x48e2); m.step(0x3dc9, 17); m.call(0x3dc9);
  // 48e2  jp 0x3e01 -- tail-jump into the column fill (runs its own `ret`)
  m.step(0x3e01, 10);
  return m.call(0x3e01);
}
