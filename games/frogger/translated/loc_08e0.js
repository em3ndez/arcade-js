// SPDX-License-Identifier: GPL-3.0-only

// loc_08e0  (ROM 0x08E0-0x0941) — add the BCD delta DE to the active player's score word
// (0x83ED P1 / 0x83EB P2); on first reaching the extra-life target word at (0x2E08) award a life
// (bump 0x83E5/0x83E6, draw its HUD tile) and queue the tile update; then keep the running high
// score at 0x83EF. Gated off while (0x83FE)==0.
export function loc_08e0(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x83fe);
  m.step(0x08e3, 13); // ld a,(0x83fe) -- the play/attract gate
  regs.or(regs.a);
  m.step(0x08e4, 4);
  if (regs.fZ) {
    m.ret(11); // ret z (taken) -- not in play, no scoring
    return;
  }
  m.step(0x08e5, 5);
  regs.a = mem.read8(0x83fd);
  m.step(0x08e8, 13); // ld a,(0x83fd) -- active player number
  regs.a = regs.dec8(regs.a);
  m.step(0x08e9, 4);
  if (regs.fZ) {
    m.step(0x08f0, 12); // jr z,0x08f0 -- player 1
    return block_08f0();
  }
  m.step(0x08eb, 7);
  regs.hl = 0x83eb;
  m.step(0x08ee, 10); // ld hl,0x83eb -- player 2 score word
  m.step(0x08f3, 12); // jr 0x08f3
  return block_08f3();

  function block_08f0() {
    regs.hl = 0x83ed;
    m.step(0x08f3, 10); // ld hl,0x83ed -- player 1 score word
    return block_08f3();
  }

  function block_08f3() {
    regs.a = regs.e;
    m.step(0x08f4, 4);
    regs.add(mem.read8(regs.hl));
    m.step(0x08f5, 7); // add a,(hl) -- score low + delta low
    regs.daa();
    m.step(0x08f6, 4); // daa -- BCD-correct the low byte
    mem.write8(regs.hl, regs.a);
    m.step(0x08f7, 7); // ld (hl),a -- store score low
    regs.e = regs.a;
    m.step(0x08f8, 4);
    regs.hl = (regs.hl + 1) & 0xffff;
    m.step(0x08f9, 6); // inc hl (flags untouched)
    regs.a = regs.d;
    m.step(0x08fa, 4);
    regs.adc(mem.read8(regs.hl));
    m.step(0x08fb, 7); // adc a,(hl) -- score high + delta high + BCD carry
    regs.daa();
    m.step(0x08fc, 4); // daa -- BCD-correct the high byte
    mem.write8(regs.hl, regs.a);
    m.step(0x08fd, 7); // ld (hl),a -- store score high
    regs.d = regs.a;
    m.step(0x08fe, 4); // DE now the updated BCD score
    regs.a = mem.read8(0x83fd);
    m.step(0x0901, 13);
    regs.a = regs.dec8(regs.a);
    m.step(0x0902, 4);
    if (regs.fNZ) {
      m.step(0x090d, 12); // jr nz,0x090d -- player 2
      return block_090d();
    }
    m.step(0x0904, 7);
    regs.bc = 0x83e7;
    m.step(0x0907, 10); // ld bc,0x83e7 -- P1 extra-life-awarded flag
    regs.a = mem.read8(regs.bc);
    m.step(0x0908, 7);
    regs.or(regs.a);
    m.step(0x0909, 4);
    if (regs.fNZ) {
      m.step(0x0936, 12); // jr nz,0x0936 -- already awarded
      return block_0936();
    }
    m.step(0x090b, 7);
    m.step(0x0914, 12); // jr 0x0914
    return block_0914();
  }

  function block_090d() {
    regs.bc = 0x83e8;
    m.step(0x0910, 10); // ld bc,0x83e8 -- P2 extra-life-awarded flag
    regs.a = mem.read8(regs.bc);
    m.step(0x0911, 7);
    regs.or(regs.a);
    m.step(0x0912, 4);
    if (regs.fNZ) {
      m.step(0x0936, 12); // jr nz,0x0936 -- already awarded
      return block_0936();
    }
    m.step(0x0914, 7);
    return block_0914();
  }

  function block_0914() {
    regs.hl = mem.read16(0x2e08);
    m.step(0x0917, 16); // ld hl,(0x2e08) -- ROM extra-life target word
    regs.sbcHl(regs.de);
    m.step(0x0919, 15); // sbc hl,de -- target - score (carry clear from `or a`)
    if (regs.fZ) {
      m.step(0x091d, 12); // jr z,0x091d -- exactly reached
      return block_091d();
    }
    m.step(0x091b, 7);
    if (regs.fNC) {
      m.step(0x0936, 12); // jr nc,0x0936 -- target still ahead of score
      return block_0936();
    }
    m.step(0x091d, 7); // score passed the target
    return block_091d();
  }

  function block_091d() {
    mem.write8(0x83cf, regs.a);
    m.step(0x0920, 13); // ld (0x83cf),a
    regs.a = regs.inc8(regs.a);
    m.step(0x0921, 4);
    mem.write8(regs.bc, regs.a);
    m.step(0x0922, 7); // ld (bc),a -- mark the extra life awarded
    regs.c = regs.dec8(regs.c);
    m.step(0x0923, 4);
    regs.c = regs.dec8(regs.c);
    m.step(0x0924, 4); // BC now the lives counter (0x83E5/0x83E6)
    regs.a = mem.read8(regs.bc);
    m.step(0x0925, 7);
    regs.a = regs.inc8(regs.a);
    m.step(0x0926, 4);
    mem.write8(regs.bc, regs.a);
    m.step(0x0927, 7); // ld (bc),a -- one more life
    regs.hl = 0xabde;
    m.step(0x092a, 10);
    regs.bc = 0xffe0;
    m.step(0x092d, 10); // BC = -0x20 (one HUD row step)
    return block_092d();
  }

  function block_092d() {
    regs.addHl(regs.bc);
    m.step(0x092e, 11); // add hl,bc -- walk the life-icon slot back by lives count
    regs.a = regs.dec8(regs.a);
    m.step(0x092f, 4);
    if (regs.fNZ) {
      m.step(0x092d, 12); // jr nz,0x092d
      return block_092d();
    }
    m.step(0x0931, 7);
    mem.write8(regs.hl, 0x4d);
    m.step(0x0933, 10); // ld (hl),0x4d -- stamp the new life tile
    regs.a = 0x07;
    m.step(0x0935, 7);
    m.push16(0x0936);
    m.step(0x0018, 11); // rst 0x18 -- enqueue the tile update
    m.call(0x0018);
    return block_0936();
  }

  function block_0936() {
    regs.hl = mem.read16(0x83ef);
    m.step(0x0939, 16); // ld hl,(0x83ef) -- current high score
    regs.or(regs.a);
    m.step(0x093a, 4); // or a -- clear carry for the compare
    regs.sbcHl(regs.de);
    m.step(0x093c, 15); // sbc hl,de -- high - score
    if (regs.fNC) {
      m.ret(11); // ret nc (taken) -- high score still ahead
      return;
    }
    m.step(0x093d, 5);
    mem.write16(0x83ef, regs.de);
    m.step(0x0941, 20); // ld (0x83ef),de -- new high score
    m.ret();
  }
}
