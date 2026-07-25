// SPDX-License-Identifier: GPL-3.0-only

/**
 * sub_06ac  (ROM 0x06AC–0x0737) — per-frame animator for 8 fixed screen cells,
 * indexed by the countdown at 0x805C.
 *
 *   06ac  06 03        ld   b,0x03
 *   06ae  0e 07        ld   c,0x07
 *   06b0  3a 5c 80     ld   a,(0x805c)
 *   06b3  3d           dec  a
 *   06b4  32 5c 80     ld   (0x805c),a
 *   06b7  fe 04        cp   0x04
 *   06b9  28 08        jr   z,0x06c3
 *   06bb  a7           and  a
 *   06bc  20 12        jr   nz,0x06d0
 *   06be  3e 08        ld   a,0x08
 *   06c0  32 5c 80     ld   (0x805c),a
 *
 *   06c3  21 fd 89     ld   hl,0x89fd        ; loc_06c3
 *   06c6  11 fd 91     ld   de,0x91fd
 *   06c9  1a           ld   a,(de)
 *   06ca  fe 3c        cp   0x3c
 *   06cc  28 64        jr   z,0x0732
 *   06ce  70           ld   (hl),b
 *   06cf  c9           ret
 *
 *   06d0  fe 07        cp   0x07            ; loc_06d0
 *   06d2  20 0d        jr   nz,0x06e1
 *   06d4  21 73 88     ld   hl,0x8873
 *   06d7  11 73 90     ld   de,0x9073
 *   06da  1a           ld   a,(de)
 *   06db  fe 3a        cp   0x3a
 *   06dd  28 53        jr   z,0x0732
 *   06df  71           ld   (hl),c
 *   06e0  c9           ret
 *
 *   06e1  fe 06        cp   0x06            ; loc_06e1
 *   06e3  20 0d        jr   nz,0x06f2
 *   06e5  21 5d 89     ld   hl,0x895d
 *   06e8  11 5d 91     ld   de,0x915d
 *   06eb  1a           ld   a,(de)
 *   06ec  fe 3b        cp   0x3b
 *   06ee  28 42        jr   z,0x0732
 *   06f0  70           ld   (hl),b
 *   06f1  c9           ret
 *
 *   06f2  fe 05        cp   0x05            ; loc_06f2
 *   06f4  20 0d        jr   nz,0x0703
 *   06f6  21 d9 88     ld   hl,0x88d9
 *   06f9  11 d9 90     ld   de,0x90d9
 *   06fc  1a           ld   a,(de)
 *   06fd  fe 3a        cp   0x3a
 *   06ff  28 31        jr   z,0x0732
 *   0701  71           ld   (hl),c
 *   0702  c9           ret
 *
 *   0703  fe 03        cp   0x03            ; loc_0703
 *   0705  20 0d        jr   nz,0x0714
 *   0707  21 b6 89     ld   hl,0x89b6
 *   070a  11 b6 91     ld   de,0x91b6
 *   070d  1a           ld   a,(de)
 *   070e  fe 3a        cp   0x3a
 *   0710  28 20        jr   z,0x0732
 *   0712  71           ld   (hl),c
 *   0713  c9           ret
 *
 *   0714  fe 02        cp   0x02            ; loc_0714
 *   0716  20 0d        jr   nz,0x0725
 *   0718  21 7d 8a     ld   hl,0x8a7d
 *   071b  11 7d 92     ld   de,0x927d
 *   071e  1a           ld   a,(de)
 *   071f  fe 3d        cp   0x3d
 *   0721  28 0f        jr   z,0x0732
 *   0723  70           ld   (hl),b
 *   0724  c9           ret
 *
 *   0725  21 3a 8b     ld   hl,0x8b3a       ; loc_0725
 *   0728  11 3a 93     ld   de,0x933a
 *   072b  1a           ld   a,(de)
 *   072c  fe 3a        cp   0x3a
 *   072e  28 02        jr   z,0x0732
 *   0730  71           ld   (hl),c
 *   0731  c9           ret
 *
 *   0732  7e           ld   a,(hl)          ; loc_0732
 *   0733  3c           inc  a
 *   0734  e6 07        and  0x07
 *   0736  77           ld   (hl),a
 *   0737  c9           ret
 *
 * Decrements the countdown at 0x805C once per call, wrapping 0 -> 8, and uses
 * its value (8..1) to select ONE of eight fixed screen cells. Each cell is a
 * (colour-RAM, video-RAM) address pair: it reads the tile currently on screen
 * at that cell (from the 0x90xx video RAM), and if the tile equals that cell's
 * "animate" glyph (0x3a–0x3d) it advances the cell's colour attribute by one
 * mod 8 (loc_0732 -- the colour-cycling flash); otherwise it forces the cell's
 * colour to a fixed value, 0x03 (B) or 0x07 (C). The counter value 0 (after the
 * wrap-to-8 write) and value 4 both land on the same cell (loc_06c3).
 */
