// SPDX-License-Identifier: GPL-3.0-only

/**
 * sub_1486  (ROM 0x1486–0x15F6) — the (0x600A) phase-21 handler: on-board bonus item mover + its.
 * value-digit display. ROM 0x1486-0x15F9 (372 bytes).
 * Dispatched by loc_06fe's
 * 0x0702 table at index 21 (word 0x1486 @0x072C).
 *
 * Init (0x6009==0): clear latches, mark running (0x6009)=1, seed the state block
 * (0x6030)=0x0A/(0x6031)=0/(0x6032)=0x10/(0x6033)=0x1E/(0x6034)=0x3E/(0x6035)=0,
 * set the video pointer (0x6036)=0x75E8, and locate the item slot by scanning the
 * 0x611C table (stride 0x22, 4 rows) for key 2*(0x600E)+1; store the slot at
 * (0x6038) and slot-0x0D at (0x603A); render via sub_15fa.
 * Per frame: count down the display timer (0x6034) (reload 0x3E); on wrap decrement
 * the value (0x6033) (BCD-split to 0x7552/0x7572) -- value==0 EXITs. Step the item
 * position (0x6035) per (0x6010) (bit7 -> the 0x1546 video-column walk 0x7588/0x7608;
 * low bits -> 0x1514 inc/dec with wrap 0..0x1D). Animate the sprite (0x158a: countdown
 * (0x6032), toggle (0x6031), IX from (iy+4/5) with iy=(0x6038), sub_057c renders the
 * 6 digits). EXIT (0x15c6): clear slot, (0x6009)=0x80, DEC (0x600A) [the phase step-
 * back -- do not drop], copy the 0x0C-cell column to iy=(0x603A), and
 * enqueue the follow-up tasks 0x0314..0x0318 (5x) + 0x031A via sub_309f.
 *
 * S2 PROVEN: dense branch tree with a SINGLE ret @0x15F9 (all paths converge via
 * jp/fall-through). Irreducible CFG (backward cross-jumps 0x1543->0x152d,
 * 0x1587->0x1580, 0x15c3->0x15a0) -> a label-dispatch loop: ROM labels as cases,
 * jumps as `label=X; continue`, ROM fall-through as switch fall-through (the
 * entry_3202 idiom). HAZARDS: `jp p` @0x153E is SIGNED -> regs.fP; `dec (hl)` RMW
 * @0x14DF/0x14E6/0x158D/0x15D2 flag-correct via regs.decMem8; bit 7/1 @0x1505/0x151D
 * via regs.bit; sbc hl,bc @0x155A/0x1578 preceded by `and a` to clear carry.
 * Callees sub_0616/sub_15fa/sub_309f INTEGRATED; sub_057c integrated above.
 */
