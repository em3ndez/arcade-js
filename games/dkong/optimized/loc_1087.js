// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_1087 — hand-optimized rewrite of the translated routine at ROM 0x1087,
 * proven equal to its oracle by the equivalence harness. A board-setup coordinator over
 * the shared fill helpers plus inline fills and direct sprite writes; it names no work RAM.
 */

/**
 * loc_1087 -- board-3 (75m / elevators) sprite-and-object setup.  [ROM 0x1087-0x1120]
 *
 * rst-0x28 table entry 3: the per-board setup sub_0f56 dispatches to for BOARD == 3.
 *   - sub_122a (ROM 0x3DEC -> 0x6407, B=5, C=0x1C), sub_1186 (fill 0x6507 / gather 0x6980),
 *   - inline fill: 6 cells of 0x01 from 0x6600, stride 0x10,
 *   - inline fill (2 outer passes, HL RESET to 0x660D each pass so both write the same 3
 *     cells with 0x08, stride 0x10),
 *   - sub_11ec (ROM 0x3E64 -> 0x6603, B=6, C=0x0E),
 *   - sub_122a (ROM 0x3E60 -> 0x6607, B=6, C=0x0C),
 *   - sub_11d3 gather from IX=0x6600 into 0x6958 (B=6, DE=0x10),
 *   - ldir 0x0C bytes 0x3E48 -> 0x6A0C,
 *   - IX=0x6400; ten direct sprite writes (two records at +0/+0x20, fields +3/+5/+e/+f/...),
 *   - ldir 0x10 bytes ROM 0x1121 -> 0x6970,
 *   - ret.
 *
 * CYCLES -- COLLAPSED to one m.step per basic block (each call's own prologue folded
 * into a single charge at the call site; each fixed-count fill loop folded to one charge
 * per iteration). ATOMIC: loc_1087 is reached ONLY via the board-setup dispatch chain
 * (sub_0f56, itself called from loc_0d5f, dispatched by dispatchGameState INSIDE the
 * vblank NMI with the mask cleared) -- the same family already established atomic for
 * sub_0d30/sub_0d43/sub_0d4c and confirmed here by its own callees: sub_11d3, sub_1186,
 * sub_122a and sub_11ec are ALL reached exclusively from this same board-setup family
 * (never from the mask-ENABLED main loop), so the Z80's own NMI auto-mask (no RETN yet
 * executed) means nothing can land mid-routine. Collapsing folds each straight-line run
 * (register loads before a call, or a fill loop's write+advance+djnz) into one charge;
 * every fold's total is the exact sum of the oracle's per-instruction charges it replaces
 * (verified against the original per-instruction file before this edit). No 0x7Dxx
 * hardware latch is written (all stores are RAM/VRAM 0x6xxx), so nothing here needs a
 * partial-collapse boundary.
 */
