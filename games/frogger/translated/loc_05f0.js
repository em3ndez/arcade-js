// SPDX-License-Identifier: GPL-3.0-only

// loc_05f0  (ROM 0x05F0-0x0628) — board-advance foreground: queue sound cues 0x10/0x30 (rst 0x18),
// bump the active player's mod-5 board counter ((0x83FD)==1 → P1 at 0x8293, else P2 at 0x8294,
// wrapping to 0 at 5), redraw the score field (loc_0629) and lay out the new board
// (loc_064b/0x223d/0x1a02), set (0x8380)=1, then tail into the score adder loc_08e0 with DE=0x0100.
export function loc_05f0(m) {
  const { regs, mem } = m;

  regs.a = 0x10;
  m.step(0x05f2, 7);
  m.push16(0x05f3);
  m.step(0x0018, 11); // rst 0x18 -- queue sound cue 0x10
  m.call(0x0018);

  regs.a = 0x30;
  m.step(0x05f5, 7);
  m.push16(0x05f6);
  m.step(0x0018, 11); // rst 0x18 -- queue sound cue 0x30
  m.call(0x0018);

  regs.a = mem.read8(0x83fd);
  m.step(0x05f9, 13); // (0x83fd) -- active player, 1 = P1

  regs.a = regs.dec8(regs.a);
  m.step(0x05fa, 4);

  if (regs.fNZ) {
    // jr nz,0x0608 (taken) -- player 2 counter
    m.step(0x0608, 12);

    regs.hl = 0x8294;
    m.step(0x060b, 10);

    regs.incMem8(mem, regs.hl);
    m.step(0x060c, 11); // inc (0x8294)

    regs.a = mem.read8(regs.hl);
    m.step(0x060d, 7);

    regs.sub(0x05);
    m.step(0x060f, 7);

    if (regs.fNZ) {
      m.step(0x0612, 12); // jr nz,0x0612 (taken) -- not yet 5
    } else {
      m.step(0x0611, 7);
      mem.write8(regs.hl, regs.a);
      m.step(0x0612, 7); // (0x8294) = 0 -- wrap
    }
  } else {
    m.step(0x05fc, 7);

    regs.hl = 0x8293;
    m.step(0x05ff, 10);

    regs.incMem8(mem, regs.hl);
    m.step(0x0600, 11); // inc (0x8293)

    regs.a = mem.read8(regs.hl);
    m.step(0x0601, 7);

    regs.sub(0x05);
    m.step(0x0603, 7);

    if (regs.fNZ) {
      m.step(0x0612, 12); // jr nz,0x0612 (taken) -- not yet 5
    } else {
      m.step(0x0605, 7);
      mem.write8(regs.hl, regs.a);
      m.step(0x0606, 7); // (0x8293) = 0 -- wrap
      m.step(0x0612, 12); // jr 0x0612
    }
  }

  // loc_0612:
  m.push16(0x0615);
  m.step(0x0629, 17); // call 0x0629 -- clear + seed the score field
  m.call(0x0629);

  m.push16(0x0618);
  m.step(0x064b, 17); // call 0x064b
  m.call(0x064b);

  m.push16(0x061b);
  m.step(0x223d, 17); // call 0x223d
  m.call(0x223d);

  m.push16(0x061e);
  m.step(0x1a02, 17); // call 0x1a02
  m.call(0x1a02);

  regs.a = 0x01;
  m.step(0x0620, 7);

  mem.write8(0x8380, regs.a);
  m.step(0x0623, 13); // (0x8380) = 1

  regs.de = 0x0100;
  m.step(0x0626, 10);

  m.step(0x08e0, 10); // jp 0x08e0 -- tail into the score adder
  return m.call(0x08e0);
}
