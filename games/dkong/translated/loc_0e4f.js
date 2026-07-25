// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_0e4f  (ROM 0x0E4F–0x0ED2) — the ladder drawer for kind-2 records (with the 0x0E62/0x0E78/0x0EA0/0x0EC9/0x0ED3/0x0EE5 group).
 *
 * THE LADDER DRAWER. Kind-2 records take this path instead of the flat
 * girder fill at loc_0e19. Where that walked ACROSS laying one tile, this
 * walks DOWN -- HL advances a whole row per step (`inc hl` then `add hl,bc`
 * with BC=0x1F, so +0x20) -- and pays out the height counter at 0x63B1 eight
 * pixels at a time. The tile code in 0x63B5 is nudged by +/-1 as it descends,
 * which is how the run slants: the sign of the x-delta at 0x63B2 picks
 * increment (0x0EB7) or decrement (0x0ED3).
 *
 * NOT MUTUAL RECURSION, DESPITE THE SHAPE. Every transfer between these six
 * blocks is a `jp`; there is no `call`, `rst` or `ret` anywhere in the group,
 * so the ROM runs it at flat stack depth. Translated as a state machine over
 * one loop for exactly that reason -- six mutually-calling JS functions would
 * be shape-faithful and would grow a frame per row of every ladder on screen.
 * The tracer reports it as a strongly-connected component because it follows
 * jump edges, which is correct about the graph and misleading about the cost.
 *
 * FOUR EXITS, and they are not symmetric:
 *   0x0E81 / 0x0EA9  height exhausted -> loc_0ecf -> `inc de / jp 0x0da7`
 *   0x0ECC           L back at a row boundary -> loc_0ecf, same
 *   0x0E54           kind != 2 -> 0x0EE8, still untranslated
 *
 * `and 0x1f` ON L, three times (0x0E68, 0x0E95, 0x0ECA), is a ROW-BOUNDARY
 * TEST: the tilemap is 32 cells wide, so L wrapping past a multiple of 32
 * means the write ran off the end of a row. Each site handles it by skipping
 * the paired second tile rather than by clamping.
 *
 * `jp p` at 0x0EDC is the same sign test as loc_0dd3's -- bit 7 of
 * (0x63B5 - 0xF0), NOT an unsigned comparison. See that routine's note.
 */
