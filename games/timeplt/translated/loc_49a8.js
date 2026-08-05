// SPDX-License-Identifier: GPL-3.0-only

// loc_49a8  (ROM 0x49A8-0x49D5, Time Pilot)
export function loc_49a8(m) {
  const { regs, mem } = m;

  regs.rrca();
  m.step(0x49a9, 4); // rrca
  regs.c = regs.a;
  m.step(0x49aa, 4); // ld c,a -- the once-shifted value, reused below
  regs.and(0x07);
  m.step(0x49ac, 7); // and 0x07
  mem.write8(0xa9c4, regs.a);
  m.step(0x49af, 13); // ld (0xa9c4),a

  regs.a = regs.c;
  m.step(0x49b0, 4); // ld a,c
  regs.rrca();
  m.step(0x49b1, 4); // rrca
  regs.rrca();
  m.step(0x49b2, 4); // rrca
  regs.rrca();
  m.step(0x49b3, 4); // rrca
  regs.and(0x01);
  m.step(0x49b5, 7); // and 0x01
  mem.write8(0xa9c6, regs.a);
  m.step(0x49b8, 13); // ld (0xa9c6),a
  mem.write8(0xc200, regs.a, 10);
  m.step(0x49bb, 13); // ld (0xc200),a -- watchdog kick; the value does not matter

  regs.a = mem.read8(0x0c3e); // ROM
  m.step(0x49be, 13); // ld a,(0x0c3e)
  mem.write8(0xc302, regs.a, 10);
  m.step(0x49c1, 13); // ld (0xc302),a -- LS259 bit 1, value in d0

  m.push16(0x49c4);
  m.step(0x00b1, 17); // call 0x00b1
  m.call(0x00b1);

  regs.b = 0x00;
  m.step(0x49c6, 7); // ld b,0x00 -- 256, because djnz decrements first
  regs.hl = 0x27de;
  m.step(0x49c9, 10); // ld hl,0x27de
  regs.xor(regs.a);
  m.step(0x49ca, 4); // xor a

  do {
    regs.add(mem.read8(regs.hl));
    m.step(0x49cb, 7); // add a,(hl)
    regs.hl = (regs.hl + 1) & 0xffff; // 16-bit INC: no flags
    m.step(0x49cc, 6); // inc hl
    regs.djnz(); // djnz -- no flags
    m.step(regs.b !== 0 ? 0x49ca : 0x49ce, regs.b !== 0 ? 13 : 8); // djnz 0x49ca
  } while (regs.b !== 0);

  regs.sub(0xc5);
  m.step(0x49d0, 7); // sub 0xc5 -- zero on a correct ROM image
  if (regs.fNZ) {
    m.push16(0x49d3);
    m.step(0x00d8, 17); // call nz,0x00d8 taken -- the checksum failed
    m.call(0x00d8);
  } else {
    m.step(0x49d3, 10); // call nz NOT taken
  }

  m.step(0x32eb, 10); // jp 0x32eb -- TAIL, nothing pushed
  return m.call(0x32eb);
}
