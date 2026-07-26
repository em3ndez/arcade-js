// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_4d3a  (ROM 0x4d3a-0x4df7) — inserts the candidate 16-bit value into the
 * descending three-entry high-score table, pushing lower entries (and their
 * 3-byte initials fields) down a rank and stamping the freed initials with 0xFF.
 *
 * The candidate is a big-endian pair: D = high byte @0x8034, E = low byte
 * @0x8031, so DE is the value to place. The table holds three ranked slots,
 * highest first, each a 16-bit little-endian value plus a 3-byte initials field:
 *   rank 1 (top): value @0x803c, initials @0x8039..0x803b
 *   rank 2      : value @0x8041, initials @0x803e..0x8040
 *   rank 3 (low): value @0x8046, initials @0x8043..0x8045
 * 0x8048 is set to which rank (1/2/3) the value landed at; the caller
 * (loc_4cbf) pre-clears it to 0 so "no placement" reads as 0.
 *
 * The compare walks from the bottom rank up. DE is first checked against rank 3
 * (0x8046): if DE <= that slot, the value does not make the table and the
 * routine returns untouched (the two early `ret c` and the `ret z`). Once DE
 * beats rank 3, each higher rank it also beats causes that slot's value AND its
 * initials to shift DOWN one rank before the test continues, so the loser is
 * preserved one place lower. Where DE finally settles, its slot value is written
 * (DE) and that slot's initials are filled with 0xFF placeholders (the player
 * will type them in). Ties (`jr z`) place DE just BELOW the equal entry.
 *
 * CONTROL FLOW. The internal labels 0x4d4b..0x4dc1 are reached only by this
 * routine's own `jr`s (verified: no external reference to any of them), so they
 * are modelled as address-suffixed helpers called directly (`loc_4d3a_4d4b`),
 * never registered at their own address — the routine registry's name regex
 * rejects the embedded second underscore, so a bare `m.call(0x4d60)` can never
 * resolve here. Every exit is a plain `ret` (`m.ret()`); the conditional exits
 * `ret c`/`ret z` are charged 11 T taken / 5 T not-taken.
 *
 *   4d3a  2a 46 80     ld   hl,(0x8046)   ; rank-3 slot value
 *   4d3d  3a 31 80     ld   a,(0x8031)
 *   4d40  5f           ld   e,a           ; E = candidate low
 *   4d41  3a 34 80     ld   a,(0x8034)
 *   4d44  57           ld   d,a           ; D = candidate high
 *   4d45  bc           cp   h
 *   4d46  d8           ret  c             ; DE high < rank3 high -> no place
 *   4d47  28 02        jr   z,0x4d4b
 *   4d49  30 04        jr   nc,0x4d4f
 * loc_4d4b:
 *   4d4b  7b           ld   a,e
 *   4d4c  bd           cp   l
 *   4d4d  c8           ret  z             ; DE == rank3 -> no place
 *   4d4e  d8           ret  c             ; DE < rank3  -> no place
 * loc_4d4f:                                ; DE > rank3, compare rank 2
 *   4d4f  2a 41 80     ld   hl,(0x8041)
 *   4d52  7a           ld   a,d
 *   4d53  bc           cp   h
 *   4d54  38 0a        jr   c,0x4d60
 *   4d56  28 02        jr   z,0x4d5a
 *   4d58  30 1f        jr   nc,0x4d79
 * loc_4d5a:
 *   4d5a  7b           ld   a,e
 *   4d5b  bd           cp   l
 *   4d5c  28 02        jr   z,0x4d60
 *   4d5e  30 19        jr   nc,0x4d79
 * loc_4d60:                                ; rank3 < DE <= rank2 -> land at rank 3
 *   4d60  ed 53 46 80  ld   (0x8046),de
 *   4d64  3e 03        ld   a,0x03
 *   4d66  32 48 80     ld   (0x8048),a    ; landed rank = 3
 *   4d69  3e ff        ld   a,0xff
 *   4d6b  dd 21 43 80  ld   ix,0x8043
 *   4d6f  dd 77 00     ld   (ix+0x00),a   ; rank-3 initials = 0xff x3
 *   4d72  dd 77 01     ld   (ix+0x01),a
 *   4d75  dd 77 02     ld   (ix+0x02),a
 *   4d78  c9           ret
 * loc_4d79:                                ; DE > rank2 -> push rank2 down to rank3
 *   4d79  22 46 80     ld   (0x8046),hl   ; old rank-2 value -> rank-3 slot
 *   4d7c  dd 21 43 80  ld   ix,0x8043
 *   4d80  fd 21 3e 80  ld   iy,0x803e
 *   4d84  fd 7e 00     ld   a,(iy+0x00)   ; rank-2 initials -> rank-3 initials
 *   4d87  dd 77 00     ld   (ix+0x00),a
 *   4d8a  fd 7e 01     ld   a,(iy+0x01)
 *   4d8d  dd 77 01     ld   (ix+0x01),a
 *   4d90  fd 7e 02     ld   a,(iy+0x02)
 *   4d93  dd 77 02     ld   (ix+0x02),a
 *   4d96  2a 3c 80     ld   hl,(0x803c)   ; rank-1 slot value
 *   4d99  7a           ld   a,d
 *   4d9a  bc           cp   h
 *   4d9b  38 0a        jr   c,0x4da7
 *   4d9d  28 02        jr   z,0x4da1
 *   4d9f  30 20        jr   nc,0x4dc1
 * loc_4da1:
 *   4da1  7b           ld   a,e
 *   4da2  bd           cp   l
 *   4da3  28 02        jr   z,0x4da7
 *   4da5  30 1a        jr   nc,0x4dc1
 * loc_4da7:                                ; rank2 < DE <= rank1 -> land at rank 2
 *   4da7  ed 53 41 80  ld   (0x8041),de
 *   4dab  3e 02        ld   a,0x02
 *   4dad  32 48 80     ld   (0x8048),a    ; landed rank = 2
 *   4db0  dd 21 3e 80  ld   ix,0x803e
 *   4db4  dd 36 00 ff  ld   (ix+0x00),0xff ; rank-2 initials = 0xff x3
 *   4db8  dd 36 01 ff  ld   (ix+0x01),0xff
 *   4dbc  dd 36 02 ff  ld   (ix+0x02),0xff
 *   4dc0  c9           ret
 * loc_4dc1:                                ; DE > rank1 -> push rank1 down to rank2, land at rank 1
 *   4dc1  22 41 80     ld   (0x8041),hl   ; old rank-1 value -> rank-2 slot
 *   4dc4  fd 21 39 80  ld   iy,0x8039
 *   4dc8  dd 21 3e 80  ld   ix,0x803e
 *   4dcc  fd 7e 00     ld   a,(iy+0x00)   ; rank-1 initials -> rank-2 initials
 *   4dcf  dd 77 00     ld   (ix+0x00),a
 *   4dd2  fd 7e 01     ld   a,(iy+0x01)
 *   4dd5  dd 77 01     ld   (ix+0x01),a
 *   4dd8  fd 7e 02     ld   a,(iy+0x02)
 *   4ddb  dd 77 02     ld   (ix+0x02),a
 *   4dde  ed 53 3c 80  ld   (0x803c),de   ; DE -> rank-1 slot
 *   4de2  3e 01        ld   a,0x01
 *   4de4  32 48 80     ld   (0x8048),a    ; landed rank = 1
 *   4de7  dd 21 39 80  ld   ix,0x8039
 *   4deb  dd 36 00 ff  ld   (ix+0x00),0xff ; rank-1 initials = 0xff x3
 *   4def  dd 36 01 ff  ld   (ix+0x01),0xff
 *   4df3  dd 36 02 ff  ld   (ix+0x02),0xff
 *   4df7  c9           ret
 */