export function sub_06ac(m) {
  const { regs, mem } = m;

  // loc_0732 -- shared tail: colour-cycle the selected cell (colour attr +1 mod 8).
  // HL already points at the cell's colour-RAM byte; reached by `jr z,0x0732`.
  const loc_0732 = () => {
    regs.a = mem.read8(regs.hl); // ld a,(hl)
    m.step(0x0733, 7);
    regs.a = regs.inc8(regs.a); // inc a
    m.step(0x0734, 4);
    regs.and(0x07); // and 0x07
    m.step(0x0736, 7);
    mem.write8(regs.hl, regs.a); // ld (hl),a
    m.step(0x0737, 7);
    m.ret(); // ret
  };

  // loc_06c3 -- the cell for counter == 4 (and for counter == 0 after wrap).
  const loc_06c3 = () => {
    regs.hl = 0x89fd; // ld hl,0x89fd
    m.step(0x06c6, 10);
    regs.de = 0x91fd; // ld de,0x91fd
    m.step(0x06c9, 10);
    regs.a = mem.read8(regs.de); // ld a,(de)
    m.step(0x06ca, 7);
    regs.cp(0x3c); // cp 0x3c
    m.step(0x06cc, 7);
    if (regs.fZ) {
      m.step(0x0732, 12); // jr z taken -> loc_0732
      return loc_0732();
    }
    m.step(0x06ce, 7); // jr z not taken
    mem.write8(regs.hl, regs.b); // ld (hl),b
    m.step(0x06cf, 7);
    m.ret(); // ret
  };

  regs.b = 0x03; // ld b,0x03
  m.step(0x06ae, 7);
  regs.c = 0x07; // ld c,0x07
  m.step(0x06b0, 7);
  regs.a = mem.read8(0x805c); // ld a,(0x805c)
  m.step(0x06b3, 13);
  regs.a = regs.dec8(regs.a); // dec a
  m.step(0x06b4, 4);
  mem.write8(0x805c, regs.a); // ld (0x805c),a
  m.step(0x06b7, 13);
  regs.cp(0x04); // cp 0x04
  m.step(0x06b9, 7);
  if (regs.fZ) {
    m.step(0x06c3, 12); // jr z taken -> loc_06c3
    return loc_06c3();
  }
  m.step(0x06bb, 7); // jr z not taken
  regs.and(regs.a); // and a
  m.step(0x06bc, 4);
  if (regs.fZ) {
    // counter reached 0: jr nz NOT taken -> wrap the counter back to 8, then
    // fall through into loc_06c3.
    m.step(0x06be, 7); // jr nz not taken
    regs.a = 0x08; // ld a,0x08
    m.step(0x06c0, 7);
    mem.write8(0x805c, regs.a); // ld (0x805c),a
    m.step(0x06c3, 13);
    return loc_06c3();
  }
  m.step(0x06d0, 12); // jr nz taken -> loc_06d0

  // loc_06d0 -- counter == 7
  regs.cp(0x07); // cp 0x07
  m.step(0x06d2, 7);
  if (regs.fZ) {
    m.step(0x06d4, 7); // jr nz not taken
    regs.hl = 0x8873; // ld hl,0x8873
    m.step(0x06d7, 10);
    regs.de = 0x9073; // ld de,0x9073
    m.step(0x06da, 10);
    regs.a = mem.read8(regs.de); // ld a,(de)
    m.step(0x06db, 7);
    regs.cp(0x3a); // cp 0x3a
    m.step(0x06dd, 7);
    if (regs.fZ) {
      m.step(0x0732, 12); // jr z taken -> loc_0732
      return loc_0732();
    }
    m.step(0x06df, 7); // jr z not taken
    mem.write8(regs.hl, regs.c); // ld (hl),c
    m.step(0x06e0, 7);
    return m.ret(); // ret
  }
  m.step(0x06e1, 12); // jr nz taken -> loc_06e1

  // loc_06e1 -- counter == 6
  regs.cp(0x06); // cp 0x06
  m.step(0x06e3, 7);
  if (regs.fZ) {
    m.step(0x06e5, 7); // jr nz not taken
    regs.hl = 0x895d; // ld hl,0x895d
    m.step(0x06e8, 10);
    regs.de = 0x915d; // ld de,0x915d
    m.step(0x06eb, 10);
    regs.a = mem.read8(regs.de); // ld a,(de)
    m.step(0x06ec, 7);
    regs.cp(0x3b); // cp 0x3b
    m.step(0x06ee, 7);
    if (regs.fZ) {
      m.step(0x0732, 12); // jr z taken -> loc_0732
      return loc_0732();
    }
    m.step(0x06f0, 7); // jr z not taken
    mem.write8(regs.hl, regs.b); // ld (hl),b
    m.step(0x06f1, 7);
    return m.ret(); // ret
  }
  m.step(0x06f2, 12); // jr nz taken -> loc_06f2

  // loc_06f2 -- counter == 5
  regs.cp(0x05); // cp 0x05
  m.step(0x06f4, 7);
  if (regs.fZ) {
    m.step(0x06f6, 7); // jr nz not taken
    regs.hl = 0x88d9; // ld hl,0x88d9
    m.step(0x06f9, 10);
    regs.de = 0x90d9; // ld de,0x90d9
    m.step(0x06fc, 10);
    regs.a = mem.read8(regs.de); // ld a,(de)
    m.step(0x06fd, 7);
    regs.cp(0x3a); // cp 0x3a
    m.step(0x06ff, 7);
    if (regs.fZ) {
      m.step(0x0732, 12); // jr z taken -> loc_0732
      return loc_0732();
    }
    m.step(0x0701, 7); // jr z not taken
    mem.write8(regs.hl, regs.c); // ld (hl),c
    m.step(0x0702, 7);
    return m.ret(); // ret
  }
  m.step(0x0703, 12); // jr nz taken -> loc_0703

  // loc_0703 -- counter == 3
  regs.cp(0x03); // cp 0x03
  m.step(0x0705, 7);
  if (regs.fZ) {
    m.step(0x0707, 7); // jr nz not taken
    regs.hl = 0x89b6; // ld hl,0x89b6
    m.step(0x070a, 10);
    regs.de = 0x91b6; // ld de,0x91b6
    m.step(0x070d, 10);
    regs.a = mem.read8(regs.de); // ld a,(de)
    m.step(0x070e, 7);
    regs.cp(0x3a); // cp 0x3a
    m.step(0x0710, 7);
    if (regs.fZ) {
      m.step(0x0732, 12); // jr z taken -> loc_0732
      return loc_0732();
    }
    m.step(0x0712, 7); // jr z not taken
    mem.write8(regs.hl, regs.c); // ld (hl),c
    m.step(0x0713, 7);
    return m.ret(); // ret
  }
  m.step(0x0714, 12); // jr nz taken -> loc_0714

  // loc_0714 -- counter == 2
  regs.cp(0x02); // cp 0x02
  m.step(0x0716, 7);
  if (regs.fZ) {
    m.step(0x0718, 7); // jr nz not taken
    regs.hl = 0x8a7d; // ld hl,0x8a7d
    m.step(0x071b, 10);
    regs.de = 0x927d; // ld de,0x927d
    m.step(0x071e, 10);
    regs.a = mem.read8(regs.de); // ld a,(de)
    m.step(0x071f, 7);
    regs.cp(0x3d); // cp 0x3d
    m.step(0x0721, 7);
    if (regs.fZ) {
      m.step(0x0732, 12); // jr z taken -> loc_0732
      return loc_0732();
    }
    m.step(0x0723, 7); // jr z not taken
    mem.write8(regs.hl, regs.b); // ld (hl),b
    m.step(0x0724, 7);
    return m.ret(); // ret
  }
  m.step(0x0725, 12); // jr nz taken -> loc_0725

  // loc_0725 -- default cell (counter == 1)
  regs.hl = 0x8b3a; // ld hl,0x8b3a
  m.step(0x0728, 10);
  regs.de = 0x933a; // ld de,0x933a
  m.step(0x072b, 10);
  regs.a = mem.read8(regs.de); // ld a,(de)
  m.step(0x072c, 7);
  regs.cp(0x3a); // cp 0x3a
  m.step(0x072e, 7);
  if (regs.fZ) {
    m.step(0x0732, 12); // jr z taken -> loc_0732
    return loc_0732();
  }
  m.step(0x0730, 7); // jr z not taken
  mem.write8(regs.hl, regs.c); // ld (hl),c
  m.step(0x0731, 7);
  m.ret(); // ret
}
