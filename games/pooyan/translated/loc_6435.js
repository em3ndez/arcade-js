// SPDX-License-Identifier: GPL-3.0-only

// loc_6435  (ROM 0x6435-0x64bd) -- proximity/collision scan for the actor at IY. Selects the object
// table by 0x8f50 (player), then scans B=3 objects: an object is a hit when it is active (mem[HL]!=0)
// and within +/-7 of IY in both X and Y (a 5- or -2-pixel bias per 0x881f). The scan body at 0x644b
// loops through the 0x6429 latch (IX +=4, HL +=0x18, djnz); no hit in 3 tries returns to the caller.
// On a hit the object is reset (bytes 0/1/2 and +0x11=0x20), a state byte is set at 0x8d1b/0x8d1c
// (per `ld a,i`), effects are enqueued (loc_381e, loc_0ef5, rst 0x38), a counter at 0x8f52 is bumped,
// and control falls through into loc_64be. The 0x6429 latch is inlined here (a jr/djnz loop, not a
// call); loc_6429.js is the same code as a standalone unit.
export function loc_6435(m) {
  const { regs, mem } = m;

  regs.ix = 0x888c;            m.step(0x6439, 14); // ld ix,0x888c
  regs.hl = 0x8c48;            m.step(0x643c, 10); // ld hl,0x8c48
  regs.a = mem.read8(0x8f50);  m.step(0x643f, 13); // ld a,(0x8f50)
  regs.and(regs.a);            m.step(0x6440, 4);
  if (regs.fZ) {
    m.step(0x6449, 12); // jr z,0x6449 -- player-1 tables
  } else {
    m.step(0x6442, 7);
    regs.ix = 0x887c;          m.step(0x6446, 14); // ld ix,0x887c -- player-2 tables
    regs.hl = 0x8be8;          m.step(0x6449, 10); // ld hl,0x8be8
  }
  regs.b = 0x03;               m.step(0x644b, 7); // ld b,0x03

  for (;;) { // loc_644b: scan body
    regs.a = mem.read8(regs.hl); m.step(0x644c, 7); // ld a,(hl)
    regs.and(regs.a);            m.step(0x644d, 4);
    let advance = regs.fZ;
    if (advance) {
      m.step(0x6429, 12); // jr z,0x6429 -- empty slot
    } else {
      m.step(0x644f, 7);
      regs.e = 0x05;             m.step(0x6451, 7); // ld e,0x05
      regs.a = mem.read8(0x881f); m.step(0x6454, 13); // ld a,(0x881f)
      regs.and(regs.a);          m.step(0x6455, 4);
      if (regs.fNZ) {
        m.step(0x6459, 12); // jr nz,0x6459
      } else {
        m.step(0x6457, 7);
        regs.e = 0xfe;           m.step(0x6459, 7); // ld e,0xfe
      }
      regs.a = mem.read8((regs.ix + 0) & 0xffff); m.step(0x645c, 19); // ld a,(ix+0x00)
      regs.add(regs.e);          m.step(0x645d, 4); // add a,e
      regs.e = regs.a;           m.step(0x645e, 4); // ld e,a  (biased object X)
      regs.a = mem.read8((regs.ix + 2) & 0xffff); m.step(0x6461, 19); // ld a,(ix+0x02)
      regs.add(0x08);            m.step(0x6463, 7); // add a,0x08
      regs.d = regs.a;           m.step(0x6464, 4); // ld d,a  (biased object Y)
      regs.a = mem.read8((regs.iy + 0) & 0xffff); m.step(0x6467, 19); // ld a,(iy+0x00)
      regs.sub(regs.e);          m.step(0x6468, 4); // sub e
      if (regs.fNC) {
        m.step(0x646c, 12);
      } else {
        m.step(0x646a, 7);
        regs.neg();              m.step(0x646c, 8); // neg -- |dx|
      }
      regs.cp(0x07);             m.step(0x646e, 7); // cp 0x07
      if (regs.fNC) {
        m.step(0x6429, 12); // jr nc,0x6429 -- too far in X
        advance = true;
      } else {
        m.step(0x6470, 7);
        regs.a = mem.read8((regs.iy + 2) & 0xffff); m.step(0x6473, 19); // ld a,(iy+0x02)
        regs.add(0x08);          m.step(0x6475, 7); // add a,0x08
        regs.sub(regs.d);        m.step(0x6476, 4); // sub d
        if (regs.fNC) {
          m.step(0x647a, 12);
        } else {
          m.step(0x6478, 7);
          regs.neg();            m.step(0x647a, 8); // neg -- |dy|
        }
        regs.cp(0x07);           m.step(0x647c, 7); // cp 0x07
        if (regs.fNC) {
          m.step(0x6429, 12); // jr nc,0x6429 -- too far in Y
          advance = true;
        } else {
          m.step(0x647e, 7); // jr nc not taken -- HIT
        }
      }
    }

    if (advance) { // loc_6429 latch (inlined): IX +=4, HL +=0x18, djnz
      regs.de = 0x0004;          m.step(0x642c, 10);
      regs.addIx(regs.de);       m.step(0x642e, 15);
      regs.de = 0x0018;          m.step(0x6431, 10);
      regs.addHl(regs.de);       m.step(0x6432, 11);
      if (regs.djnz() !== 0) {
        m.step(0x644b, 13); // djnz taken -- next object
        continue;
      }
      m.step(0x6434, 8); // djnz not taken -- no hit
      m.ret();
      return;
    }
    break; // HIT -> fall out to the 0x647e handler
  }

  // loc_647e: colliding object found (HL points at it) -- reset it and enqueue effects
  m.push16(regs.hl);           m.step(0x647f, 11); // push hl
  regs.ix = m.pop16();         m.step(0x6481, 14); // pop ix -- IX = HL
  mem.write8((regs.ix + 0) & 0xffff, 0x00);    m.step(0x6485, 19); // ld (ix+0x00),0x00
  mem.write8((regs.ix + 1) & 0xffff, 0x01);    m.step(0x6489, 19); // ld (ix+0x01),0x01
  mem.write8((regs.ix + 2) & 0xffff, 0x02);    m.step(0x648d, 19); // ld (ix+0x02),0x02
  mem.write8((regs.ix + 0x11) & 0xffff, 0x20); m.step(0x6491, 19); // ld (ix+0x11),0x20
  regs.de = 0x000f;            m.step(0x6494, 10);
  regs.hl = 0x8d1b;            m.step(0x6497, 10); // ld hl,0x8d1b
  regs.ldAI();                 m.step(0x6499, 9); // ld a,i
  regs.and(regs.a);            m.step(0x649a, 4);
  if (regs.fZ) {
    m.step(0x649f, 12); // jr z,0x649f
  } else {
    m.step(0x649c, 7);
    regs.hl = 0x8d1c;          m.step(0x649f, 10); // ld hl,0x8d1c
  }
  mem.write8(regs.hl, 0x01);   m.step(0x64a1, 10); // ld (hl),0x01
  regs.de = 0x64df;            m.step(0x64a4, 10); // ld de,0x64df

  m.push16(0x64a7);
  m.step(0x381e, 17); // 64a4  call 0x381e
  m.call(0x381e);

  m.push16(0x64aa);
  m.step(0x0ef5, 17); // 64a7  call 0x0ef5
  m.call(0x0ef5);

  regs.a = mem.read8(0x8f50);  m.step(0x64ad, 13); // ld a,(0x8f50)
  regs.and(regs.a);            m.step(0x64ae, 4);
  if (regs.fNZ) {
    m.step(0x64b4, 12); // jr nz,0x64b4 -- skip the sound enqueue
  } else {
    m.step(0x64b0, 7);
    regs.de = 0x0315;          m.step(0x64b3, 10); // ld de,0x0315
    m.push16(0x64b4);
    m.step(0x0038, 11); // 64b3  rst 0x38 -> loc_0038
    m.call(0x0038);
  }

  regs.hl = 0x8f52;            m.step(0x64b7, 10); // ld hl,0x8f52
  regs.incMem8(mem, regs.hl);  m.step(0x64b8, 11); // inc (hl)
  regs.de = 0x0bc2;            m.step(0x64bb, 10); // ld de,0x0bc2
  regs.hl = 0x64d0;            m.step(0x64be, 10); // ld hl,0x64d0 -- then fall into loc_64be
  return m.call(0x64be);
}