export function loc_4d3a(m) {
  const { regs, mem } = m;

  regs.hl = mem.read16(0x8046);
  m.step(0x4d3d, 16); // ld hl,(0x8046) -- rank-3 slot value
  regs.a = mem.read8(0x8031);
  m.step(0x4d40, 13); // ld a,(0x8031)
  regs.e = regs.a;
  m.step(0x4d41, 4); // ld e,a -- candidate low byte
  regs.a = mem.read8(0x8034);
  m.step(0x4d44, 13); // ld a,(0x8034)
  regs.d = regs.a;
  m.step(0x4d45, 4); // ld d,a -- candidate high byte; DE = candidate value
  regs.cp(regs.h);
  m.step(0x4d46, 4); // cp h -- candidate high vs rank-3 high
  if (regs.fC) {
    m.ret(11); // ret c taken -- candidate high < rank3 high, no placement
    return;
  }
  m.step(0x4d47, 5); // ret c not taken
  if (regs.fZ) {
    m.step(0x4d4b, 12); // jr z taken -- high bytes equal, compare low
    return loc_4d3a_4d4b(m);
  }
  m.step(0x4d49, 7); // jr z not taken
  if (regs.fNC) {
    m.step(0x4d4f, 12); // jr nc taken -- candidate high > rank3 high, beats rank 3
    return loc_4d3a_4d4f(m);
  }
  m.step(0x4d4b, 7); // jr nc not taken -- fall into loc_4d4b
  return loc_4d3a_4d4b(m);
}

