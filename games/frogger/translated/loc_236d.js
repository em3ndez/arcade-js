// SPDX-License-Identifier: GPL-3.0-only

// loc_236d  (ROM 0x236D-0x23B6 + 0x23E6-0x23EA) — in-play extra-frog (hop-across) spawn/animate
// driver, called each vblank by loc_2341. Rets unless three gate bytes are clear (0x826C, 0x8004,
// 0x8299); a set 0x8299 just counts the dwell down (folded tail loc_23e6). Otherwise it re-arms the
// dwell, advances the phase index 0x829A, reads a frame code from ROM table 0x2E68, and runs a push-ret
// computed dispatch: the code selects one of the four in-transit hop-frame handlers via the jp table at
// 0x239F-0x23AB (jp 0x1ca0/0x1c41/0x1be4/0x1b8b), the trailing ret, or the reset (folded loc_23ac).
export function loc_236d(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x826c);
  m.step(0x2370, 13); // -- 2P/demo suppress flag
  regs.or(regs.a);
  m.step(0x2371, 4);
  if (regs.fNZ) { m.ret(11); return; }
  m.step(0x2372, 5);

  regs.a = mem.read8(0x8004);
  m.step(0x2375, 13);
  regs.and(regs.a);
  m.step(0x2376, 4);
  if (regs.fNZ) { m.ret(11); return; }
  m.step(0x2377, 5);

  regs.a = mem.read8(0x8299);
  m.step(0x237a, 13); // -- spawn dwell counter
  regs.and(regs.a);
  m.step(0x237b, 4);
  if (regs.fNZ) { m.step(0x23e6, 10); return block_23e6(); }
  m.step(0x237e, 10);

  regs.de = 0x8047;
  m.step(0x2381, 10); // -- frog Y
  regs.a = 0x30;
  m.step(0x2383, 7);
  mem.write8(0x8299, regs.a);
  m.step(0x2386, 13); // (0x8299) = 0x30 -- re-arm the dwell
  regs.hl = 0x829a;
  m.step(0x2389, 10);
  regs.incMem8(mem, 0x829a);
  m.step(0x238a, 11); // inc (0x829a) -- next phase index
  regs.c = mem.read8(regs.hl);
  m.step(0x238b, 7);
  regs.b = 0x00;
  m.step(0x238d, 7);
  regs.hl = 0x2e68;
  m.step(0x2390, 10);
  regs.addHl(regs.bc);
  m.step(0x2391, 11); // hl = 0x2e68 + phase
  regs.c = mem.read8(regs.hl);
  m.step(0x2392, 7); // -- ROM frame code (0x02/05/08/0b/0e/ff)
  regs.c = regs.inc8(regs.c);
  m.step(0x2393, 4);
  if (regs.fZ) { m.step(0x23ac, 10); return block_23ac(); }
  m.step(0x2396, 10);

  regs.hl = 0x239c;
  m.step(0x2399, 10);
  regs.addHl(regs.bc);
  m.step(0x239a, 11); // hl = 0x239c + (code+1) -- the dispatch slot
  m.push16(regs.hl);
  m.step(0x239b, 11);
  regs.hl = 0x8044;
  m.step(0x239e, 10); // -- frog X (handed to the handler)
  const target = m.pop16();
  m.step(target, 10); // ret -- transfer to the computed slot
  switch (target) {
    // Each slot 0x239f-0x23ab holds a jp into a B3 hop-frame handler; 0x23ab is the trailing c9 ret.
    case 0x239f: m.step(0x1ca0, 10); return m.call(0x1ca0);
    case 0x23a2: m.step(0x1c41, 10); return m.call(0x1c41);
    case 0x23a5: m.step(0x1be4, 10); return m.call(0x1be4);
    case 0x23a8: m.step(0x1b8b, 10); return m.call(0x1b8b);
    case 0x23ab: m.ret(); return;
    default:
      throw new Error(
        `loc_236d: push-ret target 0x${target.toString(16)} is outside the 0x239f-0x23ab table`,
      );
  }

  // 0x23AC-0x23B6 — frame 0xff: reset the phase index and clear the driver's flags.
  function block_23ac() {
    regs.xor(regs.a);
    m.step(0x23ad, 4);
    mem.write8(0x829a, regs.a);
    m.step(0x23b0, 13);
    mem.write8(0x8299, regs.a);
    m.step(0x23b3, 13);
    mem.write8(0x825b, regs.a);
    m.step(0x23b6, 13);
    m.ret();
  }

  // 0x23E6-0x23EA (non-contiguous tail) — dwell still running: decrement and store it.
  function block_23e6() {
    regs.a = regs.dec8(regs.a);
    m.step(0x23e7, 4);
    mem.write8(0x8299, regs.a);
    m.step(0x23ea, 13);
    m.ret();
  }
}