export function sub_1486(m) {
  const { regs, mem } = m;
  let label = 0x1486;
  for (;;) {
    switch (label) {
      case 0x1486:
        m.push16(0x1489);
        m.step(0x0616, 17); // call 0x0616 (INT)
        m.call(0x0616);
        regs.hl = 0x6009;
        m.step(0x148c, 10); // ld hl,0x6009
        regs.a = mem.read8(regs.hl);
        m.step(0x148d, 7); // ld a,(hl)
        regs.and(regs.a);
        m.step(0x148e, 4); // and a
        if (regs.fNZ) { label = 0x14dc; continue; } // jp nz,0x14dc -- already running
        m.step(0x1491, 10); // jp nz NOT taken
        // ---- init (0x6009 == 0), A == 0 ----
        mem.write8(0x7d86, regs.a);
        m.step(0x1494, 13); // ld (0x7d86),a -- clear latch
        mem.write8(0x7d87, regs.a);
        m.step(0x1497, 13); // ld (0x7d87),a
        mem.write8(regs.hl, 0x01);
        m.step(0x1499, 10); // ld (hl),0x01 -- (0x6009):=1 running
        regs.hl = 0x6030;
        m.step(0x149c, 10); // ld hl,0x6030 -- init item-state block
        mem.write8(regs.hl, 0x0a);
        m.step(0x149e, 10); // ld (hl),0x0a -- (0x6030):=0x0A
        regs.hl = (regs.hl + 1) & 0xffff;
        m.step(0x149f, 6); // inc hl
        mem.write8(regs.hl, 0x00);
        m.step(0x14a1, 10); // ld (hl),0x00 -- (0x6031):=0
        regs.hl = (regs.hl + 1) & 0xffff;
        m.step(0x14a2, 6); // inc hl
        mem.write8(regs.hl, 0x10);
        m.step(0x14a4, 10); // ld (hl),0x10 -- (0x6032):=0x10
        regs.hl = (regs.hl + 1) & 0xffff;
        m.step(0x14a5, 6); // inc hl
        mem.write8(regs.hl, 0x1e);
        m.step(0x14a7, 10); // ld (hl),0x1e -- (0x6033):=0x1E
        regs.hl = (regs.hl + 1) & 0xffff;
        m.step(0x14a8, 6); // inc hl
        mem.write8(regs.hl, 0x3e);
        m.step(0x14aa, 10); // ld (hl),0x3e -- (0x6034):=0x3E
        regs.hl = (regs.hl + 1) & 0xffff;
        m.step(0x14ab, 6); // inc hl
        mem.write8(regs.hl, 0x00);
        m.step(0x14ad, 10); // ld (hl),0x00 -- (0x6035):=0
        regs.hl = 0x75e8;
        m.step(0x14b0, 10); // ld hl,0x75e8
        mem.write16(0x6036, regs.hl);
        m.step(0x14b3, 16); // ld (0x6036),hl -- (0x6036):=0x75E8 video ptr
        regs.hl = 0x611c;
        m.step(0x14b6, 10); // ld hl,0x611c -- item-slot table
        regs.a = mem.read8(0x600e);
        m.step(0x14b9, 13); // ld a,(0x600e)
        regs.rlca();
        m.step(0x14ba, 4); // rlca
        regs.a = regs.inc8(regs.a);
        m.step(0x14bb, 4); // inc a
        regs.c = regs.a;
        m.step(0x14bc, 4); // ld c,a -- C := 2*(0x600E)+1 search key
        regs.de = 0x0022;
        m.step(0x14bf, 10); // ld de,0x0022 -- table stride
        regs.b = 0x04;
        m.step(0x14c1, 7); // ld b,0x04 -- 4 entries
      // fall into 0x14c1
      case 0x14c1:
        regs.a = mem.read8(regs.hl);
        m.step(0x14c2, 7); // ld a,(hl)
        regs.cp(regs.c);
        m.step(0x14c3, 4); // cp c
        if (regs.fZ) { label = 0x14c9; continue; } // jp z,0x14c9 -- match
        m.step(0x14c6, 10); // jp z NOT taken
        regs.addHl(regs.de);
        m.step(0x14c7, 11); // add hl,de
        regs.djnz();
        m.step(regs.b ? 0x14c1 : 0x14c9, regs.b ? 13 : 8); // djnz 0x14c1
        if (regs.b) { label = 0x14c1; continue; }
      // fall into 0x14c9 (no match -> hl at 4th row, B=0; ROM does not guard)
      case 0x14c9:
        mem.write16(0x6038, regs.hl);
        m.step(0x14cc, 16); // ld (0x6038),hl -- slot ptr
        regs.de = 0xfff3;
        m.step(0x14cf, 10); // ld de,0xfff3
        regs.addHl(regs.de);
        m.step(0x14d0, 11); // add hl,de -- hl -= 0x0D
        mem.write16(0x603a, regs.hl);
        m.step(0x14d3, 16); // ld (0x603a),hl -- slot-0x0D
        regs.b = 0x00;
        m.step(0x14d5, 7); // ld b,0x00
        regs.a = mem.read8(0x6035);
        m.step(0x14d8, 13); // ld a,(0x6035)
        regs.c = regs.a;
        m.step(0x14d9, 4); // ld c,a
        m.push16(0x14dc);
        m.step(0x15fa, 17); // call 0x15fa -- render (INT)
        m.call(0x15fa);
      // fall into 0x14dc
      case 0x14dc:
        regs.hl = 0x6034;
        m.step(0x14df, 10); // ld hl,0x6034 -- MAIN LOOP
        regs.decMem8(mem, regs.hl);
        m.step(0x14e0, 11); // dec (hl) -- (0x6034)-- display timer
        if (regs.fNZ) { label = 0x14fc; continue; } // jp nz,0x14fc
        m.step(0x14e3, 10); // jp nz NOT taken
        mem.write8(regs.hl, 0x3e);
        m.step(0x14e5, 10); // ld (hl),0x3e -- reload (0x6034):=0x3E
        regs.hl = (regs.hl - 1) & 0xffff;
        m.step(0x14e6, 6); // dec hl
        regs.decMem8(mem, regs.hl);
        m.step(0x14e7, 11); // dec (hl) -- (0x6033)-- value
        if (regs.fZ) { label = 0x15c6; continue; } // jp z,0x15c6 -- value==0 EXIT
        m.step(0x14ea, 10); // jp z NOT taken
        regs.a = mem.read8(regs.hl);
        m.step(0x14eb, 7); // ld a,(hl)
        regs.b = 0xff;
        m.step(0x14ed, 7); // ld b,0xff
      // fall into 0x14ed
      case 0x14ed:
        regs.b = regs.inc8(regs.b);
        m.step(0x14ee, 4); // inc b -- BCD split of (0x6033)
        regs.sub(0x0a);
        m.step(0x14f0, 7); // sub 0x0a
        if (regs.fNC) { label = 0x14ed; continue; } // jp nc,0x14ed
        m.step(0x14f3, 10); // jp nc NOT taken
        regs.add(0x0a);
        m.step(0x14f5, 7); // add a,0x0a -- A := ones digit, B := tens
        mem.write8(0x7552, regs.a);
        m.step(0x14f8, 13); // ld (0x7552),a -- write ones -> video
        regs.a = regs.b;
        m.step(0x14f9, 4); // ld a,b
        mem.write8(0x7572, regs.a);
        m.step(0x14fc, 13); // ld (0x7572),a -- write tens -> video
      // fall into 0x14fc
      case 0x14fc:
        regs.hl = 0x6030;
        m.step(0x14ff, 10); // ld hl,0x6030 -- position step
        regs.b = mem.read8(regs.hl);
        m.step(0x1500, 7); // ld b,(hl) -- B := (0x6030)
        mem.write8(regs.hl, 0x0a);
        m.step(0x1502, 10); // ld (hl),0x0a
        regs.a = mem.read8(0x6010);
        m.step(0x1505, 13); // ld a,(0x6010) -- input/state
        regs.bit(7, regs.a);
        m.step(0x1507, 8); // bit 7,a
        if (regs.fNZ) { label = 0x1546; continue; } // jp nz,0x1546 -- bit7 set
        m.step(0x150a, 10); // jp nz NOT taken
        regs.and(0x03);
        m.step(0x150c, 7); // and 0x03
        if (regs.fNZ) { label = 0x1514; continue; } // jp nz,0x1514 -- low bits
        m.step(0x150f, 10); // jp nz NOT taken
        regs.a = regs.inc8(regs.a);
        m.step(0x1510, 4); // inc a -- A:=1
        mem.write8(regs.hl, regs.a);
        m.step(0x1511, 7); // ld (hl),a -- (0x6030):=1
        label = 0x158a;
        continue; // jp 0x158a
      case 0x1514:
        regs.b = regs.dec8(regs.b);
        m.step(0x1515, 4); // dec b
        if (regs.fZ) { label = 0x151d; continue; } // jp z,0x151d
        m.step(0x1518, 10); // jp z NOT taken
        regs.a = regs.b;
        m.step(0x1519, 4); // ld a,b
        mem.write8(regs.hl, regs.a);
        m.step(0x151a, 7); // ld (hl),a -- (0x6030):=B
        label = 0x158a;
        continue; // jp 0x158a
      case 0x151d:
        regs.bit(1, regs.a);
        m.step(0x151f, 8); // bit 1,a
        if (regs.fNZ) { label = 0x1539; continue; } // jp nz,0x1539
        m.step(0x1522, 10); // jp nz NOT taken
        regs.a = mem.read8(0x6035);
        m.step(0x1525, 13); // ld a,(0x6035)
        regs.a = regs.inc8(regs.a);
        m.step(0x1526, 4); // inc a
        regs.cp(0x1e);
        m.step(0x1528, 7); // cp 0x1e
        if (regs.fNZ) { label = 0x152d; continue; } // jp nz,0x152d
        m.step(0x152b, 10); // jp nz NOT taken
        regs.a = 0x00;
        m.step(0x152d, 7); // ld a,0x00 -- wrap 0x1E -> 0
      // fall into 0x152d
      case 0x152d:
        mem.write8(0x6035, regs.a);
        m.step(0x1530, 13); // ld (0x6035),a
        regs.c = regs.a;
        m.step(0x1531, 4); // ld c,a
        regs.b = 0x00;
        m.step(0x1533, 7); // ld b,0x00
        m.push16(0x1536);
        m.step(0x15fa, 17); // call 0x15fa -- render (INT)
        m.call(0x15fa);
        label = 0x158a;
        continue; // jp 0x158a
      case 0x1539:
        regs.a = mem.read8(0x6035);
        m.step(0x153c, 13); // ld a,(0x6035)
        regs.sub(0x01);
        m.step(0x153e, 7); // sub 0x01
        if (regs.fP) { label = 0x152d; continue; } // jp p,0x152d (SIGNED) -- >=0 store
        m.step(0x1541, 10); // jp p NOT taken
        regs.a = 0x1d;
        m.step(0x1543, 7); // ld a,0x1d -- underflow -> 0x1D
        label = 0x152d;
        continue; // jp 0x152d
      case 0x1546:
        regs.a = mem.read8(0x6035);
        m.step(0x1549, 13); // ld a,(0x6035)
        regs.cp(0x1c);
        m.step(0x154b, 7); // cp 0x1c
        if (regs.fZ) { label = 0x156d; continue; } // jp z,0x156d
        m.step(0x154e, 10); // jp z NOT taken
        regs.cp(0x1d);
        m.step(0x1550, 7); // cp 0x1d
        if (regs.fZ) { label = 0x15c6; continue; } // jp z,0x15c6 -- EXIT
        m.step(0x1553, 10); // jp z NOT taken
        regs.hl = mem.read16(0x6036);
        m.step(0x1556, 16); // ld hl,(0x6036)
        regs.bc = 0x7588;
        m.step(0x1559, 10); // ld bc,0x7588
        regs.and(regs.a);
        m.step(0x155a, 4); // and a -- clear carry for sbc
        regs.sbcHl(regs.bc);
        m.step(0x155c, 15); // sbc hl,bc
        if (regs.fZ) { label = 0x158a; continue; } // jp z,0x158a
        m.step(0x155f, 10); // jp z NOT taken
        regs.addHl(regs.bc);
        m.step(0x1560, 11); // add hl,bc -- restore hl
        regs.add(0x11);
        m.step(0x1562, 7); // add a,0x11
        mem.write8(regs.hl, regs.a);
        m.step(0x1563, 7); // ld (hl),a
        regs.bc = 0xffe0;
        m.step(0x1566, 10); // ld bc,0xffe0
        regs.addHl(regs.bc);
        m.step(0x1567, 11); // add hl,bc
      // fall into 0x1567
      case 0x1567:
        mem.write16(0x6036, regs.hl);
        m.step(0x156a, 16); // ld (0x6036),hl
        label = 0x158a;
        continue; // jp 0x158a
      case 0x156d:
        regs.hl = mem.read16(0x6036);
        m.step(0x1570, 16); // ld hl,(0x6036)
        regs.bc = 0x0020;
        m.step(0x1573, 10); // ld bc,0x0020
        regs.addHl(regs.bc);
        m.step(0x1574, 11); // add hl,bc
        regs.and(regs.a);
        m.step(0x1575, 4); // and a -- clear carry for sbc
        regs.bc = 0x7608;
        m.step(0x1578, 10); // ld bc,0x7608
        regs.sbcHl(regs.bc);
        m.step(0x157a, 15); // sbc hl,bc
        if (regs.fNZ) { label = 0x1586; continue; } // jp nz,0x1586
        m.step(0x157d, 10); // jp nz NOT taken
        regs.hl = 0x75e8;
        m.step(0x1580, 10); // ld hl,0x75e8
      // fall into 0x1580
      case 0x1580:
        regs.a = 0x10;
        m.step(0x1582, 7); // ld a,0x10
        mem.write8(regs.hl, regs.a);
        m.step(0x1583, 7); // ld (hl),a
        label = 0x1567;
        continue; // jp 0x1567
      case 0x1586:
        regs.addHl(regs.bc);
        m.step(0x1587, 11); // add hl,bc
        label = 0x1580;
        continue; // jp 0x1580
      case 0x158a:
        regs.hl = 0x6032;
        m.step(0x158d, 10); // ld hl,0x6032 -- sprite animate
        regs.decMem8(mem, regs.hl);
        m.step(0x158e, 11); // dec (hl) -- (0x6032)-- anim timer
        if (regs.fNZ) { label = 0x15f9; continue; } // jp nz,0x15f9
        m.step(0x1591, 10); // jp nz NOT taken
        regs.a = mem.read8(0x6031);
        m.step(0x1594, 13); // ld a,(0x6031)
        regs.and(regs.a);
        m.step(0x1595, 4); // and a
        if (regs.fNZ) { label = 0x15b8; continue; } // jp nz,0x15b8
        m.step(0x1598, 10); // jp nz NOT taken
        regs.a = 0x01;
        m.step(0x159a, 7); // ld a,0x01
        mem.write8(0x6031, regs.a);
        m.step(0x159d, 13); // ld (0x6031),a -- (0x6031):=1
        regs.de = 0x01bf;
        m.step(0x15a0, 10); // ld de,0x01bf -- digit source ptr
      // fall into 0x15a0
      case 0x15a0:
        regs.iy = mem.read16(0x6038);
        m.step(0x15a4, 20); // ld iy,(0x6038)
        regs.l = mem.read8((regs.iy + 0x04) & 0xffff);
        m.step(0x15a7, 19); // ld l,(iy+0x04)
        regs.h = mem.read8((regs.iy + 0x05) & 0xffff);
        m.step(0x15aa, 19); // ld h,(iy+0x05)
        m.push16(regs.hl);
        m.step(0x15ab, 11); // push hl
        regs.ix = m.pop16();
        m.step(0x15ad, 14); // pop ix -- IX := sprite ptr (iy+4/5)
        m.push16(0x15b0);
        m.step(0x057c, 17); // call 0x057c -- render digits
        m.call(0x057c);
        regs.a = 0x10;
        m.step(0x15b2, 7); // ld a,0x10
        mem.write8(0x6032, regs.a);
        m.step(0x15b5, 13); // ld (0x6032),a -- reload (0x6032):=0x10
        label = 0x15f9;
        continue; // jp 0x15f9
      case 0x15b8:
        regs.xor(regs.a);
        m.step(0x15b9, 4); // xor a
        mem.write8(0x6031, regs.a);
        m.step(0x15bc, 13); // ld (0x6031),a -- (0x6031):=0
        regs.de = mem.read16(0x6038);
        m.step(0x15c0, 20); // ld de,(0x6038)
        regs.de = (regs.de + 1) & 0xffff;
        m.step(0x15c1, 6); // inc de
        regs.de = (regs.de + 1) & 0xffff;
        m.step(0x15c2, 6); // inc de
        regs.de = (regs.de + 1) & 0xffff;
        m.step(0x15c3, 6); // inc de -- DE := (0x6038)+3
        label = 0x15a0;
        continue; // jp 0x15a0
      case 0x15c6:
        regs.de = mem.read16(0x6038);
        m.step(0x15ca, 20); // ld de,(0x6038) -- EXIT/cleanup
        regs.xor(regs.a);
        m.step(0x15cb, 4); // xor a
        mem.write8(regs.de, regs.a);
        m.step(0x15cc, 7); // ld (de),a -- clear the item slot
        regs.hl = 0x6009;
        m.step(0x15cf, 10); // ld hl,0x6009
        mem.write8(regs.hl, 0x80);
        m.step(0x15d1, 10); // ld (hl),0x80 -- (0x6009):=0x80
        regs.hl = (regs.hl + 1) & 0xffff;
        m.step(0x15d2, 6); // inc hl
        regs.decMem8(mem, regs.hl);
        m.step(0x15d3, 11); // dec (hl) -- (0x600A)-- PHASE DECREMENT
        regs.b = 0x0c;
        m.step(0x15d5, 7); // ld b,0x0c
        regs.hl = 0x75e8;
        m.step(0x15d8, 10); // ld hl,0x75e8
        regs.iy = mem.read16(0x603a);
        m.step(0x15dc, 20); // ld iy,(0x603a)
        regs.de = 0xffe0;
        m.step(0x15df, 10); // ld de,0xffe0
      // fall into 0x15df
      case 0x15df:
        regs.a = mem.read8(regs.hl);
        m.step(0x15e0, 7); // ld a,(hl) -- copy 0x0C cells (video->iy)
        mem.write8((regs.iy + 0x00) & 0xffff, regs.a);
        m.step(0x15e3, 19); // ld (iy+0x00),a
        regs.iy = (regs.iy + 1) & 0xffff;
        m.step(0x15e5, 10); // inc iy
        regs.addHl(regs.de);
        m.step(0x15e6, 11); // add hl,de
        regs.djnz();
        m.step(regs.b ? 0x15df : 0x15e8, regs.b ? 13 : 8); // djnz 0x15df
        if (regs.b) { label = 0x15df; continue; }
        regs.b = 0x05;
        m.step(0x15ea, 7); // ld b,0x05
        regs.de = 0x0314;
        m.step(0x15ed, 10); // ld de,0x0314 -- enqueue tasks 0x0314..0x0318
      // fall into 0x15ed
      case 0x15ed:
        m.push16(0x15f0);
        m.step(0x309f, 17); // call 0x309f
        m.call(0x309f);
        regs.de = (regs.de + 1) & 0xffff;
        m.step(0x15f1, 6); // inc de
        regs.djnz();
        m.step(regs.b ? 0x15ed : 0x15f3, regs.b ? 13 : 8); // djnz 0x15ed
        if (regs.b) { label = 0x15ed; continue; }
        regs.de = 0x031a;
        m.step(0x15f6, 10); // ld de,0x031a -- enqueue task 0x031A
        m.push16(0x15f9);
        m.step(0x309f, 17); // call 0x309f
        m.call(0x309f);
      // fall into 0x15f9
      case 0x15f9:
        m.ret(10); // ret @0x15F9 (the single ret; all paths converge here)
        return;
      default:
        throw new Error(`sub_1486: unreachable label 0x${label.toString(16)}`);
    }
  }
}
