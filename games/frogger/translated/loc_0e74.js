// SPDX-License-Identifier: GPL-3.0-only

// loc_0e74  (ROM 0x0E74-0x0E79) — the credits-present tail of the attract sequencer: force the
// game-mode byte (0x83D6) to 5 (attract idle) and return. Entered by jr from loc_0e7a (0x0E7E).
export function loc_0e74(m) {
  const { regs, mem } = m;

  regs.a = 0x05;
  m.step(0x0e76, 7);

  mem.write8(0x83d6, regs.a);
  m.step(0x0e79, 13); // (0x83d6) = 5 -- game-mode byte

  m.ret();
}
