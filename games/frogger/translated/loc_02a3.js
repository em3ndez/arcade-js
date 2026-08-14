// SPDX-License-Identifier: GPL-3.0-only

// loc_02a3  (ROM 0x02A3-0x0340) — the COLD-BOOT init reached from the reset vector
// (loc_0000 -> jp 0x02a3): disables NMI + flip latches, clears work RAM (0x8000-0x87FF)
// and OBJRAM (0xB000-0xB0FF), seeds boot state from the DSW inputs, enables NMI, programs
// both i8255 PPIs (0xE006/0xD006), primes the sound, and falls through into 0x0341.
export function loc_02a3(m) {
  const { regs, mem } = m;

  regs.xor(regs.a);
  m.step(0x02a4, 4); // xor a -- A=0

  mem.write8(0xb808, regs.a, 10);
  m.step(0x02a7, 13); // ld (0xb808),a -- irq_enable D0=0 (NMI off)

  mem.write8(0x8805, regs.a);
  m.step(0x02aa, 13); // ld (0x8805),a -- watchdog-region write (dropped, not hardware)

  mem.write8(0xb810, regs.a, 10);
  m.step(0x02ad, 13); // ld (0xb810),a -- flip_x D0=0

  mem.write8(0xb80c, regs.a, 10);
  m.step(0x02b0, 13); // ld (0xb80c),a -- flip_y D0=0

  regs.hl = 0x8000;
  m.step(0x02b3, 10);

  regs.de = 0x8001;
  m.step(0x02b6, 10);

  regs.bc = 0x07ff;
  m.step(0x02b9, 10);

  mem.write8(regs.hl, regs.l);
  m.step(0x02ba, 7); // ld (hl),l -- (0x8000)=0x00 seeds the propagate

  m.ldirAt(0x02ba, 0x02bc); // ldir -- clear 0x8000-0x87FF to 0

  regs.hl = 0xb000;
  m.step(0x02bf, 10);

  regs.bc = 0x0000;
  m.step(0x02c2, 10); // ld bc,0x0000 -- B=0 -> 256-iteration djnz

  for (;;) {
    // loc_02c2:
    mem.write8(regs.hl, regs.c);
    m.step(0x02c3, 7); // ld (hl),c -- clear OBJRAM byte

    regs.l = regs.inc8(regs.l);
    m.step(0x02c4, 4);

    if (m.regs.djnz() !== 0) {
      m.step(0x02c2, 13);
      continue;
    }
    m.step(0x02c6, 8); // djnz 0x02c2 (not taken) -> 0xB000-0xB0FF cleared
    break;
  }

  regs.a = mem.read8(0xe002);
  m.step(0x02c9, 13); // ld a,(0xe002) -- IN1 (dip-interleaved)

  regs.d = 0x2e;
  m.step(0x02cb, 7);

  regs.and(0x03);
  m.step(0x02cd, 7);

  regs.e = regs.a;
  m.step(0x02ce, 4); // ld e,a -- DE = 0x2E00 + (IN1 & 3)

  regs.a = mem.read8(regs.de);
  m.step(0x02cf, 7); // ld a,(de) -- lives-count table lookup in ROM

  mem.write8(0x83e4, regs.a);
  m.step(0x02d2, 13);

  regs.a = mem.read8(0xe004);
  m.step(0x02d5, 13); // ld a,(0xe004) -- IN2 (dip-interleaved)

  regs.h = regs.a;
  m.step(0x02d6, 4);

  regs.bit(3, regs.h);
  m.step(0x02d8, 8);

  if (regs.fZ) {
    m.step(0x02df, 12);
  } else {
    m.step(0x02da, 7);

    regs.a = 0x01;
    m.step(0x02dc, 7);

    mem.write8(0x83c2, regs.a);
    m.step(0x02df, 13); // ld (0x83c2),a -- cabinet flag
  }

  // loc_02df:
  regs.a = regs.h;
  m.step(0x02e0, 4);

  regs.and(0x06);
  m.step(0x02e2, 7); // and 0x06 -- coinage bits

  mem.write8(0x83d4, regs.a);
  m.step(0x02e5, 13);

  regs.hl = 0x2e0a;
  m.step(0x02e8, 10);

  regs.de = 0x83eb;
  m.step(0x02eb, 10);

  regs.bc = 0x0012;
  m.step(0x02ee, 10);

  m.ldirAt(0x02ee, 0x02f0); // ldir -- copy 0x12 bytes of boot state from ROM

  m.push16(0x02f3);
  m.step(0x1048, 17); // call 0x1048 -- long delay (watchdog-fed)
  m.call(0x1048);

  regs.a = 0x01;
  m.step(0x02f5, 7);

  mem.write8(0x8370, regs.a);
  m.step(0x02f8, 13);

  mem.write8(0xb808, regs.a, 10);
  m.step(0x02fb, 13); // ld (0xb808),a -- irq_enable D0=1 (NMI ON from here)

  m.push16(0x02fc);
  m.step(0x0038, 11); // rst 0x38 -- clear the screen
  m.call(0x0038);

  regs.xor(regs.a);
  m.step(0x02fd, 4);

  mem.write8(0xb001, regs.a);
  m.step(0x0300, 13); // ld (0xb001),a -- OBJRAM

  regs.a = 0x06;
  m.step(0x0302, 7);

  mem.write8(0xb003, regs.a);
  m.step(0x0305, 13); // ld (0xb003),a -- OBJRAM

  regs.hl = 0x0100;
  m.step(0x0308, 10);

  mem.write16(0x83c7, regs.hl);
  m.step(0x030b, 16);

  regs.a = 0x15;
  m.step(0x030d, 7);

  mem.write8(0x8381, regs.a);
  m.step(0x0310, 13);

  regs.hl = 0x2eb1;
  m.step(0x0313, 10);

  regs.de = 0x8400;
  m.step(0x0316, 10);

  regs.bc = 0x0020;
  m.step(0x0319, 10);

  m.ldirAt(0x0319, 0x031b); // ldir -- copy 0x20 bytes of state to 0x8400

  regs.hl = 0xe006;
  m.step(0x031e, 10);

  mem.write8(regs.hl, 0x9b, 7);
  m.step(0x0320, 10); // ld (hl),0x9b -- PPI0 control = 0x9B (mode0, all inputs)

  regs.hl = 0xd006;
  m.step(0x0323, 10);

  mem.write8(regs.hl, 0x88, 7);
  m.step(0x0325, 10); // ld (hl),0x88 -- PPI1 control = 0x88 (A/B outputs: sound)

  regs.a = 0x18;
  m.step(0x0327, 7);

  mem.write8(0x83d9, regs.a);
  m.step(0x032a, 13); // ld (0x83d9),a -- sound-control shadow

  mem.write8(0xd002, regs.a, 10);
  m.step(0x032d, 13); // ld (0xd002),a -- sound control

  regs.xor(regs.a);
  m.step(0x032e, 4); // xor a -- A=0 sound command

  m.push16(0x0331);
  m.step(0x0794, 17); // call 0x0794 -- issue sound command 0
  m.call(0x0794);

  regs.a = mem.read8(0x83d9);
  m.step(0x0334, 13);

  regs.and(0xef);
  m.step(0x0336, 7); // and 0xef -- clear bit 4 (unmute)

  mem.write8(0x83d9, regs.a);
  m.step(0x0339, 13);

  mem.write8(0xd002, regs.a, 10);
  m.step(0x033c, 13); // ld (0xd002),a -- sound control

  regs.a = 0xff;
  m.step(0x033e, 7);

  m.push16(0x0341);
  m.step(0x0794, 17); // call 0x0794 -- issue sound command 0xFF
  m.call(0x0794);

  // fall-through into loc_0341 (the main/attract loop) -- delegate, do not inline
  return m.call(0x0341);
}
