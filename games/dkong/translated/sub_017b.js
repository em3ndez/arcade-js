// SPDX-License-Identifier: GPL-3.0-only

/**
 * sub_017b  (ROM 0x017B–0x01B9) — coin input.
 *
 *   017b  3a 00 7d     ld   a,(0x7d00)
 *   017e  cb 7f        bit  7,a
 *   0180  21 03 60     ld   hl,0x6003
 *   0183  c2 89 01     jp   nz,0x0189
 *   0186  36 01        ld   (hl),0x01
 *   0188  c9           ret
 *   0189  7e           ld   a,(hl)
 *   018a  a7           and  a
 *   018b  c8           ret  z
 *   018c  e5           push hl
 *   018d  3a 05 60     ld   a,(0x6005)
 *   0190  fe 03        cp   0x03
 *   0192  ca 9d 01     jp   z,0x019d
 *   0195  cd 1c 01     call 0x011c
 *   0198  3e 03        ld   a,0x03
 *   019a  32 83 60     ld   (0x6083),a
 *   019d  e1           pop  hl
 *   019e  36 00        ld   (hl),0x00
 *   01a0  2b           dec  hl
 *   01a1  34           inc  (hl)
 *   01a2  11 24 60     ld   de,0x6024
 *   01a5  1a           ld   a,(de)
 *   01a6  96           sub  (hl)
 *   01a7  c0           ret  nz
 *   01a8  77           ld   (hl),a
 *   01a9  13           inc  de
 *   01aa  2b           dec  hl
 *   01ab  eb           ex   de,hl
 *   01ac  1a           ld   a,(de)
 *   01ad  fe 90        cp   0x90
 *   01af  d0           ret  nc
 *   01b0  86           add  a,(hl)
 *   01b1  27           daa
 *   01b2  12           ld   (de),a
 *   01b3  11 00 04     ld   de,0x0400
 *   01b6  cd 9f 30     call 0x309f
 *   01b9  c9           ret
 *
 * IN2 bit 7 is COIN1. 0x6003 is an edge latch: while no coin is present it
 * is held at 1, and a coin only counts when it finds the latch already set,
 * so holding the coin line does not repeat-credit.
 *
 * NOTE THIS READS 0x7D00 AGAIN -- a SECOND watchdog kick in the same vblank,
 * after the handler's own read at 0x0072. Harmless, but only
 * because the read is modelled as having the side effect at all.
 *
 * `daa` at 0x01B1 is the BCD credit count -- one of the places the score
 * arithmetic depends on exact DAA semantics.
 */
export function sub_017b(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x7d00); // kicks the watchdog again
  m.step(0x017e, 13);
  const coin = regs.bit(7, regs.a);
  m.step(0x0180, 8);
  regs.hl = 0x6003;
  m.step(0x0183, 10);

  if (!coin) {
    m.step(0x0186, 10); // jp nz not taken
    mem.write8(regs.hl, 0x01); // arm the edge latch
    m.step(0x0188, 10);
    m.ret();
    return;
  }
  m.step(0x0189, 10);

  regs.a = mem.read8(regs.hl);
  m.step(0x018a, 7);
  regs.and(regs.a);
  m.step(0x018b, 4);
  if (regs.fZ) {
    m.step(m.pop16(), 11); // ret z -- latch not armed, coin already counted
    return;
  }
  m.step(0x018c, 5); // ret z not taken -- the coin is accepted

  // -- coin-accepted path (0x018C-0x01B9): sound, clear latch, count pulses, credit in BCD --
  m.push16(regs.hl); // push hl -- save 0x6003
  m.step(0x018d, 11);
  regs.a = mem.read8(0x6005); // game state
  m.step(0x0190, 13); // ld a,(0x6005)
  regs.cp(0x03);
  m.step(0x0192, 7); // cp 0x03
  if (regs.fZ) {
    m.step(0x019d, 10); // jp z,0x019d (state 3 -> skip the coin sound)
  } else {
    m.step(0x0195, 10);
    m.push16(0x0198); m.step(0x011c, 17); m.call(0x011c); // call 0x011c
    regs.a = 0x03;
    m.step(0x019a, 7); // ld a,0x03
    mem.write8(0x6083, regs.a); // sound trigger
    m.step(0x019d, 13);
  }
  // -- loc_019d --
  regs.hl = m.pop16(); // pop hl -- HL = 0x6003
  m.step(0x019e, 10);
  mem.write8(regs.hl, 0x00); // (0x6003) = 0 -- clear the edge latch
  m.step(0x01a0, 10);
  regs.hl = (regs.hl - 1) & 0xffff; // dec hl -> 0x6002
  m.step(0x01a1, 6);
  regs.incMem8(mem, regs.hl); // inc (0x6002) -- coin-pulse counter
  m.step(0x01a2, 11);
  regs.de = 0x6024;
  m.step(0x01a5, 10); // ld de,0x6024
  regs.a = mem.read8(regs.de); // (0x6024) = coins-per-credit
  m.step(0x01a6, 7); // ld a,(de)
  regs.sub(mem.read8(regs.hl)); // sub (0x6002)
  m.step(0x01a7, 7);
  if (regs.fNZ) { m.ret(11); return; } // ret nz -- not enough coin pulses yet
  m.step(0x01a8, 5);
  mem.write8(regs.hl, regs.a); // (0x6002) = 0 -- reset the pulse counter (A == 0)
  m.step(0x01a9, 7);
  regs.de = (regs.de + 1) & 0xffff; // inc de -> 0x6025
  m.step(0x01aa, 6);
  regs.hl = (regs.hl - 1) & 0xffff; // dec hl -> 0x6001
  m.step(0x01ab, 6);
  regs.exDeHl(); // ex de,hl -- HL = 0x6025, DE = 0x6001
  m.step(0x01ac, 4);
  regs.a = mem.read8(regs.de); // (0x6001) = credit count
  m.step(0x01ad, 7); // ld a,(de)
  regs.cp(0x90);
  m.step(0x01af, 7); // cp 0x90
  if (regs.fNC) { m.ret(11); return; } // ret nc -- credits already at the 0x90 max
  m.step(0x01b0, 5);
  regs.add(mem.read8(regs.hl)); // add a,(0x6025) -- credits-per-coin
  m.step(0x01b1, 7);
  regs.daa(); // daa -- BCD adjust
  m.step(0x01b2, 4);
  mem.write8(regs.de, regs.a); // (0x6001) = new BCD credit count
  m.step(0x01b3, 7);
  regs.de = 0x0400;
  m.step(0x01b6, 10); // ld de,0x0400
  m.push16(0x01b9); m.step(0x309f, 17); m.call(0x309f); // call 0x309f
  m.ret(); // ret (0x01B9)
}
