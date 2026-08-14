// SPDX-License-Identifier: GPL-3.0-only

// loc_040b  (ROM 0x040B-0x0454) — board-start / life-loss dispatcher: take the continue path
// (loc_0457) when 0x83EA is set, else run the per-board setup (bank swap, board build, HUD seed).
export function loc_040b(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x83ea);
  m.step(0x040e, 13); // A = (0x83ea) continue flag
  regs.or(regs.a);
  m.step(0x040f, 4);
  if (regs.fNZ) {
    m.step(0x0457, 10); // jp nz,0x0457 -- a life remains
    return m.call(0x0457);
  }
  m.step(0x0412, 10);

  regs.a = mem.read8(0x83cd);
  m.step(0x0415, 13); // A = (0x83cd) 2P board-swap flag
  regs.or(regs.a);
  m.step(0x0416, 4);
  if (regs.fNZ) {
    m.step(0x0425, 12); // jr nz,0x0425 -- swap already pending
  } else {
    m.step(0x0418, 7);

    regs.a = mem.read8(0x83fe);
    m.step(0x041b, 13); // A = (0x83fe) player count
    regs.a = regs.dec8(regs.a);
    m.step(0x041c, 4);
    if (regs.fZ) {
      m.step(0x0422, 12); // jr z,0x0422 -- 1 player, no bank swap
    } else {
      m.step(0x041e, 7);
      m.push16(0x041f);
      m.step(0x0038, 11); // rst 0x38 -- clear the tilemap
      m.call(0x0038);
      m.push16(0x0422);
      m.step(0x06ee, 17); // call 0x06ee -- swap in player 2's work RAM
      m.call(0x06ee);
    }

    // loc_0422:
    m.push16(0x0425);
    m.step(0x0b1f, 17); // call 0x0b1f
    m.call(0x0b1f);
  }

  // loc_0425:
  regs.a = mem.read8(0x826d);
  m.step(0x0428, 13); // A = (0x826d) extra-life / 2P-swap request
  regs.and(regs.a);
  m.step(0x0429, 4);
  if (regs.fNZ) {
    m.push16(0x042c);
    m.step(0x05f0, 17); // call nz,0x05f0 -- extra-life foreground
    m.call(0x05f0);
  } else {
    m.step(0x042c, 10);
  }

  m.push16(0x042f);
  m.step(0x0942, 17); // call 0x0942 -- build the board
  m.call(0x0942);

  mem.write8(0x83ea, regs.a);
  m.step(0x0432, 13); // (0x83ea) = A from the build

  m.push16(0x0435);
  m.step(0x0a16, 17); // call 0x0a16
  m.call(0x0a16);

  regs.hl = 0x839e;
  m.step(0x0438, 10);
  mem.write8(regs.hl, 0x20);
  m.step(0x043a, 10); // (0x839e) = 0x20
  regs.l = regs.dec8(regs.l);
  m.step(0x043b, 4);
  mem.write8(regs.hl, 0x10);
  m.step(0x043d, 10); // (0x839d) = 0x10
  regs.l = regs.dec8(regs.l);
  m.step(0x043e, 4);
  mem.write8(regs.hl, 0x20);
  m.step(0x0440, 10); // (0x839c) = 0x20

  regs.a = mem.read8(0x83fe);
  m.step(0x0443, 13);
  regs.a = regs.dec8(regs.a);
  m.step(0x0444, 4);
  if (regs.fNZ) {
    m.push16(0x0447);
    m.step(0x07c1, 17); // call nz,0x07c1 -- 2P start-flag setup
    m.call(0x07c1);
  } else {
    m.step(0x0447, 10);
  }

  regs.xor(regs.a);
  m.step(0x0448, 4); // A = 0
  mem.write8(0x826d, regs.a);
  m.step(0x044b, 13); // (0x826d) = 0
  regs.a = mem.read8(0x83cd);
  m.step(0x044e, 13);
  mem.write8(0x83b6, regs.a);
  m.step(0x0451, 13); // (0x83b6) = (0x83cd)

  m.push16(0x0454);
  m.step(0x0a48, 17); // call 0x0a48
  m.call(0x0a48);

  m.step(0x0368, 10); // jp 0x0368 -- into the play loop (interior of loc_0341)
  return m.call(0x0368);
}