/**
 * loc_4d3a_4d4b  (ROM 0x4d4b-0x4d4e) — the high bytes tied; compare the low byte.
 * Equal or below rank 3 returns (no placement); above falls into loc_4d4f.
 */
export function loc_4d3a_4d4b(m) {
  const { regs } = m;

  regs.a = regs.e;
  m.step(0x4d4c, 4); // ld a,e -- candidate low byte
  regs.cp(regs.l);
  m.step(0x4d4d, 4); // cp l -- vs rank-3 low
  if (regs.fZ) {
    m.ret(11); // ret z taken -- DE == rank3, already on the table, no placement
    return;
  }
  m.step(0x4d4e, 5); // ret z not taken
  if (regs.fC) {
    m.ret(11); // ret c taken -- DE < rank3, no placement
    return;
  }
  m.step(0x4d4f, 5); // ret c not taken -- DE > rank3, fall into loc_4d4f
  return loc_4d3a_4d4f(m);
}

/**
 * loc_4d3a_4d4f  (ROM 0x4d4f-0x4d59) — DE beats rank 3; compare it against the
 * rank-2 slot value (0x8041). Below/equal rank 2 -> land at rank 3 (loc_4d60);
 * above rank 2 -> loc_4d79 to push rank 2 down.
 */
export function loc_4d3a_4d4f(m) {
  const { regs, mem } = m;

  regs.hl = mem.read16(0x8041);
  m.step(0x4d52, 16); // ld hl,(0x8041) -- rank-2 slot value
  regs.a = regs.d;
  m.step(0x4d53, 4); // ld a,d -- candidate high
  regs.cp(regs.h);
  m.step(0x4d54, 4); // cp h -- vs rank-2 high
  if (regs.fC) {
    m.step(0x4d60, 12); // jr c taken -- candidate high < rank2 high, land at rank 3
    return loc_4d3a_4d60(m);
  }
  m.step(0x4d56, 7); // jr c not taken
  if (regs.fZ) {
    m.step(0x4d5a, 12); // jr z taken -- high bytes equal, compare low
    return loc_4d3a_4d5a(m);
  }
  m.step(0x4d58, 7); // jr z not taken
  if (regs.fNC) {
    m.step(0x4d79, 12); // jr nc taken -- candidate high > rank2 high, beats rank 2
    return loc_4d3a_4d79(m);
  }
  m.step(0x4d5a, 7); // jr nc not taken -- fall into loc_4d5a
  return loc_4d3a_4d5a(m);
}

/**
 * loc_4d3a_4d5a  (ROM 0x4d5a-0x4d5f) — rank-2 high bytes tied; compare the low
 * byte. Equal or below -> land at rank 3 (loc_4d60); above -> loc_4d79.
 */
export function loc_4d3a_4d5a(m) {
  const { regs } = m;

  regs.a = regs.e;
  m.step(0x4d5b, 4); // ld a,e -- candidate low
  regs.cp(regs.l);
  m.step(0x4d5c, 4); // cp l -- vs rank-2 low
  if (regs.fZ) {
    m.step(0x4d60, 12); // jr z taken -- DE == rank2, place just below at rank 3
    return loc_4d3a_4d60(m);
  }
  m.step(0x4d5e, 7); // jr z not taken
  if (regs.fNC) {
    m.step(0x4d79, 12); // jr nc taken -- DE > rank2, beats rank 2
    return loc_4d3a_4d79(m);
  }
  m.step(0x4d60, 7); // jr nc not taken -- DE < rank2, fall into loc_4d60
  return loc_4d3a_4d60(m);
}

/**
 * loc_4d3a_4d60  (ROM 0x4d60-0x4d78) — land the candidate at rank 3: store DE at
 * 0x8046, mark 0x8048 = 3, and stamp the rank-3 initials (0x8043..0x8045) 0xFF.
 */
