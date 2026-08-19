// SPDX-License-Identifier: GPL-3.0-only

// loc_099c  (ROM 0x099c-0x09f7) -- attract sub-state 4 (dispatch target 0x08a1[4]).
// Decoded FRESH from 0x099c: MAME's execpc trace never reaches this sub-state (dynamic rst-0x28
// dispatch), so dk.asm marked 0x099c-0x09f7 as UNREACHED data; the BYTES decode as real code.
// Gates on the 0x02ce frame timer (`ret nz`), then a spin-verify of 0x0d ROM byte pairs
// (0x07c9.. vs 0x0a65..) -- the inner `jr nz,0x09aa` re-reads the SAME pair, so a tampered ROM
// stalls forever. It paints the attribute map (0x075d), queues a display cmd (rst 0x38),
// zero-fills the 0x8b70 sprite bank (rst 0x10, B=0 -> 256 bytes), then loops loc_0a0c to build
// IX objects (0x18 apart) from the 0x0a7e table until the entry byte reads 0xff, calls two more
// init routines (0x0a52 / 0x0a25), seats two vectors (0x8e54/0x8e56), and writes the 0x8e50 block
// before FALLING THROUGH into loc_09f8.
export function loc_099c(m) {
  const { regs, mem } = m;

  regs.b = 0x19; m.step(0x099e, 7);
  m.push16(0x09a1); m.step(0x02ce, 17); m.call(0x02ce); // 099e  call 0x02ce -- frame timer
  if (regs.fNZ) { m.ret(11); return; } // 09a1  ret nz -- still counting
  m.step(0x09a2, 5);

  regs.d = 0x0d; m.step(0x09a4, 7);
  regs.hl = 0x0a65; m.step(0x09a7, 10);
  regs.bc = 0x07c9; m.step(0x09aa, 10);
  // 09aa  verify 0x0d ROM byte pairs; inner arm spins until (bc) == (hl)
  for (;;) {
    for (;;) {
      regs.a = mem.read8(regs.bc); m.step(0x09ab, 7);
      regs.sub(mem.read8(regs.hl)); m.step(0x09ac, 7); // 09ab  sub (hl)
      if (regs.fNZ) { m.step(0x09aa, 12); continue; }
      m.step(0x09ae, 7);
      break;
    }
    regs.bc = (regs.bc + 1) & 0xffff; m.step(0x09af, 6);
    regs.hl = (regs.hl + 1) & 0xffff; m.step(0x09b0, 6);
    regs.d = regs.dec8(regs.d); m.step(0x09b1, 4);
    if (regs.fNZ) { m.step(0x09aa, 12); continue; }
    m.step(0x09b3, 7);
    break;
  }

  regs.bc = 0x07b9; m.step(0x09b6, 10);
  m.push16(0x09b9); m.step(0x075d, 17); m.call(0x075d); // 09b6  call 0x075d -- fill attribute map
  regs.de = 0x060d; m.step(0x09bc, 10);
  m.push16(0x09bd); m.step(0x0038, 11); m.call(0x0038); // 09bc  rst 0x38 -- queue display cmd
  regs.hl = 0x8b70; m.step(0x09c0, 10);
  regs.xor(regs.a); m.step(0x09c1, 4);
  regs.b = regs.a; m.step(0x09c2, 4);
  m.push16(0x09c3); m.step(0x0010, 11); m.call(0x0010); // 09c2  rst 0x10 -- B=0 -> zero 256 bytes

  regs.hl = 0x0a76; m.step(0x09c6, 10);
  regs.de = 0x0a7e; m.step(0x09c9, 10);
  regs.ix = 0x8b70; m.step(0x09cd, 14);
  // 09cd  build IX objects from the DE table (loc_0a0c advances DE) until the entry byte is 0xff
  for (;;) {
    m.push16(0x09d0); m.step(0x0a0c, 17); m.call(0x0a0c); // 09cd  call 0x0a0c
    regs.bc = 0x0018; m.step(0x09d3, 10);
    regs.ix = regs.add16(regs.ix, regs.bc); m.step(0x09d5, 15); // 09d3  add ix,bc
    regs.a = mem.read8(regs.de); m.step(0x09d6, 7);
    regs.a = regs.inc8(regs.a); m.step(0x09d7, 4); // 09d6  inc a
    if (regs.fNZ) { m.step(0x09cd, 12); continue; }
    m.step(0x09d9, 7);
    break;
  }

  m.push16(0x09dc); m.step(0x0a52, 17); m.call(0x0a52); // 09d9  call 0x0a52
  m.push16(0x09df); m.step(0x0a25, 17); m.call(0x0a25); // 09dc  call 0x0a25
  regs.hl = 0x0a87; m.step(0x09e2, 10);
  mem.write16(0x8e54, regs.hl); m.step(0x09e5, 16); // 09e2  ld (0x8e54),hl
  regs.hl = 0x8648; m.step(0x09e8, 10);
  mem.write16(0x8e56, regs.hl); m.step(0x09eb, 16); // 09e8  ld (0x8e56),hl
  regs.hl = 0x8e50; m.step(0x09ee, 10);
  mem.write8(regs.hl, 0x32); m.step(0x09f0, 10);
  regs.l = regs.inc8(regs.l); m.step(0x09f1, 4);
  regs.incMem8(mem, regs.hl); m.step(0x09f2, 11); // 09f1  inc (hl) -- next sub-state (0x8e51)
  regs.l = regs.inc8(regs.l); m.step(0x09f3, 4);
  mem.write8(regs.hl, 0x0d); m.step(0x09f5, 10);
  regs.l = regs.inc8(regs.l); m.step(0x09f6, 4);
  mem.write8(regs.hl, 0x05); m.step(0x09f8, 10);
  return m.call(0x09f8); // 09f8  fall through into loc_09f8
}
