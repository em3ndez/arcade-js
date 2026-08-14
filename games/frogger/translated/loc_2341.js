// SPDX-License-Identifier: GPL-3.0-only

// loc_2341  (ROM 0x2341-0x236C) — the in-play per-frame update, called each vblank by the NMI
// (0x0131). Guarded twice: returns unless the game-mode byte (0x83D6) is 1 (active play) and the
// run flag (0x829B) is non-zero. Only then does it drive the frame: player/enemy/collision/score
// via a fixed sequence of calls (0x236D..0x14B7). Both guards are false in attract/boot, so this
// rets at 0x2345 without touching the sequence.
export function loc_2341(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x83d6);
  m.step(0x2344, 13); // A = (0x83d6) game-mode byte

  regs.a = regs.dec8(regs.a);
  m.step(0x2345, 4); // A = mode - 1 (Z iff mode == 1)

  if (regs.fNZ) {
    m.ret(11); // ret nz -- not active play
    return;
  }
  m.step(0x2346, 5);

  regs.a = mem.read8(0x829b);
  m.step(0x2349, 13); // A = (0x829b) run flag

  regs.and(regs.a);
  m.step(0x234a, 4);

  if (regs.fZ) {
    m.ret(11); // ret z -- run flag clear
    return;
  }
  m.step(0x234b, 5);

  // The in-play update sequence (all dead in attract/boot); the last, 0x14b7, is a jp(hl) dispatcher.
  m.push16(0x234e);
  m.step(0x236d, 17);
  m.call(0x236d);

  m.push16(0x2351);
  m.step(0x1a55, 17);
  m.call(0x1a55);

  m.push16(0x2354);
  m.step(0x23b7, 17);
  m.call(0x23b7);

  m.push16(0x2357);
  m.step(0x0942, 17);
  m.call(0x0942);

  m.push16(0x235a);
  m.step(0x0870, 17);
  m.call(0x0870);

  m.push16(0x235d);
  m.step(0x2005, 17);
  m.call(0x2005);

  m.push16(0x2360);
  m.step(0x1802, 17);
  m.call(0x1802);

  m.push16(0x2363);
  m.step(0x11bf, 17);
  m.call(0x11bf);

  m.push16(0x2366);
  m.step(0x16f8, 17);
  m.call(0x16f8);

  m.push16(0x2369);
  m.step(0x1fc7, 17);
  m.call(0x1fc7);

  m.push16(0x236c);
  m.step(0x14b7, 17);
  m.call(0x14b7);

  m.ret(); // ret at 0x236c (the lone UNREACHED byte past the last dispatcher call)
}
