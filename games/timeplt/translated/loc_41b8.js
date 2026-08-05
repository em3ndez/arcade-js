// SPDX-License-Identifier: GPL-3.0-only

// loc_41b8  (ROM 0x41B8-0x41EB, Time Pilot)
export function loc_41b8(m) {
  const { regs, mem } = m;

  m.push16(regs.bc);
  m.step(0x41b9, 11); // push bc

  regs.a = mem.read8(0xa980);
  m.step(0x41bc, 13); // ld a,(0xa980) -- the frame counter
  regs.and(0x0f);
  m.step(0x41be, 7); // and 0x0f

  if (regs.fNZ) {
    m.step(0x41df, 12); // jr nz,0x41df taken -- not a re-aim frame
  } else {
    m.step(0x41c0, 7); // jr nz NOT taken

    regs.hl = 0xac75;
    m.step(0x41c3, 10); // ld hl,0xac75
    const ea41c3 = (regs.ix + 0x0f) & 0xffff;
    regs.bit(0, mem.read8(ea41c3), (ea41c3 >> 8) & 0xff); // INDEXED: F3/F5 from the EA high byte
    m.step(0x41c7, 20); // bit 0,(ix+0x0f)
    if (regs.fNZ) {
      m.step(0x41cc, 12); // jr nz,0x41cc taken -- keep 0xAC75
    } else {
      m.step(0x41c9, 7); // jr nz NOT taken
      regs.hl = 0xac79;
      m.step(0x41cc, 10); // ld hl,0xac79 -- the other parameter block
    }

    m.push16(0x41cf);
    m.step(0x33b8, 17); // call 0x33b8 -- returns a byte in A
    m.call(0x33b8);

    regs.b = regs.a;
    m.step(0x41d0, 4); // ld b,a -- parked across the block below
    regs.a = regs.d;
    m.step(0x41d1, 4); // ld a,d
    regs.cp(0x10);
    m.step(0x41d3, 7); // cp 0x10

    if (regs.fNC) {
      m.step(0x41dc, 12); // jr nc,0x41dc taken
    } else {
      m.step(0x41d5, 7); // jr nc NOT taken

      regs.exAf(); // AF <-> AF'
      m.step(0x41d6, 4); // ex af,af'
      regs.cp(0x10);
      m.step(0x41d8, 7); // cp 0x10 -- on the shadow accumulator
      if (regs.fC) {
        m.push16(0x41db);
        m.step(0x41ec, 17); // call c,0x41ec taken
        m.call(0x41ec);
      } else {
        m.step(0x41db, 10); // call c NOT taken
      }
      regs.exAf();
      m.step(0x41dc, 4); // ex af,af' -- main AF back
    }

    mem.write8((regs.ix + 0x01) & 0xffff, regs.b);
    m.step(0x41df, 19); // ld (ix+0x01),b
  }

  m.push16(0x41e2);
  m.step(0x421f, 17); // call 0x421f
  m.call(0x421f);

  m.push16(0x41e5);
  m.step(0x58b6, 17); // call 0x58b6
  m.call(0x58b6);

  m.push16(0x41e8);
  m.step(0x41f1, 17); // call 0x41f1
  m.call(0x41f1);

  regs.bc = m.pop16();
  m.step(0x41e9, 10); // pop bc

  m.step(0x2b83, 10); // jp 0x2b83 -- TAIL, nothing pushed
  return m.call(0x2b83);
}