export function loc_4d3a_4d60(m) {
  const { regs, mem } = m;

  mem.write16(0x8046, regs.de);
  m.step(0x4d64, 20); // ld (0x8046),de -- candidate lands at rank 3
  regs.a = 0x03;
  m.step(0x4d66, 7); // ld a,0x03
  mem.write8(0x8048, regs.a);
  m.step(0x4d69, 13); // ld (0x8048),a -- landed rank = 3
  regs.a = 0xff;
  m.step(0x4d6b, 7); // ld a,0xff
  regs.ix = 0x8043;
  m.step(0x4d6f, 14); // ld ix,0x8043 -- rank-3 initials field
  mem.write8(regs.ix, regs.a);
  m.step(0x4d72, 19); // ld (ix+0x00),a
  mem.write8((regs.ix + 1) & 0xffff, regs.a);
  m.step(0x4d75, 19); // ld (ix+0x01),a
  mem.write8((regs.ix + 2) & 0xffff, regs.a);
  m.step(0x4d78, 19); // ld (ix+0x02),a -- initials = 0xff x3
  m.ret(); // 4d78  ret
}

/**
 * loc_4d3a_4d79  (ROM 0x4d79-0x4da0) — the candidate beats rank 2, so shift the
 * old rank-2 value (still in HL) and its initials DOWN to rank 3, then compare
 * the candidate against the rank-1 slot value (0x803c).
 */
export function loc_4d3a_4d79(m) {
  const { regs, mem } = m;

  mem.write16(0x8046, regs.hl);
  m.step(0x4d7c, 16); // ld (0x8046),hl -- old rank-2 value drops to rank-3 slot
  regs.ix = 0x8043;
  m.step(0x4d80, 14); // ld ix,0x8043 -- rank-3 initials (destination)
  regs.iy = 0x803e;
  m.step(0x4d84, 14); // ld iy,0x803e -- rank-2 initials (source)
  regs.a = mem.read8(regs.iy);
  m.step(0x4d87, 19); // ld a,(iy+0x00)
  mem.write8(regs.ix, regs.a);
  m.step(0x4d8a, 19); // ld (ix+0x00),a
  regs.a = mem.read8((regs.iy + 1) & 0xffff);
  m.step(0x4d8d, 19); // ld a,(iy+0x01)
  mem.write8((regs.ix + 1) & 0xffff, regs.a);
  m.step(0x4d90, 19); // ld (ix+0x01),a
  regs.a = mem.read8((regs.iy + 2) & 0xffff);
  m.step(0x4d93, 19); // ld a,(iy+0x02)
  mem.write8((regs.ix + 2) & 0xffff, regs.a);
  m.step(0x4d96, 19); // ld (ix+0x02),a -- rank-2 initials copied down to rank 3
  regs.hl = mem.read16(0x803c);
  m.step(0x4d99, 16); // ld hl,(0x803c) -- rank-1 slot value
  regs.a = regs.d;
  m.step(0x4d9a, 4); // ld a,d -- candidate high
  regs.cp(regs.h);
  m.step(0x4d9b, 4); // cp h -- vs rank-1 high
  if (regs.fC) {
    m.step(0x4da7, 12); // jr c taken -- candidate high < rank1 high, land at rank 2
    return loc_4d3a_4da7(m);
  }
  m.step(0x4d9d, 7); // jr c not taken
  if (regs.fZ) {
    m.step(0x4da1, 12); // jr z taken -- high bytes equal, compare low
    return loc_4d3a_4da1(m);
  }
  m.step(0x4d9f, 7); // jr z not taken
  if (regs.fNC) {
    m.step(0x4dc1, 12); // jr nc taken -- candidate high > rank1 high, beats rank 1
    return loc_4d3a_4dc1(m);
  }
  m.step(0x4da1, 7); // jr nc not taken -- fall into loc_4da1
  return loc_4d3a_4da1(m);
}

/**
 * loc_4d3a_4da1  (ROM 0x4da1-0x4da6) — rank-1 high bytes tied; compare the low
 * byte. Equal or below -> land at rank 2 (loc_4da7); above -> loc_4dc1.
 */
export function loc_4d3a_4da1(m) {
  const { regs } = m;

  regs.a = regs.e;
  m.step(0x4da2, 4); // ld a,e -- candidate low
  regs.cp(regs.l);
  m.step(0x4da3, 4); // cp l -- vs rank-1 low
  if (regs.fZ) {
    m.step(0x4da7, 12); // jr z taken -- DE == rank1, place just below at rank 2
    return loc_4d3a_4da7(m);
  }
  m.step(0x4da5, 7); // jr z not taken
  if (regs.fNC) {
    m.step(0x4dc1, 12); // jr nc taken -- DE > rank1, beats rank 1
    return loc_4d3a_4dc1(m);
  }
  m.step(0x4da7, 7); // jr nc not taken -- DE < rank1, fall into loc_4da7
  return loc_4d3a_4da7(m);
}

