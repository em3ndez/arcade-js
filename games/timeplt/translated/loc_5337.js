// SPDX-License-Identifier: GPL-3.0-only

// loc_5337  (ROM 0x5337-0x53D3, Time Pilot)
export function loc_5337(m) {
  const { regs, mem } = m;

  regs.a = mem.read8((regs.ix + 0x04) & 0xffff);
  m.step(0x533a, 19); // ld a,(ix+0x04)
  regs.add(0x07);
  m.step(0x533c, 7); // add a,0x07
  regs.b = regs.a;
  m.step(0x533d, 4); // ld b,a -- keep the biased coordinate
  regs.d = 0x28;
  m.step(0x533f, 7); // ld d,0x28
  regs.rlca();
  m.step(0x5340, 4); // rlca -- carry = bit 7
  regs.d = regs.rl(regs.d);
  m.step(0x5342, 8); // rl d -- shift it into D
  regs.rlca();
  m.step(0x5343, 4); // rlca -- carry = old bit 6
  regs.d = regs.rl(regs.d);
  m.step(0x5345, 8); // rl d
  regs.and(0xe0);
  m.step(0x5347, 7); // and 0xe0
  regs.e = regs.a;
  m.step(0x5348, 4); // ld e,a

  regs.a = mem.read8((regs.ix + 0x06) & 0xffff);
  m.step(0x534b, 19); // ld a,(ix+0x06)
  regs.add(0x07);
  m.step(0x534d, 7); // add a,0x07
  regs.c = regs.a;
  m.step(0x534e, 4); // ld c,a -- keep the biased coordinate
  regs.rrca();
  m.step(0x534f, 4); // rrca
  regs.rrca();
  m.step(0x5350, 4); // rrca
  regs.rrca();
  m.step(0x5351, 4); // rrca
  regs.and(0x1f);
  m.step(0x5353, 7); // and 0x1f
  regs.add(regs.e);
  m.step(0x5354, 4); // add a,e
  regs.e = regs.a;
  m.step(0x5355, 4); // ld e,a -- DE is now the destination cell

  regs.a = regs.c;
  m.step(0x5356, 4); // ld a,c
  regs.rlca();
  m.step(0x5357, 4); // rlca
  regs.rlca();
  m.step(0x5358, 4); // rlca
  regs.rlca();
  m.step(0x5359, 4); // rlca
  regs.and(0x38);
  m.step(0x535b, 7); // and 0x38
  regs.c = regs.a;
  m.step(0x535c, 4); // ld c,a -- low part of the table index
  regs.a = regs.b;
  m.step(0x535d, 4); // ld a,b -- back to the first coordinate
  regs.b = 0x00;
  m.step(0x535f, 7); // ld b,0x00
  regs.bit(2, regs.a);
  m.step(0x5361, 8); // bit 2,a
  if (regs.fZ) {
    m.step(0x5364, 12); // jr z,0x5364 taken
  } else {
    m.step(0x5363, 7); // jr z NOT taken
    regs.b = regs.inc8(regs.b);
    m.step(0x5364, 4); // inc b -- B = 1, i.e. +0x100 on the index
  }

  regs.rrca();
  m.step(0x5365, 4); // rrca
  regs.rrca();
  m.step(0x5366, 4); // rrca
  regs.and(0xc0);
  m.step(0x5368, 7); // and 0xc0
  regs.add(regs.c);
  m.step(0x5369, 4); // add a,c
  regs.c = regs.a;
  m.step(0x536a, 4); // ld c,a -- BC = the record index
  regs.hl = 0x53d4;
  m.step(0x536d, 10); // ld hl,0x53d4 -- the record table
  regs.addHl(regs.bc);
  m.step(0x536e, 11); // add hl,bc

  regs.a = mem.read8(regs.hl);
  m.step(0x536f, 7); // ld a,(hl) -- code
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x5370, 6); // inc hl
  regs.b = mem.read8(regs.hl);
  m.step(0x5371, 7); // ld b,(hl) -- attribute
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x5372, 6); // inc hl
  regs.and(regs.a);
  m.step(0x5373, 4); // and a -- Z iff the code is 0 (cell skipped)
  if (regs.fZ) {
    m.step(0x5385, 12); // jr z,0x5385 taken -- skip
  } else {
    m.step(0x5375, 7); // jr z NOT taken
    m.push16(regs.hl);
    m.step(0x5376, 11); // push hl
    regs.hl = mem.read16(0xae00);
    m.step(0x5379, 16); // ld hl,(0xae00) -- display-list write pointer
    mem.write8(regs.hl, regs.e);
    m.step(0x537a, 7); // ld (hl),e
    regs.l = regs.inc8(regs.l);
    m.step(0x537b, 4); // inc l
    mem.write8(regs.hl, regs.d);
    m.step(0x537c, 7); // ld (hl),d
    regs.l = regs.inc8(regs.l);
    m.step(0x537d, 4); // inc l
    mem.write8(regs.hl, regs.a);
    m.step(0x537e, 7); // ld (hl),a
    regs.l = regs.inc8(regs.l);
    m.step(0x537f, 4); // inc l
    mem.write8(regs.hl, regs.b);
    m.step(0x5380, 7); // ld (hl),b
    regs.l = regs.inc8(regs.l);
    m.step(0x5381, 4); // inc l
    mem.write16(0xae00, regs.hl);
    m.step(0x5384, 16); // ld (0xae00),hl
    regs.hl = m.pop16();
    m.step(0x5385, 10); // pop hl
  }

  regs.de = (regs.de + 1) & 0xffff;
  m.step(0x5386, 6); // inc de
  regs.a = mem.read8(regs.hl);
  m.step(0x5387, 7); // ld a,(hl) -- code
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x5388, 6); // inc hl
  regs.b = mem.read8(regs.hl);
  m.step(0x5389, 7); // ld b,(hl) -- attribute
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x538a, 6); // inc hl
  regs.and(regs.a);
  m.step(0x538b, 4); // and a
  if (regs.fZ) {
    m.step(0x539d, 12); // jr z,0x539d taken -- skip
  } else {
    m.step(0x538d, 7); // jr z NOT taken
    m.push16(regs.hl);
    m.step(0x538e, 11); // push hl
    regs.hl = mem.read16(0xae00);
    m.step(0x5391, 16); // ld hl,(0xae00)
    mem.write8(regs.hl, regs.e);
    m.step(0x5392, 7); // ld (hl),e
    regs.l = regs.inc8(regs.l);
    m.step(0x5393, 4); // inc l
    mem.write8(regs.hl, regs.d);
    m.step(0x5394, 7); // ld (hl),d
    regs.l = regs.inc8(regs.l);
    m.step(0x5395, 4); // inc l
    mem.write8(regs.hl, regs.a);
    m.step(0x5396, 7); // ld (hl),a
    regs.l = regs.inc8(regs.l);
    m.step(0x5397, 4); // inc l
    mem.write8(regs.hl, regs.b);
    m.step(0x5398, 7); // ld (hl),b
    regs.l = regs.inc8(regs.l);
    m.step(0x5399, 4); // inc l
    mem.write16(0xae00, regs.hl);
    m.step(0x539c, 16); // ld (0xae00),hl
    regs.hl = m.pop16();
    m.step(0x539d, 10); // pop hl
  }

  regs.a = regs.e;
  m.step(0x539e, 4); // ld a,e
  regs.add(0x1f);
  m.step(0x53a0, 7); // add a,0x1f
  regs.e = regs.a;
  m.step(0x53a1, 4); // ld e,a
  if (regs.fNC) {
    m.step(0x53a4, 12); // jr nc,0x53a4 taken
  } else {
    m.step(0x53a3, 7); // jr nc NOT taken
    regs.d = regs.inc8(regs.d);
    m.step(0x53a4, 4); // inc d -- propagate the carry by hand
  }

  regs.a = mem.read8(regs.hl);
  m.step(0x53a5, 7); // ld a,(hl) -- code
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x53a6, 6); // inc hl
  regs.b = mem.read8(regs.hl);
  m.step(0x53a7, 7); // ld b,(hl) -- attribute
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x53a8, 6); // inc hl
  regs.and(regs.a);
  m.step(0x53a9, 4); // and a
  if (regs.fZ) {
    m.step(0x53bb, 12); // jr z,0x53bb taken -- skip
  } else {
    m.step(0x53ab, 7); // jr z NOT taken
    m.push16(regs.hl);
    m.step(0x53ac, 11); // push hl
    regs.hl = mem.read16(0xae00);
    m.step(0x53af, 16); // ld hl,(0xae00)
    mem.write8(regs.hl, regs.e);
    m.step(0x53b0, 7); // ld (hl),e
    regs.l = regs.inc8(regs.l);
    m.step(0x53b1, 4); // inc l
    mem.write8(regs.hl, regs.d);
    m.step(0x53b2, 7); // ld (hl),d
    regs.l = regs.inc8(regs.l);
    m.step(0x53b3, 4); // inc l
    mem.write8(regs.hl, regs.a);
    m.step(0x53b4, 7); // ld (hl),a
    regs.l = regs.inc8(regs.l);
    m.step(0x53b5, 4); // inc l
    mem.write8(regs.hl, regs.b);
    m.step(0x53b6, 7); // ld (hl),b
    regs.l = regs.inc8(regs.l);
    m.step(0x53b7, 4); // inc l
    mem.write16(0xae00, regs.hl);
    m.step(0x53ba, 16); // ld (0xae00),hl
    regs.hl = m.pop16();
    m.step(0x53bb, 10); // pop hl
  }

  regs.de = (regs.de + 1) & 0xffff;
  m.step(0x53bc, 6); // inc de
  regs.a = mem.read8(regs.hl);
  m.step(0x53bd, 7); // ld a,(hl) -- code
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x53be, 6); // inc hl
  regs.b = mem.read8(regs.hl);
  m.step(0x53bf, 7); // ld b,(hl) -- attribute
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x53c0, 6); // inc hl
  regs.and(regs.a);
  m.step(0x53c1, 4); // and a
  if (regs.fZ) {
    m.step(0x53d3, 12); // jr z,0x53d3 taken -- skip
  } else {
    m.step(0x53c3, 7); // jr z NOT taken
    m.push16(regs.hl);
    m.step(0x53c4, 11); // push hl
    regs.hl = mem.read16(0xae00);
    m.step(0x53c7, 16); // ld hl,(0xae00)
    mem.write8(regs.hl, regs.e);
    m.step(0x53c8, 7); // ld (hl),e
    regs.l = regs.inc8(regs.l);
    m.step(0x53c9, 4); // inc l
    mem.write8(regs.hl, regs.d);
    m.step(0x53ca, 7); // ld (hl),d
    regs.l = regs.inc8(regs.l);
    m.step(0x53cb, 4); // inc l
    mem.write8(regs.hl, regs.a);
    m.step(0x53cc, 7); // ld (hl),a
    regs.l = regs.inc8(regs.l);
    m.step(0x53cd, 4); // inc l
    mem.write8(regs.hl, regs.b);
    m.step(0x53ce, 7); // ld (hl),b
    regs.l = regs.inc8(regs.l);
    m.step(0x53cf, 4); // inc l
    mem.write16(0xae00, regs.hl);
    m.step(0x53d2, 16); // ld (0xae00),hl
    regs.hl = m.pop16();
    m.step(0x53d3, 10); // pop hl
  }

  m.ret(10); // ret
}