export function loc_0e4f(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x63b3);
  m.step(0x0e52, 13);
  regs.cp(0x02);
  m.step(0x0e54, 7);
  if (regs.fNZ) {
    m.step(0x0ee8, 10); // jp nz -- kind 3 or more
    return m.call(0x0ee8); // kind 3 -> strip drawer; kind 4+ -> entry_0f1b (tail via loc_0ee8)
  }
  m.step(0x0e57, 10);

  regs.a = mem.read8(0x63af);
  m.step(0x0e5a, 13);
  regs.add(0xf0);
  m.step(0x0e5c, 7);
  mem.write8(0x63b5, regs.a);
  m.step(0x0e5f, 13);
  regs.hl = mem.read16(0x63ab);
  m.step(0x0e62, 16);

  // The state machine. `at` names the ROM block about to run; every
  // assignment to it corresponds to a `jp` in the listing.
  let at = 0x0e62;
  for (;;) {
    if (at === 0x0e62) {
      regs.a = mem.read8(0x63b5);
      m.step(0x0e65, 13);
      mem.write8(regs.hl, regs.a);
      m.step(0x0e66, 7);
      regs.hl = (regs.hl + 1) & 0xffff;
      m.step(0x0e67, 6);
      regs.a = regs.l;
      m.step(0x0e68, 4);
      regs.and(0x1f);
      m.step(0x0e6a, 7);
      if (regs.fZ) { m.step(0x0e78, 10); at = 0x0e78; continue; }
      m.step(0x0e6d, 10);
      regs.a = mem.read8(0x63b5);
      m.step(0x0e70, 13);
      regs.cp(0xf0);
      m.step(0x0e72, 7);
      if (regs.fZ) { m.step(0x0e78, 10); at = 0x0e78; continue; }
      m.step(0x0e75, 10);
      regs.sub(0x10);
      m.step(0x0e77, 7);
      mem.write8(regs.hl, regs.a);
      m.step(0x0e78, 7);
      at = 0x0e78;
      continue;
    }

    if (at === 0x0e78) {
      regs.bc = 0x001f;
      m.step(0x0e7b, 10);
      regs.addHl(regs.bc);
      m.step(0x0e7c, 11);
      regs.a = mem.read8(0x63b1);
      m.step(0x0e7f, 13);
      regs.sub(0x08);
      m.step(0x0e81, 7);
      if (regs.fC) { m.step(0x0ecf, 10); at = 0x0ecf; continue; }
      m.step(0x0e84, 10);
      mem.write8(0x63b1, regs.a);
      m.step(0x0e87, 13);
      regs.a = mem.read8(0x63b2);
      m.step(0x0e8a, 13);
      regs.cp(0x00);
      m.step(0x0e8c, 7);
      if (regs.fZ) { m.step(0x0e62, 10); at = 0x0e62; continue; }
      m.step(0x0e8f, 10);
      regs.a = mem.read8(0x63b5);
      m.step(0x0e92, 13);
      mem.write8(regs.hl, regs.a);
      m.step(0x0e93, 7);
      regs.hl = (regs.hl + 1) & 0xffff;
      m.step(0x0e94, 6);
      regs.a = regs.l;
      m.step(0x0e95, 4);
      regs.and(0x1f);
      m.step(0x0e97, 7);
      if (regs.fZ) { m.step(0x0ea0, 10); at = 0x0ea0; continue; }
      m.step(0x0e9a, 10);
      regs.a = mem.read8(0x63b5);
      m.step(0x0e9d, 13);
      regs.sub(0x10);
      m.step(0x0e9f, 7);
      mem.write8(regs.hl, regs.a);
      m.step(0x0ea0, 7);
      at = 0x0ea0;
      continue;
    }

    if (at === 0x0ea0) {
      regs.bc = 0x001f;
      m.step(0x0ea3, 10);
      regs.addHl(regs.bc);
      m.step(0x0ea4, 11);
      regs.a = mem.read8(0x63b1);
      m.step(0x0ea7, 13);
      regs.sub(0x08);
      m.step(0x0ea9, 7);
      if (regs.fC) { m.step(0x0ecf, 10); at = 0x0ecf; continue; }
      m.step(0x0eac, 10);
      mem.write8(0x63b1, regs.a);
      m.step(0x0eaf, 13);
      regs.a = mem.read8(0x63b2);
      m.step(0x0eb2, 13);
      const neg = regs.bit(7, regs.a); // x-delta negative -> slant the other way
      m.step(0x0eb4, 8);
      if (neg) { m.step(0x0ed3, 10); at = 0x0ed3; continue; }
      m.step(0x0eb7, 10);
      regs.a = mem.read8(0x63b5);
      m.step(0x0eba, 13);
      regs.a = regs.inc8(regs.a);
      m.step(0x0ebb, 4);
      mem.write8(0x63b5, regs.a);
      m.step(0x0ebe, 13);
      regs.cp(0xf8);
      m.step(0x0ec0, 7);
      if (regs.fNZ) { m.step(0x0ec9, 10); at = 0x0ec9; continue; }
      m.step(0x0ec3, 10);
      regs.hl = (regs.hl + 1) & 0xffff;
      m.step(0x0ec4, 6);
      regs.a = 0xf0;
      m.step(0x0ec6, 7);
      mem.write8(0x63b5, regs.a);
      m.step(0x0ec9, 13);
      at = 0x0ec9;
      continue;
    }

    if (at === 0x0ec9) {
      regs.a = regs.l;
      m.step(0x0eca, 4);
      regs.and(0x1f);
      m.step(0x0ecc, 7);
      if (regs.fNZ) { m.step(0x0e62, 10); at = 0x0e62; continue; }
      m.step(0x0ecf, 10);
      at = 0x0ecf;
      continue;
    }

    if (at === 0x0ed3) {
      regs.a = mem.read8(0x63b5);
      m.step(0x0ed6, 13);
      regs.a = regs.dec8(regs.a);
      m.step(0x0ed7, 4);
      mem.write8(0x63b5, regs.a);
      m.step(0x0eda, 13);
      regs.cp(0xf0);
      m.step(0x0edc, 7);
      if (regs.fP) { m.step(0x0ee5, 10); at = 0x0ee5; continue; }
      m.step(0x0edf, 10);
      regs.hl = (regs.hl - 1) & 0xffff;
      m.step(0x0ee0, 6);
      regs.a = 0xf7;
      m.step(0x0ee2, 7);
      mem.write8(0x63b5, regs.a);
      m.step(0x0ee5, 13);
      at = 0x0ee5;
      continue;
    }

    if (at === 0x0ee5) {
      m.step(0x0e62, 10); // jp 0x0e62
      at = 0x0e62;
      continue;
    }

    // loc_0ecf -- steps past the record and re-enters the walk
    regs.de = (regs.de + 1) & 0xffff;
    m.step(0x0ed0, 6);
    m.step(0x0da7, 10); // jp 0x0da7 -- TAIL jump, no push
    return;
  }
}