/**
 * loc_4d3a_4da7  (ROM 0x4da7-0x4dc0) — land the candidate at rank 2: store DE at
 * 0x8041, mark 0x8048 = 2, and stamp the rank-2 initials (0x803e..0x8040) 0xFF.
 */
export function loc_4d3a_4da7(m) {
  const { regs, mem } = m;

  mem.write16(0x8041, regs.de);
  m.step(0x4dab, 20); // ld (0x8041),de -- candidate lands at rank 2
  regs.a = 0x02;
  m.step(0x4dad, 7); // ld a,0x02
  mem.write8(0x8048, regs.a);
  m.step(0x4db0, 13); // ld (0x8048),a -- landed rank = 2
  regs.ix = 0x803e;
  m.step(0x4db4, 14); // ld ix,0x803e -- rank-2 initials field
  mem.write8(regs.ix, 0xff);
  m.step(0x4db8, 19); // ld (ix+0x00),0xff
  mem.write8((regs.ix + 1) & 0xffff, 0xff);
  m.step(0x4dbc, 19); // ld (ix+0x01),0xff
  mem.write8((regs.ix + 2) & 0xffff, 0xff);
  m.step(0x4dc0, 19); // ld (ix+0x02),0xff -- initials = 0xff x3
  m.ret(); // 4dc0  ret
}

/**
 * loc_4d3a_4dc1  (ROM 0x4dc1-0x4df7) — the candidate beats rank 1 (the top). Push
 * the old rank-1 value (still in HL) and its initials DOWN to rank 2, then land
 * the candidate at rank 1: store DE at 0x803c, mark 0x8048 = 1, and stamp the
 * rank-1 initials (0x8039..0x803b) 0xFF.
 */
export function loc_4d3a_4dc1(m) {
  const { regs, mem } = m;

  mem.write16(0x8041, regs.hl);
  m.step(0x4dc4, 16); // ld (0x8041),hl -- old rank-1 value drops to rank-2 slot
  regs.iy = 0x8039;
  m.step(0x4dc8, 14); // ld iy,0x8039 -- rank-1 initials (source)
  regs.ix = 0x803e;
  m.step(0x4dcc, 14); // ld ix,0x803e -- rank-2 initials (destination)
  regs.a = mem.read8(regs.iy);
  m.step(0x4dcf, 19); // ld a,(iy+0x00)
  mem.write8(regs.ix, regs.a);
  m.step(0x4dd2, 19); // ld (ix+0x00),a
  regs.a = mem.read8((regs.iy + 1) & 0xffff);
  m.step(0x4dd5, 19); // ld a,(iy+0x01)
  mem.write8((regs.ix + 1) & 0xffff, regs.a);
  m.step(0x4dd8, 19); // ld (ix+0x01),a
  regs.a = mem.read8((regs.iy + 2) & 0xffff);
  m.step(0x4ddb, 19); // ld a,(iy+0x02)
  mem.write8((regs.ix + 2) & 0xffff, regs.a);
  m.step(0x4dde, 19); // ld (ix+0x02),a -- rank-1 initials copied down to rank 2
  mem.write16(0x803c, regs.de);
  m.step(0x4de2, 20); // ld (0x803c),de -- candidate lands at rank 1 (top)
  regs.a = 0x01;
  m.step(0x4de4, 7); // ld a,0x01
  mem.write8(0x8048, regs.a);
  m.step(0x4de7, 13); // ld (0x8048),a -- landed rank = 1
  regs.ix = 0x8039;
  m.step(0x4deb, 14); // ld ix,0x8039 -- rank-1 initials field
  mem.write8(regs.ix, 0xff);
  m.step(0x4def, 19); // ld (ix+0x00),0xff
  mem.write8((regs.ix + 1) & 0xffff, 0xff);
  m.step(0x4df3, 19); // ld (ix+0x01),0xff
  mem.write8((regs.ix + 2) & 0xffff, 0xff);
  m.step(0x4df7, 19); // ld (ix+0x02),0xff -- initials = 0xff x3
  m.ret(); // 4df7  ret
}
