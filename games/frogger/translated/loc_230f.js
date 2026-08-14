// SPDX-License-Identifier: GPL-3.0-only

// loc_230f  (ROM 0x230F-0x2340) — the once-per-life "start of play" setup, called from the main loop
// (0x0353). Guarded twice: returns unless the mode byte (0x83D6) is 1 (active play) and the run flag
// (0x829B) is non-zero. Only then does it lay out the board (0x0ABA..0x0FAF) and arm the run flag.
// Both guards are false in attract/boot, so this rets at 0x2313.
export function loc_230f(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x83d6);
  m.step(0x2312, 13); // A = (0x83d6) mode byte
  regs.a = regs.dec8(regs.a);
  m.step(0x2313, 4); // Z iff mode == 1
  if (regs.fNZ) {
    m.ret(11); // ret nz -- not active play
    return;
  }
  m.step(0x2314, 5);

  regs.a = mem.read8(0x829b);
  m.step(0x2317, 13); // A = (0x829b) run flag
  regs.and(regs.a);
  m.step(0x2318, 4);
  if (regs.fNZ) {
    m.ret(11); // ret nz -- already running
    return;
  }
  m.step(0x2319, 5);

  mem.write8(0x83b4, regs.a);
  m.step(0x231c, 13); // (0x83b4) = 0

  // The board-layout sequence (all dead in attract/boot); 0x0faf is a jp(hl) dispatcher.
  m.push16(0x231f);
  m.step(0x0aba, 17);
  m.call(0x0aba);

  m.push16(0x2322);
  m.step(0x0629, 17);
  m.call(0x0629);

  m.push16(0x2325);
  m.step(0x223d, 17);
  m.call(0x223d);

  regs.xor(regs.a);
  m.step(0x2326, 4);
  mem.write8(0x825b, regs.a);
  m.step(0x2329, 13);

  m.push16(0x232c);
  m.step(0x1952, 17);
  m.call(0x1952);

  regs.hl = 0xa850;
  m.step(0x232f, 10);
  m.push16(0x2332);
  m.step(0x19e2, 17);
  m.call(0x19e2);

  m.push16(0x2335);
  m.step(0x09aa, 17);
  m.call(0x09aa);

  m.push16(0x2338);
  m.step(0x0faf, 17);
  m.call(0x0faf);

  // loc_2338: the return site past the 0x0faf dispatcher
  regs.a = 0x01;
  m.step(0x233a, 7);
  mem.write8(0x825b, regs.a);
  m.step(0x233d, 13);
  mem.write8(0x829b, regs.a);
  m.step(0x2340, 13); // (0x829b) = 1 -- run flag armed

  m.ret();
}
