// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_1704  (ROM 0x1704-0x1869, The Pit) -- the tile/terrain interaction handler
 * for a moving actor (IX points at the actor's tile pair, D carries the move
 * direction in its low 3 bits). It reads the tile under the actor (ix+0), records
 * it to the scratch bytes 0x80a5/0x80a7 (and pre-clears 0x80a8), and dispatches on
 * that tile code held in B:
 *
 *   - Only when (D & 7) == 0 (an on-grid step): collectible tiles are consumed.
 *     Tile 0x3a calls 0x467b (+10 score sfx) and bumps counter 0x8081; tiles
 *     0x3b/0x3c/0x3d -- gated by 0x8078 already-set and 0x80bd -- call 0x4683
 *     (+20 score) and bump counter 0x8082. Either consumption reloads the actor's
 *     display cell (via the pointer at 0x806e) to 0x70 and falls into the walk-step
 *     block at loc_184a.
 *   - Otherwise (loc_175b): tile 0x26 is stashed to 0x8076, then a compare cascade
 *     classifies the current tile. Solid/blocking codes (0x2a,0x41,0xc1,0xc9,0x95,
 *     0xc4, and the 0x96-0x99 range) tail-jump straight to 0x1b5b. Codes in 0x71..
 *     0x9d index a direction-keyed table at 0x1b78 ((tile-0x71)*8 + (d&7)); a table
 *     MISMATCH on an on-grid step arms a 0x35 event (0x8069) with params 0x80a2=2 /
 *     0x80a4:=(0x80a3) and tail-jumps to 0x1b5b. The same check then repeats for the
 *     NEXT tile (ix+1) against table 0x1ce0 (loc_17db), with `dec d` applied on the
 *     0xc4 arm. The default fallthrough (loc_184a) advances the actor's animation
 *     phase 0x8068 by the per-step delta 0x806c, derives the terrain byte 0x8075
 *     (=(phase+3)&7) and the sprite code 0x8069 (0x32 or 0x33 by bit 1), then
 *     tail-jumps to 0x1b5b.
 *
 * Every non-consumed exit is a TAIL-jump to 0x1b5b (loc_1b5b builds the 4-byte
 * sprite record at 0x8220 from the actor block) -- `m.step(0x1b5b,10); return
 * m.call(0x1b5b)`, pushing nothing so loc_1b5b's own ret returns to OUR caller.
 * The `call 0x467b` / `call 0x4683` DO push their return address. Role is
 * best-effort; addresses, flags, cycle costs and control flow are exact, one JS
 * statement per Z80 instruction.
 *
 * The loc_* labels below are basic blocks of this ONE routine (none is referenced
 * from outside 0x1704-0x1869); they are driven by a label-dispatch loop (`next`
 * holds the ROM address of the block to run, exactly as loc_384a). The loop
 * charges NO T-states; only m.step does. Conditional costs follow the Z80: jr
 * taken 12 / not 7; jp cc 10 either way; call 17.
 *
 * loc_1704:
 *   1704  3e 00        ld   a,0x00
 *   1706  32 a8 80     ld   (0x80a8),a
 *   1709  dd 7e 00     ld   a,(ix+0x00)
 *   170c  32 a5 80     ld   (0x80a5),a
 *   170f  32 a7 80     ld   (0x80a7),a
 *   1712  47           ld   b,a
 *   1713  7a           ld   a,d
 *   1714  e6 07        and  0x07
 *   1716  20 43        jr   nz,0x175b
 *   1718  78           ld   a,b
 *   1719  fe 3a        cp   0x3a
 *   171b  20 0c        jr   nz,0x1729
 *   171d  cd 7b 46     call 0x467b        ; +10 score sfx
 *   1720  3a 81 80     ld   a,(0x8081)
 *   1723  3c           inc  a
 *   1724  32 81 80     ld   (0x8081),a
 *   1727  18 26        jr   0x174f
 * loc_1729:
 *   1729  fe 3b        cp   0x3b
 *   172b  28 08        jr   z,0x1735
 *   172d  fe 3c        cp   0x3c
 *   172f  28 04        jr   z,0x1735
 *   1731  fe 3d        cp   0x3d
 *   1733  20 26        jr   nz,0x175b
 * loc_1735:
 *   1735  3a 78 80     ld   a,(0x8078)
 *   1738  b7           or   a
 *   1739  20 0a        jr   nz,0x1745
 *   173b  3a bd 80     ld   a,(0x80bd)
 *   173e  b7           or   a
 *   173f  20 1a        jr   nz,0x175b
 *   1741  3c           inc  a
 *   1742  32 78 80     ld   (0x8078),a
 * loc_1745:
 *   1745  cd 83 46     call 0x4683        ; +20 score
 *   1748  3a 82 80     ld   a,(0x8082)
 *   174b  3c           inc  a
 *   174c  32 82 80     ld   (0x8082),a
 * loc_174f:
 *   174f  dd 2a 6e 80  ld   ix,(0x806e)
 *   1753  3e 70        ld   a,0x70
 *   1755  dd 77 00     ld   (ix+0x00),a
 *   1758  c3 4a 18     jp   0x184a
 * loc_175b:
 *   175b  78           ld   a,b
 *   175c  fe 26        cp   0x26
 *   175e  20 03        jr   nz,0x1763
 *   1760  32 76 80     ld   (0x8076),a
 * loc_1763:
 *   1763  78           ld   a,b
 *   1764  fe 2a        cp   0x2a
 *   1766  ca 5b 1b     jp   z,0x1b5b
 *   1769  fe 41        cp   0x41
 *   176b  ca 5b 1b     jp   z,0x1b5b
 *   176e  fe c1        cp   0xc1
 *   1770  ca 5b 1b     jp   z,0x1b5b
 *   1773  fe c9        cp   0xc9
 *   1775  ca 5b 1b     jp   z,0x1b5b
 *   1778  fe 95        cp   0x95
 *   177a  ca 5b 1b     jp   z,0x1b5b
 *   177d  fe c4        cp   0xc4
 *   177f  ca 5b 1b     jp   z,0x1b5b
 *   1782  fe c5        cp   0xc5
 *   1784  28 0d        jr   z,0x1793
 *   1786  fe 96        cp   0x96
 *   1788  38 0e        jr   c,0x1798
 *   178a  fe 9a        cp   0x9a
 *   178c  da 5b 1b     jp   c,0x1b5b
 *   178f  fe 9e        cp   0x9e
 *   1791  30 43        jr   nc,0x17d6
 * loc_1793:
 *   1793  cb 52        bit  2,d
 *   1795  ca 5b 1b     jp   z,0x1b5b
 * loc_1798:
 *   1798  fe 71        cp   0x71
 *   179a  38 3a        jr   c,0x17d6
 *   179c  fe 9e        cp   0x9e
 *   179e  30 36        jr   nc,0x17d6
 *   17a0  5f           ld   e,a
 *   17a1  d6 71        sub  0x71
 *   17a3  06 00        ld   b,0x00
 *   17a5  cb 27        sla  a
 *   17a7  cb 27        sla  a
 *   17a9  cb 27        sla  a
 *   17ab  cb 10        rl   b
 *   17ad  4f           ld   c,a
 *   17ae  7a           ld   a,d
 *   17af  e6 07        and  0x07
 *   17b1  b1           or   c
 *   17b2  4f           ld   c,a
 *   17b3  21 78 1b     ld   hl,0x1b78
 *   17b6  09           add  hl,bc
 *   17b7  7e           ld   a,(hl)
 *   17b8  32 a7 80     ld   (0x80a7),a
 *   17bb  bb           cp   e
 *   17bc  28 18        jr   z,0x17d6
 *   17be  7a           ld   a,d
 *   17bf  e6 07        and  0x07
 *   17c1  20 18        jr   nz,0x17db
 *   17c3  3a a3 80     ld   a,(0x80a3)
 *   17c6  32 a4 80     ld   (0x80a4),a
 *   17c9  3e 02        ld   a,0x02
 *   17cb  32 a2 80     ld   (0x80a2),a
 *   17ce  3e 35        ld   a,0x35
 *   17d0  32 69 80     ld   (0x8069),a
 *   17d3  c3 5b 1b     jp   0x1b5b
 * loc_17d6:
 *   17d6  7a           ld   a,d
 *   17d7  e6 07        and  0x07
 *   17d9  28 6f        jr   z,0x184a
 * loc_17db:
 *   17db  dd 7e 01     ld   a,(ix+0x01)
 *   17de  32 a6 80     ld   (0x80a6),a
 *   17e1  fe 2a        cp   0x2a
 *   17e3  ca 5b 1b     jp   z,0x1b5b
 *   17e6  fe 41        cp   0x41
 *   17e8  ca 5b 1b     jp   z,0x1b5b
 *   17eb  fe c1        cp   0xc1
 *   17ed  ca 5b 1b     jp   z,0x1b5b
 *   17f0  fe c4        cp   0xc4
 *   17f2  28 0d        jr   z,0x1801
 *   17f4  fe 95        cp   0x95
 *   17f6  ca 5b 1b     jp   z,0x1b5b
 *   17f9  fe 96        cp   0x96
 *   17fb  38 0a        jr   c,0x1807
 *   17fd  fe 9a        cp   0x9a
 *   17ff  30 3f        jr   nc,0x1840
 * loc_1801:
 *   1801  15           dec  d
 *   1802  cb 52        bit  2,d
 *   1804  c2 5b 1b     jp   nz,0x1b5b
 * loc_1807:
 *   1807  fe 71        cp   0x71
 *   1809  38 35        jr   c,0x1840
 *   180b  fe 9e        cp   0x9e
 *   180d  30 31        jr   nc,0x1840
 *   180f  5f           ld   e,a
 *   1810  d6 71        sub  0x71
 *   1812  06 00        ld   b,0x00
 *   1814  cb 27        sla  a
 *   1816  cb 27        sla  a
 *   1818  cb 27        sla  a
 *   181a  cb 10        rl   b
 *   181c  4f           ld   c,a
 *   181d  7a           ld   a,d
 *   181e  e6 07        and  0x07
 *   1820  b1           or   c
 *   1821  4f           ld   c,a
 *   1822  21 e0 1c     ld   hl,0x1ce0
 *   1825  09           add  hl,bc
 *   1826  7e           ld   a,(hl)
 *   1827  32 a8 80     ld   (0x80a8),a
 *   182a  bb           cp   e
 *   182b  28 13        jr   z,0x1840
 * loc_182d:
 *   182d  3a a3 80     ld   a,(0x80a3)
 *   1830  32 a4 80     ld   (0x80a4),a
 *   1833  3e 02        ld   a,0x02
 *   1835  32 a2 80     ld   (0x80a2),a
 *   1838  3e 35        ld   a,0x35
 *   183a  32 69 80     ld   (0x8069),a
 *   183d  c3 5b 1b     jp   0x1b5b
 * loc_1840:
 *   1840  3a a5 80     ld   a,(0x80a5)
 *   1843  5f           ld   e,a
 *   1844  3a a7 80     ld   a,(0x80a7)
 *   1847  bb           cp   e
 *   1848  20 e3        jr   nz,0x182d
 * loc_184a:
 *   184a  3a 6c 80     ld   a,(0x806c)
 *   184d  5f           ld   e,a
 *   184e  3a 68 80     ld   a,(0x8068)
 *   1851  83           add  a,e
 *   1852  32 68 80     ld   (0x8068),a
 *   1855  c6 03        add  a,0x03
 *   1857  e6 07        and  0x07
 *   1859  32 75 80     ld   (0x8075),a
 *   185c  e6 02        and  0x02
 *   185e  3e 32        ld   a,0x32
 *   1860  28 02        jr   z,0x1864
 *   1862  3e 33        ld   a,0x33
 * loc_1864:
 *   1864  32 69 80     ld   (0x8069),a
 *   1867  c3 5b 1b     jp   0x1b5b
 */
