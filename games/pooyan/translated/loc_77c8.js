// SPDX-License-Identifier: GPL-3.0-only

// loc_77c8  (ROM 0x77c8-0x780e) -- clears actor slot (IX+0,1,2,3,4,5,6,16); returns early when
// (IX+0x13) < 5. Otherwise seeds (IX+1)=1,(IX+2)=3,(IX+0x11)=0x80 and runs a colorRAM integrity
// chain: 10 cells from 0x82bc stepping up by 0x20 must all match their neighbour AND their running
// sum + 0x83 must equal (0x780e)=0xc9. A neighbour mismatch tail-jumps to 0x7875 (mid data table ->
// rst 0x38 garbage: a tamper trap, modelled as throw); a sum mismatch tail-jumps to code 0x2334.
export function loc_77c8(m) {
  const { regs, mem } = m;
  const ix = regs.ix;

  regs.xor(regs.a);
  m.step(0x77c9, 4); // 77c8  xor a
  mem.write8((ix + 0x00) & 0xffff, regs.a);
  m.step(0x77cc, 19); // 77c9  ld (ix+0),a
  mem.write8((ix + 0x01) & 0xffff, regs.a);
  m.step(0x77cf, 19); // 77cc  ld (ix+1),a
  mem.write8((ix + 0x02) & 0xffff, regs.a);
  m.step(0x77d2, 19); // 77cf  ld (ix+2),a
  mem.write8((ix + 0x03) & 0xffff, regs.a);
  m.step(0x77d5, 19); // 77d2  ld (ix+3),a
  mem.write8((ix + 0x04) & 0xffff, regs.a);
  m.step(0x77d8, 19); // 77d5  ld (ix+4),a
  mem.write8((ix + 0x05) & 0xffff, regs.a);
  m.step(0x77db, 19); // 77d8  ld (ix+5),a
  mem.write8((ix + 0x06) & 0xffff, regs.a);
  m.step(0x77de, 19); // 77db  ld (ix+6),a
  mem.write8((ix + 0x16) & 0xffff, regs.a);
  m.step(0x77e1, 19); // 77de  ld (ix+0x16),a
  regs.a = mem.read8((ix + 0x13) & 0xffff);
  m.step(0x77e4, 19); // 77e1  ld a,(ix+0x13)
  regs.cp(0x05);
  m.step(0x77e6, 7); // 77e4  cp 0x05
  if (regs.fC) { m.ret(11); return; } // 77e6  ret c
  m.step(0x77e7, 5); // 77e6  ret c (not taken)

  mem.write8((ix + 0x01) & 0xffff, 0x01);
  m.step(0x77eb, 19); // 77e7  ld (ix+1),0x01
  mem.write8((ix + 0x02) & 0xffff, 0x03);
  m.step(0x77ef, 19); // 77eb  ld (ix+2),0x03
  mem.write8((ix + 0x11) & 0xffff, 0x80);
  m.step(0x77f3, 19); // 77ef  ld (ix+0x11),0x80
  regs.hl = 0x82bc;
  m.step(0x77f6, 10); // 77f3  ld hl,0x82bc
  regs.de = 0xffe0;
  m.step(0x77f9, 10); // 77f6  ld de,0xffe0
  regs.bc = 0x0a00;
  m.step(0x77fc, 10); // 77f9  ld bc,0x0a00  (b=10 cells, c=0 sum)

  for (;;) {
    regs.a = mem.read8(regs.hl);
    m.step(0x77fd, 7); // 77fc  ld a,(hl)
    regs.addHl(regs.de);
    m.step(0x77fe, 11); // 77fd  add hl,de  -- up one row
    regs.cp(mem.read8(regs.hl));
    m.step(0x77ff, 7); // 77fe  cp (hl)
    if (regs.fNZ) {
      // 77ff  jr nz,0x7875 -- neighbour mismatch jumps into the data table at 0x7875, which
      // decodes to rst 0x38 garbage. Faithful behaviour is an undefined tamper-trap crash.
      throw new Error("loc_77c8: colorRAM integrity mismatch -> data-table trap at 0x7875");
    }
    m.step(0x7801, 7); // 77ff  jr nz (not taken)
    regs.add(regs.c);
    m.step(0x7802, 4); // 7801  add a,c  -- accumulate
    regs.c = regs.a;
    m.step(0x7803, 4); // 7802  ld c,a
    if (regs.djnz() !== 0) { m.step(0x77fc, 13); continue; } // 7803  djnz 0x77fc
    m.step(0x7805, 8);
    break;
  }

  regs.add(0x83);
  m.step(0x7807, 7); // 7805  add a,0x83
  regs.hl = 0x780e;
  m.step(0x780a, 10); // 7807  ld hl,0x780e
  regs.cp(mem.read8(regs.hl));
  m.step(0x780b, 7); // 780a  cp (hl)  -- (0x780e)=0xc9
  if (regs.fNZ) { m.step(0x2334, 10); return m.call(0x2334); } // 780b  jp nz,0x2334 (sum mismatch)
  m.step(0x780e, 10); // 780b  jp nz (not taken)
  m.ret(); // 780e  ret
}
