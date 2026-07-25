// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_4644  (ROM 0x4644–0x4672) — copies the active player's 5-byte state block
 * (stride 3) into the shared display slot at 0x8028.
 *
 *   4644  dd 21 28 80  ld   ix,0x8028
 *   4648  fd 21 29 80  ld   iy,0x8029
 *   464c  3a 02 80     ld   a,(0x8002)
 *   464f  3d           dec  a
 *   4650  28 02        jr   z,0x4654
 *   4652  fd 23        inc  iy
 *
 *   4654  fd 7e 00     ld   a,(iy+0x00)     ; loc_4654
 *   4657  dd 77 00     ld   (ix+0x00),a
 *   465a  fd 7e 03     ld   a,(iy+0x03)
 *   465d  dd 77 03     ld   (ix+0x03),a
 *   4660  fd 7e 06     ld   a,(iy+0x06)
 *   4663  dd 77 06     ld   (ix+0x06),a
 *   4666  fd 7e 09     ld   a,(iy+0x09)
 *   4669  dd 77 09     ld   (ix+0x09),a
 *   466c  fd 7e 0c     ld   a,(iy+0x0c)
 *   466f  dd 77 0c     ld   (ix+0x0c),a
 *
 *   4672  c9           ret                  ; loc_4672
 *
 * The destination base is 0x8028; the source base is 0x8029 when the current
 * player index at 0x8002 is 1 (the `dec a` makes it zero, so `jr z` skips the
 * bump) and 0x802A otherwise (`inc iy` advances past player 1's byte). Five
 * bytes are then copied at stride 3 — offsets 0, 3, 6, 9, 0x0C — so the shared
 * slot at 0x8028 is loaded with the active player's per-cell state. The sibling
 * loc_4632 does the reverse copy (save the shared slot back to the player).
 * `ld` moves touch no flags, so the flag residue at `ret` is the `dec a` result.
 */
export function loc_4644(m) {
  const { regs, mem } = m;

  regs.ix = 0x8028; // ld ix,0x8028 -- destination base
  m.step(0x4648, 14);
  regs.iy = 0x8029; // ld iy,0x8029 -- source base (player 1)
  m.step(0x464c, 14);
  regs.a = mem.read8(0x8002); // ld a,(0x8002) -- current player index
  m.step(0x464f, 13);
  regs.a = regs.dec8(regs.a); // dec a -- Z set iff player == 1
  m.step(0x4650, 4);
  if (regs.fZ) {
    // player 1: source stays 0x8029, skip the bump.
    m.step(0x4654, 12); // jr z taken -> loc_4654
  } else {
    m.step(0x4652, 7); // jr z not taken
    regs.iy = (regs.iy + 1) & 0xffff; // inc iy -- 16-bit INC, no flags; IY -> 0x802a
    m.step(0x4654, 10);
  }

  // loc_4654 -- copy 5 bytes at stride 3 from (iy+d) to (ix+d), d = 0,3,6,9,0x0c
  regs.a = mem.read8((regs.iy + 0x00) & 0xffff); // ld a,(iy+0x00)
  m.step(0x4657, 19);
  mem.write8((regs.ix + 0x00) & 0xffff, regs.a); // ld (ix+0x00),a
  m.step(0x465a, 19);
  regs.a = mem.read8((regs.iy + 0x03) & 0xffff); // ld a,(iy+0x03)
  m.step(0x465d, 19);
  mem.write8((regs.ix + 0x03) & 0xffff, regs.a); // ld (ix+0x03),a
  m.step(0x4660, 19);
  regs.a = mem.read8((regs.iy + 0x06) & 0xffff); // ld a,(iy+0x06)
  m.step(0x4663, 19);
  mem.write8((regs.ix + 0x06) & 0xffff, regs.a); // ld (ix+0x06),a
  m.step(0x4666, 19);
  regs.a = mem.read8((regs.iy + 0x09) & 0xffff); // ld a,(iy+0x09)
  m.step(0x4669, 19);
  mem.write8((regs.ix + 0x09) & 0xffff, regs.a); // ld (ix+0x09),a
  m.step(0x466c, 19);
  regs.a = mem.read8((regs.iy + 0x0c) & 0xffff); // ld a,(iy+0x0c)
  m.step(0x466f, 19);
  mem.write8((regs.ix + 0x0c) & 0xffff, regs.a); // ld (ix+0x0c),a
  m.step(0x4672, 19);

  // loc_4672
  m.ret(); // ret
}