export function loc_1704(m) {
  const { regs, mem } = m;

  let next = 0x1704;
  for (;;) {
    switch (next) {
      case 0x1704: {
        regs.a = 0x00; m.step(0x1706, 7); // 1704  ld a,0x00
        mem.write8(0x80a8, regs.a); m.step(0x1709, 13); // 1706  ld (0x80a8),a -- pre-clear next-tile slot
        regs.a = mem.read8((regs.ix + 0x00) & 0xffff); m.step(0x170c, 19); // 1709  ld a,(ix+0x00) -- tile under actor
        mem.write8(0x80a5, regs.a); m.step(0x170f, 13); // 170c  ld (0x80a5),a
        mem.write8(0x80a7, regs.a); m.step(0x1712, 13); // 170f  ld (0x80a7),a
        regs.b = regs.a; m.step(0x1713, 4); // 1712  ld b,a -- keep tile in B
        regs.a = regs.d; m.step(0x1714, 4); // 1713  ld a,d -- direction/flags
        regs.and(0x07); m.step(0x1716, 7); // 1714  and 0x07 -- on-grid step? (sets Z read next)
        if (regs.fNZ) { m.step(0x175b, 12); next = 0x175b; break; } // 1716  jr nz,0x175b (off-grid -> classify)
        m.step(0x1718, 7); // 1716  jr nz,0x175b (not taken -- on grid)
        regs.a = regs.b; m.step(0x1719, 4); // 1718  ld a,b
        regs.cp(0x3a); m.step(0x171b, 7); // 1719  cp 0x3a
        if (regs.fNZ) { m.step(0x1729, 12); next = 0x1729; break; } // 171b  jr nz,0x1729 (not the 0x3a collectible)
        m.step(0x171d, 7); // 171b  jr nz,0x1729 (not taken -- tile == 0x3a)
        m.push16(0x1720); m.step(0x467b, 17); m.call(0x467b); // 171d  call 0x467b -- +10 score sfx
        regs.a = mem.read8(0x8081); m.step(0x1723, 13); // 1720  ld a,(0x8081)
        regs.a = regs.inc8(regs.a); m.step(0x1724, 4); // 1723  inc a
        mem.write8(0x8081, regs.a); m.step(0x1727, 13); // 1724  ld (0x8081),a -- bump 0x3a counter
        m.step(0x174f, 12); next = 0x174f; break; // 1727  jr 0x174f (consume)
      }
      case 0x1729: {
        regs.cp(0x3b); m.step(0x172b, 7); // 1729  cp 0x3b
        if (regs.fZ) { m.step(0x1735, 12); next = 0x1735; break; } // 172b  jr z,0x1735
        m.step(0x172d, 7); // 172b  jr z,0x1735 (not taken)
        regs.cp(0x3c); m.step(0x172f, 7); // 172d  cp 0x3c
        if (regs.fZ) { m.step(0x1735, 12); next = 0x1735; break; } // 172f  jr z,0x1735
        m.step(0x1731, 7); // 172f  jr z,0x1735 (not taken)
        regs.cp(0x3d); m.step(0x1733, 7); // 1731  cp 0x3d
        if (regs.fNZ) { m.step(0x175b, 12); next = 0x175b; break; } // 1733  jr nz,0x175b (none of 0x3b/0x3c/0x3d)
        m.step(0x1735, 7); next = 0x1735; break; // 1733  jr nz,0x175b (not taken -- tile == 0x3d, fall into loc_1735)
      }
      case 0x1735: {
        regs.a = mem.read8(0x8078); m.step(0x1738, 13); // 1735  ld a,(0x8078)
        regs.or(regs.a); m.step(0x1739, 4); // 1738  or a -- 0x8078 already set?
        if (regs.fNZ) { m.step(0x1745, 12); next = 0x1745; break; } // 1739  jr nz,0x1745 (already set -> just score)
        m.step(0x173b, 7); // 1739  jr nz,0x1745 (not taken)
        regs.a = mem.read8(0x80bd); m.step(0x173e, 13); // 173b  ld a,(0x80bd)
        regs.or(regs.a); m.step(0x173f, 4); // 173e  or a -- gate byte
        if (regs.fNZ) { m.step(0x175b, 12); next = 0x175b; break; } // 173f  jr nz,0x175b (gated off -> classify)
        m.step(0x1741, 7); // 173f  jr nz,0x175b (not taken)
        regs.a = regs.inc8(regs.a); m.step(0x1742, 4); // 1741  inc a -- A: 0 -> 1
        mem.write8(0x8078, regs.a); m.step(0x1745, 13); // 1742  ld (0x8078),a -- mark set, fall into loc_1745
        next = 0x1745; break;
      }
      case 0x1745: {
        m.push16(0x1748); m.step(0x4683, 17); m.call(0x4683); // 1745  call 0x4683 -- +20 score
        regs.a = mem.read8(0x8082); m.step(0x174b, 13); // 1748  ld a,(0x8082)
        regs.a = regs.inc8(regs.a); m.step(0x174c, 4); // 174b  inc a
        mem.write8(0x8082, regs.a); m.step(0x174f, 13); // 174c  ld (0x8082),a -- bump 0x3b/c/d counter
        next = 0x174f; break; // fall into loc_174f
      }
      case 0x174f: {
        regs.ix = mem.read16(0x806e); m.step(0x1753, 20); // 174f  ld ix,(0x806e) -- actor display cell ptr
        regs.a = 0x70; m.step(0x1755, 7); // 1753  ld a,0x70
        mem.write8((regs.ix + 0x00) & 0xffff, regs.a); m.step(0x1758, 19); // 1755  ld (ix+0x00),a -- blank consumed tile
        m.step(0x184a, 10); next = 0x184a; break; // 1758  jp 0x184a
      }
      case 0x175b: {
        regs.a = regs.b; m.step(0x175c, 4); // 175b  ld a,b -- tile
        regs.cp(0x26); m.step(0x175e, 7); // 175c  cp 0x26
        if (regs.fNZ) { m.step(0x1763, 12); next = 0x1763; break; } // 175e  jr nz,0x1763
        m.step(0x1760, 7); // 175e  jr nz,0x1763 (not taken -- tile == 0x26)
        mem.write8(0x8076, regs.a); m.step(0x1763, 13); // 1760  ld (0x8076),a -- stash 0x26 tile, fall into loc_1763
        next = 0x1763; break;
      }
      case 0x1763: {
        regs.a = regs.b; m.step(0x1764, 4); // 1763  ld a,b -- tile
        regs.cp(0x2a); m.step(0x1766, 7); // 1764  cp 0x2a
        if (regs.fZ) { m.step(0x1b5b, 10); return m.call(0x1b5b); } // 1766  jp z,0x1b5b (solid)
        m.step(0x1769, 10); // 1766  jp z,0x1b5b (not taken)
        regs.cp(0x41); m.step(0x176b, 7); // 1769  cp 0x41
        if (regs.fZ) { m.step(0x1b5b, 10); return m.call(0x1b5b); } // 176b  jp z,0x1b5b (solid)
        m.step(0x176e, 10); // 176b  jp z,0x1b5b (not taken)
        regs.cp(0xc1); m.step(0x1770, 7); // 176e  cp 0xc1
        if (regs.fZ) { m.step(0x1b5b, 10); return m.call(0x1b5b); } // 1770  jp z,0x1b5b (solid)
        m.step(0x1773, 10); // 1770  jp z,0x1b5b (not taken)
        regs.cp(0xc9); m.step(0x1775, 7); // 1773  cp 0xc9
        if (regs.fZ) { m.step(0x1b5b, 10); return m.call(0x1b5b); } // 1775  jp z,0x1b5b (solid)
        m.step(0x1778, 10); // 1775  jp z,0x1b5b (not taken)
        regs.cp(0x95); m.step(0x177a, 7); // 1778  cp 0x95
        if (regs.fZ) { m.step(0x1b5b, 10); return m.call(0x1b5b); } // 177a  jp z,0x1b5b (solid)
        m.step(0x177d, 10); // 177a  jp z,0x1b5b (not taken)
        regs.cp(0xc4); m.step(0x177f, 7); // 177d  cp 0xc4
        if (regs.fZ) { m.step(0x1b5b, 10); return m.call(0x1b5b); } // 177f  jp z,0x1b5b (solid)
        m.step(0x1782, 10); // 177f  jp z,0x1b5b (not taken)
        regs.cp(0xc5); m.step(0x1784, 7); // 1782  cp 0xc5
        if (regs.fZ) { m.step(0x1793, 12); next = 0x1793; break; } // 1784  jr z,0x1793
        m.step(0x1786, 7); // 1784  jr z,0x1793 (not taken)
        regs.cp(0x96); m.step(0x1788, 7); // 1786  cp 0x96
        if (regs.fC) { m.step(0x1798, 12); next = 0x1798; break; } // 1788  jr c,0x1798 (tile < 0x96 -> table check)
        m.step(0x178a, 7); // 1788  jr c,0x1798 (not taken)
        regs.cp(0x9a); m.step(0x178c, 7); // 178a  cp 0x9a
        if (regs.fC) { m.step(0x1b5b, 10); return m.call(0x1b5b); } // 178c  jp c,0x1b5b (0x96-0x99 solid)
        m.step(0x178f, 10); // 178c  jp c,0x1b5b (not taken)
        regs.cp(0x9e); m.step(0x1791, 7); // 178f  cp 0x9e
        if (regs.fNC) { m.step(0x17d6, 12); next = 0x17d6; break; } // 1791  jr nc,0x17d6 (tile >= 0x9e)
        m.step(0x1793, 7); next = 0x1793; break; // 1791  jr nc,0x17d6 (not taken -- 0x9a-0x9d, fall into loc_1793)
      }
      case 0x1793: {
        regs.bit(2, regs.d); m.step(0x1795, 8); // 1793  bit 2,d (Z = !bit2)
        if (regs.fZ) { m.step(0x1b5b, 10); return m.call(0x1b5b); } // 1795  jp z,0x1b5b (bit2 clear -> solid)
        m.step(0x1798, 10); next = 0x1798; break; // 1795  jp z,0x1b5b (not taken -- fall into loc_1798)
      }
      case 0x1798: {
        regs.cp(0x71); m.step(0x179a, 7); // 1798  cp 0x71
        if (regs.fC) { m.step(0x17d6, 12); next = 0x17d6; break; } // 179a  jr c,0x17d6 (tile < 0x71 -> passable)
        m.step(0x179c, 7); // 179a  jr c,0x17d6 (not taken)
        regs.cp(0x9e); m.step(0x179e, 7); // 179c  cp 0x9e
        if (regs.fNC) { m.step(0x17d6, 12); next = 0x17d6; break; } // 179e  jr nc,0x17d6 (tile >= 0x9e -> passable)
        m.step(0x17a0, 7); // 179e  jr nc,0x17d6 (not taken -- 0x71..0x9d)
        regs.e = regs.a; m.step(0x17a1, 4); // 17a0  ld e,a -- keep tile for compare
        regs.sub(0x71); m.step(0x17a3, 7); // 17a1  sub 0x71 -- table row index
        regs.b = 0x00; m.step(0x17a5, 7); // 17a3  ld b,0x00
        regs.a = regs.sla(regs.a); m.step(0x17a7, 8); // 17a5  sla a
        regs.a = regs.sla(regs.a); m.step(0x17a9, 8); // 17a7  sla a
        regs.a = regs.sla(regs.a); m.step(0x17ab, 8); // 17a9  sla a -- row*8, carry -> bit8
        regs.b = regs.rl(regs.b); m.step(0x17ad, 8); // 17ab  rl b -- capture bit8 into B
        regs.c = regs.a; m.step(0x17ae, 4); // 17ad  ld c,a
        regs.a = regs.d; m.step(0x17af, 4); // 17ae  ld a,d
        regs.and(0x07); m.step(0x17b1, 7); // 17af  and 0x07 -- direction column
        regs.or(regs.c); m.step(0x17b2, 4); // 17b1  or c -- BC = row*8 + dir
        regs.c = regs.a; m.step(0x17b3, 4); // 17b2  ld c,a
        regs.hl = 0x1b78; m.step(0x17b6, 10); // 17b3  ld hl,0x1b78 -- current-tile table
        regs.addHl(regs.bc); m.step(0x17b7, 11); // 17b6  add hl,bc
        regs.a = mem.read8(regs.hl); m.step(0x17b8, 7); // 17b7  ld a,(hl) -- expected tile
        mem.write8(0x80a7, regs.a); m.step(0x17bb, 13); // 17b8  ld (0x80a7),a
        regs.cp(regs.e); m.step(0x17bc, 4); // 17bb  cp e -- matches actual?
        if (regs.fZ) { m.step(0x17d6, 12); next = 0x17d6; break; } // 17bc  jr z,0x17d6 (match -> passable)
        m.step(0x17be, 7); // 17bc  jr z,0x17d6 (not taken -- mismatch)
        regs.a = regs.d; m.step(0x17bf, 4); // 17be  ld a,d
        regs.and(0x07); m.step(0x17c1, 7); // 17bf  and 0x07 -- on-grid step?
        if (regs.fNZ) { m.step(0x17db, 12); next = 0x17db; break; } // 17c1  jr nz,0x17db (off-grid -> check next tile)
        m.step(0x17c3, 7); // 17c1  jr nz,0x17db (not taken)
        regs.a = mem.read8(0x80a3); m.step(0x17c6, 13); // 17c3  ld a,(0x80a3)
        mem.write8(0x80a4, regs.a); m.step(0x17c9, 13); // 17c6  ld (0x80a4),a
        regs.a = 0x02; m.step(0x17cb, 7); // 17c9  ld a,0x02
        mem.write8(0x80a2, regs.a); m.step(0x17ce, 13); // 17cb  ld (0x80a2),a
        regs.a = 0x35; m.step(0x17d0, 7); // 17ce  ld a,0x35
        mem.write8(0x8069, regs.a); m.step(0x17d3, 13); // 17d0  ld (0x8069),a -- arm 0x35 event
        m.step(0x1b5b, 10); return m.call(0x1b5b); // 17d3  jp 0x1b5b
      }
      case 0x17d6: {
        regs.a = regs.d; m.step(0x17d7, 4); // 17d6  ld a,d
        regs.and(0x07); m.step(0x17d9, 7); // 17d7  and 0x07 -- on-grid step?
        if (regs.fZ) { m.step(0x184a, 12); next = 0x184a; break; } // 17d9  jr z,0x184a (on grid -> walk-step)
        m.step(0x17db, 7); next = 0x17db; break; // 17d9  jr z,0x184a (not taken -- fall into loc_17db)
      }
      case 0x17db: {
        regs.a = mem.read8((regs.ix + 0x01) & 0xffff); m.step(0x17de, 19); // 17db  ld a,(ix+0x01) -- next tile
        mem.write8(0x80a6, regs.a); m.step(0x17e1, 13); // 17de  ld (0x80a6),a
        regs.cp(0x2a); m.step(0x17e3, 7); // 17e1  cp 0x2a
        if (regs.fZ) { m.step(0x1b5b, 10); return m.call(0x1b5b); } // 17e3  jp z,0x1b5b (solid)
        m.step(0x17e6, 10); // 17e3  jp z,0x1b5b (not taken)
        regs.cp(0x41); m.step(0x17e8, 7); // 17e6  cp 0x41
        if (regs.fZ) { m.step(0x1b5b, 10); return m.call(0x1b5b); } // 17e8  jp z,0x1b5b (solid)
        m.step(0x17eb, 10); // 17e8  jp z,0x1b5b (not taken)
        regs.cp(0xc1); m.step(0x17ed, 7); // 17eb  cp 0xc1
        if (regs.fZ) { m.step(0x1b5b, 10); return m.call(0x1b5b); } // 17ed  jp z,0x1b5b (solid)
        m.step(0x17f0, 10); // 17ed  jp z,0x1b5b (not taken)
        regs.cp(0xc4); m.step(0x17f2, 7); // 17f0  cp 0xc4
        if (regs.fZ) { m.step(0x1801, 12); next = 0x1801; break; } // 17f2  jr z,0x1801
        m.step(0x17f4, 7); // 17f2  jr z,0x1801 (not taken)
        regs.cp(0x95); m.step(0x17f6, 7); // 17f4  cp 0x95
        if (regs.fZ) { m.step(0x1b5b, 10); return m.call(0x1b5b); } // 17f6  jp z,0x1b5b (solid)
        m.step(0x17f9, 10); // 17f6  jp z,0x1b5b (not taken)
        regs.cp(0x96); m.step(0x17fb, 7); // 17f9  cp 0x96
        if (regs.fC) { m.step(0x1807, 12); next = 0x1807; break; } // 17fb  jr c,0x1807 (next < 0x96 -> table check)
        m.step(0x17fd, 7); // 17fb  jr c,0x1807 (not taken)
        regs.cp(0x9a); m.step(0x17ff, 7); // 17fd  cp 0x9a
        if (regs.fNC) { m.step(0x1840, 12); next = 0x1840; break; } // 17ff  jr nc,0x1840 (next >= 0x9a)
        m.step(0x1801, 7); next = 0x1801; break; // 17ff  jr nc,0x1840 (not taken -- 0x96-0x99, fall into loc_1801)
      }
      case 0x1801: {
        regs.d = regs.dec8(regs.d); m.step(0x1802, 4); // 1801  dec d
        regs.bit(2, regs.d); m.step(0x1804, 8); // 1802  bit 2,d (Z = !bit2)
        if (regs.fNZ) { m.step(0x1b5b, 10); return m.call(0x1b5b); } // 1804  jp nz,0x1b5b (bit2 set -> solid)
        m.step(0x1807, 10); next = 0x1807; break; // 1804  jp nz,0x1b5b (not taken -- fall into loc_1807)
      }
      case 0x1807: {
        regs.cp(0x71); m.step(0x1809, 7); // 1807  cp 0x71
        if (regs.fC) { m.step(0x1840, 12); next = 0x1840; break; } // 1809  jr c,0x1840 (next < 0x71 -> passable)
        m.step(0x180b, 7); // 1809  jr c,0x1840 (not taken)
        regs.cp(0x9e); m.step(0x180d, 7); // 180b  cp 0x9e
        if (regs.fNC) { m.step(0x1840, 12); next = 0x1840; break; } // 180d  jr nc,0x1840 (next >= 0x9e -> passable)
        m.step(0x180f, 7); // 180d  jr nc,0x1840 (not taken -- 0x71..0x9d)
        regs.e = regs.a; m.step(0x1810, 4); // 180f  ld e,a -- keep next tile
        regs.sub(0x71); m.step(0x1812, 7); // 1810  sub 0x71 -- table row index
        regs.b = 0x00; m.step(0x1814, 7); // 1812  ld b,0x00
        regs.a = regs.sla(regs.a); m.step(0x1816, 8); // 1814  sla a
        regs.a = regs.sla(regs.a); m.step(0x1818, 8); // 1816  sla a
        regs.a = regs.sla(regs.a); m.step(0x181a, 8); // 1818  sla a -- row*8, carry -> bit8
        regs.b = regs.rl(regs.b); m.step(0x181c, 8); // 181a  rl b -- capture bit8 into B
        regs.c = regs.a; m.step(0x181d, 4); // 181c  ld c,a
        regs.a = regs.d; m.step(0x181e, 4); // 181d  ld a,d
        regs.and(0x07); m.step(0x1820, 7); // 181e  and 0x07 -- direction column
        regs.or(regs.c); m.step(0x1821, 4); // 1820  or c -- BC = row*8 + dir
        regs.c = regs.a; m.step(0x1822, 4); // 1821  ld c,a
        regs.hl = 0x1ce0; m.step(0x1825, 10); // 1822  ld hl,0x1ce0 -- next-tile table
        regs.addHl(regs.bc); m.step(0x1826, 11); // 1825  add hl,bc
        regs.a = mem.read8(regs.hl); m.step(0x1827, 7); // 1826  ld a,(hl) -- expected next tile
        mem.write8(0x80a8, regs.a); m.step(0x182a, 13); // 1827  ld (0x80a8),a
        regs.cp(regs.e); m.step(0x182b, 4); // 182a  cp e -- matches actual?
        if (regs.fZ) { m.step(0x1840, 12); next = 0x1840; break; } // 182b  jr z,0x1840 (match -> passable)
        m.step(0x182d, 7); next = 0x182d; break; // 182b  jr z,0x1840 (not taken -- mismatch, fall into loc_182d)
      }
      case 0x182d: {
        regs.a = mem.read8(0x80a3); m.step(0x1830, 13); // 182d  ld a,(0x80a3)
        mem.write8(0x80a4, regs.a); m.step(0x1833, 13); // 1830  ld (0x80a4),a
        regs.a = 0x02; m.step(0x1835, 7); // 1833  ld a,0x02
        mem.write8(0x80a2, regs.a); m.step(0x1838, 13); // 1835  ld (0x80a2),a
        regs.a = 0x35; m.step(0x183a, 7); // 1838  ld a,0x35
        mem.write8(0x8069, regs.a); m.step(0x183d, 13); // 183a  ld (0x8069),a -- arm 0x35 event
        m.step(0x1b5b, 10); return m.call(0x1b5b); // 183d  jp 0x1b5b
      }
      case 0x1840: {
        regs.a = mem.read8(0x80a5); m.step(0x1843, 13); // 1840  ld a,(0x80a5) -- saved current tile
        regs.e = regs.a; m.step(0x1844, 4); // 1843  ld e,a
        regs.a = mem.read8(0x80a7); m.step(0x1847, 13); // 1844  ld a,(0x80a7) -- possibly table-overwritten
        regs.cp(regs.e); m.step(0x1848, 4); // 1847  cp e
        if (regs.fNZ) { m.step(0x182d, 12); next = 0x182d; break; } // 1848  jr nz,0x182d (differs -> arm 0x35 event)
        m.step(0x184a, 7); next = 0x184a; break; // 1848  jr nz,0x182d (not taken -- fall into loc_184a)
      }
      case 0x184a: {
        regs.a = mem.read8(0x806c); m.step(0x184d, 13); // 184a  ld a,(0x806c) -- per-step delta
        regs.e = regs.a; m.step(0x184e, 4); // 184d  ld e,a
        regs.a = mem.read8(0x8068); m.step(0x1851, 13); // 184e  ld a,(0x8068) -- animation phase
        regs.add(regs.e); m.step(0x1852, 4); // 1851  add a,e -- advance phase
        mem.write8(0x8068, regs.a); m.step(0x1855, 13); // 1852  ld (0x8068),a
        regs.add(0x03); m.step(0x1857, 7); // 1855  add a,0x03
        regs.and(0x07); m.step(0x1859, 7); // 1857  and 0x07
        mem.write8(0x8075, regs.a); m.step(0x185c, 13); // 1859  ld (0x8075),a -- terrain byte
        regs.and(0x02); m.step(0x185e, 7); // 185c  and 0x02 -- bit1 (sets Z read below)
        regs.a = 0x32; m.step(0x1860, 7); // 185e  ld a,0x32 (flags survive from and 0x02)
        if (regs.fZ) { m.step(0x1864, 12); next = 0x1864; break; } // 1860  jr z,0x1864 (bit1 clear -> keep 0x32)
        m.step(0x1862, 7); // 1860  jr z,0x1864 (not taken)
        regs.a = 0x33; m.step(0x1864, 7); // 1862  ld a,0x33 (bit1 set -> 0x33)
        next = 0x1864; break; // fall into loc_1864
      }
      case 0x1864: {
        mem.write8(0x8069, regs.a); m.step(0x1867, 13); // 1864  ld (0x8069),a -- sprite code
        m.step(0x1b5b, 10); return m.call(0x1b5b); // 1867  jp 0x1b5b
      }
      default:
        throw new Error(
          "loc_1704: dispatch to non-block address 0x" + next.toString(16),
        );
    }
  }
}
