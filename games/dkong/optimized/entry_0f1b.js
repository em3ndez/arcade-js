// SPDX-License-Identifier: GPL-3.0-only
/**
 * entry_0f1b — hand-optimized rewrite of the translated routine at ROM 0x0F1B,
 * proven equal to its oracle by the equivalence harness. It touches only board-render
 * scratch (0x63AB tilemap pointer, 0x63B1 extent, 0x63B3 kind, 0x63B5 fill tile) and
 * video RAM, so no ram.js name is imported.
 */

/**
 * entry_0f1b -- fill a vertical strip with a kind-selected tile (record kinds 4/5/6).
 * [ROM 0x0F1B-0x0F55]
 *
 * The kind>=4 tail of the board-layout renderer (loc_0ee8 delegates here). The record
 * kind (0x63B3) picks the fill tile-code and kinds >=7 are a no-op:
 *   - kind 4 -> 0xE0,  kind 5 -> 0xB0,  kind 6 (default) -> 0xFE
 *   - kind >= 7 -> bail: step DE past the record and re-enter the walk at 0x0DA7.
 * The chosen tile is stashed in 0x63B5, then a do-while column fill runs from the
 * record's tilemap address (0x63AB, loaded ONCE before the loop): write the tile, step
 * HL one whole tilemap row (+0x20), decrement the extent (0x63B1) by 8, and repeat while
 * the subtraction does NOT borrow. Then step DE past the record and re-enter the walk.
 *
 * `cp 0x07 / jp p` at 0x0F20 is a SIGN test (kind>=7), transcribed as fP -- not a
 * carry/nc test. The loop counter LIVES IN 0x63B1 (reloaded/decremented/stored each row),
 * so its intermediate values stay observable; HL is NOT reloaded inside the loop.
 *
 * CYCLES -- COLLAPSED to one m.step per basic block (same convention as sub_0350 /
 * loc_0e4f: a "not taken" branch charge folds FORWARD into whatever unconditional code
 * follows it up to the next decision or genuine merge point -- e.g. loc_0f2f, reached
 * from THREE predecessors (kind 4/5/6), keeps its own fresh charge). Every branch TOTAL
 * sums to the oracle's, EXACTLY (verified against translated/state0.js). The `jp 0x0da7`
 * exits are the walk back-edge -> return; each is a single-predecessor tail, so its
 * charge is folded together with the `inc de`/`jp 0x0da7` that precede the return.
 */
export function entry_0f1b(m) {
  const { regs, mem } = m;

  // ld a,(63b3)[13]+cp 7[7] -- record kind, sign test.  20 t
  regs.a = mem.read8(0x63b3);
  regs.cp(0x07);
  m.step(0x0f20, 20);
  if (regs.fP) {
    // jp p taken[10]+inc de[6]+jp 0x0da7[10] -- kind>=7 bail, walk back-edge.  26 t
    regs.de = (regs.de + 1) & 0xffff;
    m.step(0x0da7, 26);
    return;
  }
  // jp p not-taken[10]+cp 4[7] -- kind4 test.  17 t
  regs.cp(0x04);
  m.step(0x0f25, 17);
  if (regs.fZ) {
    // jp z taken[10]+ld a,0xe0[7]+jp 0x0f2f[10] -- kind 4 fill tile.  27 t
    regs.a = 0xe0;
    m.step(0x0f2f, 27);
  } else {
    // jp z not-taken[10]+cp 5[7] -- kind5 test.  17 t
    regs.cp(0x05);
    m.step(0x0f2a, 17);
    if (regs.fZ) {
      // jp z taken[10]+ld a,0xb0[7]+jp 0x0f2f[10] -- kind 5 fill tile.  27 t
      regs.a = 0xb0;
      m.step(0x0f2f, 27);
    } else {
      // jp z not-taken[10]+ld a,0xfe[7] -- kind 6 (default) fill tile, fallthrough.  17 t
      regs.a = 0xfe;
      m.step(0x0f2f, 17);
    }
  }

  // loc_0f2f -- common fill body; A = fill tile-code. HL loaded ONCE, outside the loop.
  // ld (63b5),a[13]+ld hl,(63ab)[16] -- entering the loop.  29 t
  mem.write8(0x63b5, regs.a);
  regs.hl = mem.read16(0x63ab);
  m.step(0x0f35, 29);

  for (;;) {
    // ld a,(63b5)[13]+ld(hl),a[7]+ld bc,0x20[10]+add hl,bc[11]+ld a,(63b1)[13]+sub 8[7]
    //   +ld(63b1),a[13] -- lay tile, advance row, decrement extent.  74 t
    regs.a = mem.read8(0x63b5);
    mem.write8(regs.hl, regs.a);
    regs.bc = 0x0020;
    regs.addHl(regs.bc);
    regs.a = mem.read8(0x63b1);
    regs.sub(0x08);
    mem.write8(0x63b1, regs.a);
    m.step(0x0f45, 74);
    if (regs.fNC) { m.step(0x0f35, 10); continue; } // jp nc taken -- loop back, merge, alone
    break;
  }
  // jp nc not-taken[10]+inc de[6]+jp 0x0da7[10] -- loop exhausted, walk back-edge.  26 t
  regs.de = (regs.de + 1) & 0xffff;
  m.step(0x0da7, 26);
  return;
}