export function loc_1087(m) {
  const { regs, mem } = m;

  // ld hl,0x3dec / ld de,0x6407 / ld bc,0x051c  (10+10+10 = 30t), then call sub_122a.
  regs.hl = 0x3dec;
  regs.de = 0x6407;
  regs.bc = 0x051c;
  m.step(0x1090, 30);
  m.push16(0x1093);
  m.step(0x122a, 17);
  m.call(0x122a);

  m.push16(0x1096);
  m.step(0x1186, 17);
  m.call(0x1186);

  // inline fill: 6 cells of 0x01 from 0x6600, stride 0x10.
  // setup: ld hl,0x6600 / ld de,0x0010 / ld a,0x01 / ld b,0x06  (10+10+7+7 = 34t)
  regs.hl = 0x6600;
  regs.de = 0x0010;
  regs.a = 0x01;
  regs.b = 0x06;
  m.step(0x10a0, 34);
  do {
    // one iteration: ld (hl),a / add hl,de / djnz  (7+11+13 = 31t continuing, 7+11+8 = 26t last)
    mem.write8(regs.hl, regs.a);
    regs.addHl(regs.de);
    regs.djnz();
    m.step(regs.b !== 0 ? 0x10a0 : 0x10a4, regs.b !== 0 ? 31 : 26);
  } while (regs.b !== 0);

  // inline fill: 2 outer passes; HL reset to 0x660D each pass -> both write the same 3
  // cells with 0x08 (stride 0x10).
  // outer setup: ld c,0x02 / ld a,0x08  (7+7 = 14t)
  regs.c = 0x02;
  regs.a = 0x08;
  m.step(0x10a8, 14);
  do {
    // inner setup: ld b,0x03 / ld hl,0x660d  (7+10 = 17t)
    regs.b = 0x03;
    regs.hl = 0x660d;
    m.step(0x10ad, 17);
    do {
      // one iteration: ld (hl),a / add hl,de / djnz  (7+11+13 = 31t continuing, 7+11+8 = 26t last)
      mem.write8(regs.hl, regs.a);
      regs.addHl(regs.de);
      regs.djnz();
      m.step(regs.b !== 0 ? 0x10ad : 0x10b1, regs.b !== 0 ? 31 : 26);
    } while (regs.b !== 0);
    // outer tail: ld a,0x08 / dec c / jr nz  (7+4+10 = 21t)
    regs.a = 0x08;
    regs.c = regs.dec8(regs.c);
    m.step(regs.fNZ ? 0x10a8 : 0x10b7, 21);
  } while (regs.fNZ);

  // ld hl,0x3e64 / ld de,0x6603 / ld bc,0x060e  (10+10+10 = 30t), then call sub_11ec.
  regs.hl = 0x3e64;
  regs.de = 0x6603;
  regs.bc = 0x060e;
  m.step(0x10c0, 30);
  m.push16(0x10c3);
  m.step(0x11ec, 17);
  m.call(0x11ec);

  // ld hl,0x3e60 / ld de,0x6607 / ld bc,0x060c  (10+10+10 = 30t), then call sub_122a.
  regs.hl = 0x3e60;
  regs.de = 0x6607;
  regs.bc = 0x060c;
  m.step(0x10cc, 30);
  m.push16(0x10cf);
  m.step(0x122a, 17);
  m.call(0x122a);

  // ld ix,0x6600 / ld hl,0x6958 / ld b,0x06 / ld de,0x0010  (14+10+7+10 = 41t), call sub_11d3.
  regs.ix = 0x6600;
  regs.hl = 0x6958;
  regs.b = 0x06;
  regs.de = 0x0010;
  m.step(0x10db, 41);
  m.push16(0x10de);
  m.step(0x11d3, 17);
  m.call(0x11d3);

  // ld hl,0x3e48 / ld de,0x6a0c / ld bc,0x000c  (10+10+10 = 30t), then ldir.
  regs.hl = 0x3e48;
  regs.de = 0x6a0c;
  regs.bc = 0x000c;
  m.step(0x10e7, 30);
  m.ldir(0x10e9);

  // ten direct sprite writes to two records at IX=0x6400 (+0/+0x20).
  // ld ix,0x6400 (14) + ten `ld (ix+d),n` (19 each) = 14 + 190 = 204t, straight-line, no
  // hardware-bus address among them (all 0x64xx work RAM) -- fully foldable.
  regs.ix = 0x6400;
  const R = (d) => (regs.ix + d) & 0xffff;
  mem.write8(R(0x00), 0x01);
  mem.write8(R(0x03), 0x58);
  mem.write8(R(0x0e), 0x58);
  mem.write8(R(0x05), 0x80);
  mem.write8(R(0x0f), 0x80);
  mem.write8(R(0x20), 0x01);
  mem.write8(R(0x23), 0xeb);
  mem.write8(R(0x2e), 0xeb);
  mem.write8(R(0x25), 0x60);
  mem.write8(R(0x2f), 0x60);
  m.step(0x1115, 204);

  // ld de,0x6970 / ld hl,0x1121 / ld bc,0x0010  (10+10+10 = 30t), then ldir.
  regs.de = 0x6970;
  regs.hl = 0x1121;
  regs.bc = 0x0010;
  m.step(0x111e, 30);
  m.ldir(0x1120);

  m.ret(); // 0x1120
}
