// SPDX-License-Identifier: GPL-3.0-only

// loc_048f  (ROM 0x048F-0x04F2) — intro timer countdown + new-game entry: spin (0x83C5) down to 0,
// then branch by mode — cold start (loc_0547), 2P continue (loc_04f3), P1-only pre-clear (loc_0534) —
// or seed player 1's work RAM (0x8600->0x80FF, 0x85C0->0x800C) and resume the play loop via jp 0x0368.
export function loc_048f(m) {
  const { regs, mem } = m;

  m.push16(0x0492);
  m.step(0x0f59, 17); // call 0x0f59
  m.call(0x0f59);

  regs.a = 0x0c;
  m.step(0x0494, 7);
  m.push16(0x0495);
  m.step(0x0018, 11); // rst 0x18 -- sound 0x0c
  m.call(0x0018);
  regs.a = 0x0d;
  m.step(0x0497, 7);
  m.push16(0x0498);
  m.step(0x0018, 11); // rst 0x18 -- sound 0x0d
  m.call(0x0018);

  regs.hl = mem.read16(0x83c5);
  m.step(0x049b, 16); // HL = (0x83c5) intro-timer count

  for (;;) {
    // loc_049b:
    regs.hl = (regs.hl - 1) & 0xffff;
    m.step(0x049c, 6);
    mem.write16(0x83c5, regs.hl);
    m.step(0x049f, 16);
    regs.a = regs.h;
    m.step(0x04a0, 4);
    regs.or(regs.l);
    m.step(0x04a1, 4); // Z iff HL == 0
    if (regs.fNZ) {
      m.step(0x049b, 12);
      continue;
    }
    m.step(0x04a3, 7);
    break;
  }

  regs.a = mem.read8(0x83fe);
  m.step(0x04a6, 13); // A = (0x83fe) player count
  regs.a = regs.dec8(regs.a);
  m.step(0x04a7, 4);
  if (regs.fZ) {
    m.step(0x0547, 10); // jp z,0x0547 -- cold-start init
    return m.call(0x0547);
  }
  m.step(0x04aa, 10);

  regs.a = mem.read8(0x83fd);
  m.step(0x04ad, 13); // A = (0x83fd) current player
  regs.a = regs.dec8(regs.a);
  m.step(0x04ae, 4);
  if (regs.fNZ) {
    m.step(0x04f3, 10); // jp nz,0x04f3 -- 2P continue setup
    return m.call(0x04f3);
  }
  m.step(0x04b1, 10);

  regs.hl = 0x83c9;
  m.step(0x04b4, 10);
  mem.write8(regs.hl, 0x01);
  m.step(0x04b6, 10); // (0x83c9) = 1
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x04b7, 6);
  regs.a = mem.read8(regs.hl);
  m.step(0x04b8, 7); // A = (0x83ca)
  regs.or(regs.a);
  m.step(0x04b9, 4);
  if (regs.fNZ) {
    m.step(0x0534, 10); // jp nz,0x0534 -- P1-only pre-clear
    return m.call(0x0534);
  }
  m.step(0x04bc, 10);

  m.push16(0x04bd);
  m.step(0x0038, 11); // rst 0x38 -- clear the tilemap
  m.call(0x0038);
  m.push16(0x04c0);
  m.step(0x0822, 17); // call 0x0822
  m.call(0x0822);

  regs.a = 0x01;
  m.step(0x04c2, 7);
  mem.write8(0x83fe, regs.a);
  m.step(0x04c5, 13); // (0x83fe) = 1
  mem.write8(0x825c, regs.a);
  m.step(0x04c8, 13); // (0x825c) = 1

  regs.hl = 0x825e;
  m.step(0x04cb, 10);
  regs.de = 0x825f;
  m.step(0x04ce, 10);
  regs.bc = 0x0004;
  m.step(0x04d1, 10);
  mem.write8(regs.hl, 0x00);
  m.step(0x04d3, 10); // (0x825e) = 0 -- seeds the fill
  m.ldirAt(0x04d3, 0x04d5); // clear 0x825e-0x8262

  regs.hl = 0x8600;
  m.step(0x04d8, 10);
  regs.de = 0x80ff;
  m.step(0x04db, 10);
  regs.bc = 0x00b7;
  m.step(0x04de, 10);
  m.ldirAt(0x04de, 0x04e0); // copy 0x8600-0x86b6 -> 0x80ff (P1 board state)

  regs.hl = 0x85c0;
  m.step(0x04e3, 10);
  regs.de = 0x800c;
  m.step(0x04e6, 10);
  regs.bc = 0x002b;
  m.step(0x04e9, 10);
  m.ldirAt(0x04e9, 0x04eb); // copy 0x85c0-0x85ea -> 0x800c (P1 sprite state)

  regs.a = 0x01;
  m.step(0x04ed, 7);
  mem.write8(0x803f, regs.a);
  m.step(0x04f0, 13); // (0x803f) = 1

  m.step(0x0368, 10); // jp 0x0368
  return m.call(0x0368);
}
