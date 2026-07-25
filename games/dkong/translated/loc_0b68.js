// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_0b68  (ROM 0x0B68–0x0BB2) — walk 0x63C4 table, render records, count down.
 */
export function loc_0b68(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x601a);
  m.step(0x0b6b, 13); // ld a,(0x601a)
  regs.rrca();
  m.step(0x0b6c, 4); // rrca
  if (regs.fC) {
    m.ret(11); // ret c -- gate
    return;
  }
  m.step(0x0b6d, 5); // ret c NOT taken

  regs.hl = mem.read16(0x63c4); // INDIRECT walk pointer
  m.step(0x0b70, 16); // ld hl,(0x63c4)
  regs.a = mem.read8(regs.hl);
  m.step(0x0b71, 7); // ld a,(hl)
  regs.cp(0x7f);
  m.step(0x0b73, 7); // cp 0x7f

  if (!regs.fZ) {
    m.step(0x0b76, 10); // jp z NOT taken
    regs.hl = (regs.hl + 1) & 0xffff;
    m.step(0x0b77, 6); // inc hl
    mem.write16(0x63c4, regs.hl); // advance the walk pointer
    m.step(0x0b7a, 16);
    regs.hl = 0x690b;
    m.step(0x0b7d, 10); // ld hl,0x690b
    regs.c = regs.a;
    m.step(0x0b7e, 4); // ld c,a
    m.push16(0x0b7f);
    m.step(0x0038, 11); // rst 0x38 -- add the table byte
    m.call(0x0038);
    regs.hl = 0x6908;
    m.step(0x0b82, 10); // ld hl,0x6908
    regs.c = 0xff;
    m.step(0x0b84, 7); // ld c,0xff -- adds -1
    m.push16(0x0b85);
    m.step(0x0038, 11); // rst 0x38
    m.call(0x0038);
    m.ret();
    return;
  }
  m.step(0x0b86, 10); // jp z,0x0b86 -- the 0x7F sentinel

  regs.hl = 0x38cb;
  m.step(0x0b89, 10); // ld hl,0x38cb
  mem.write16(0x63c4, regs.hl); // RESET the walk pointer -- loop the table
  m.step(0x0b8c, 16);
  regs.a = 0x03;
  m.step(0x0b8e, 7); // ld a,0x03
  mem.write8(0x6082, regs.a);
  m.step(0x0b91, 13); // ld (0x6082),a
  regs.hl = 0x38dc;
  m.step(0x0b94, 10); // ld hl,0x38dc
  regs.a = mem.read8(0x638d); // the record INDEX
  m.step(0x0b97, 13); // ld a,(0x638d)
  regs.a = regs.dec8(regs.a);
  m.step(0x0b98, 4); // dec a
  regs.rlca();
  m.step(0x0b99, 4); // rlca
  regs.rlca();
  m.step(0x0b9a, 4); // rlca
  regs.rlca();
  m.step(0x0b9b, 4); // rlca
  regs.rlca();
  m.step(0x0b9c, 4); // rlca -- four rlca = nibble swap = *16 for A < 16
  regs.e = regs.a;
  m.step(0x0b9d, 4); // ld e,a
  regs.d = 0x00;
  m.step(0x0b9f, 7); // ld d,0x00
  regs.addHl(regs.de); // add hl,de -- HL = 0x38DC + (0x638D-1)*16
  m.step(0x0ba0, 11);
  regs.exDeHl(); // DE = the record address
  m.step(0x0ba1, 4); // ex de,hl
  m.push16(0x0ba4);
  m.step(0x0da7, 17);
  m.call(0x0da7); // render the record

  regs.hl = 0x638d;
  m.step(0x0ba7, 10); // ld hl,0x638d
  regs.decMem8(mem, regs.hl); // dec (hl) -- the counter
  m.step(0x0ba8, 11);
  if (regs.fNZ) {
    m.ret(11); // ret nz -- more records to render
    return;
  }
  m.step(0x0ba9, 5); // ret nz NOT taken

  regs.a = 0xb0;
  m.step(0x0bab, 7); // ld a,0xb0
  mem.write8(0x6009, regs.a); // arm the countdown to 176
  m.step(0x0bae, 13); // ld (0x6009),a
  regs.hl = 0x6385;
  m.step(0x0bb1, 10); // ld hl,0x6385
  regs.incMem8(mem, regs.hl); // inc (hl) -- advance the sequence
  m.step(0x0bb2, 11);
  m.ret(); // ret (0x0BB2)
}
