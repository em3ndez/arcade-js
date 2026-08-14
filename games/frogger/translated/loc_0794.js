// SPDX-License-Identifier: GPL-3.0-only

// loc_0794  (ROM 0x0794-0x07AB) — issue one sound command: latch A to the sound
// data port (0xD000), then pulse bit 3 of the sound-control port (0xD002) low
// (the konami_sound_control falling edge that asserts the audio /INT) then high.
export function loc_0794(m) {
  const { regs, mem } = m;

  mem.write8(0xd000, regs.a, 10);
  m.step(0x0797, 13); // ld (0xd000),a -- sound-command latch (PPI1.A)

  regs.a = mem.read8(0x83d9);
  m.step(0x079a, 13); // ld a,(0x83d9) -- current sound-control shadow

  regs.and(0xf7);
  m.step(0x079c, 7); // and 0xf7 -- clear bit 3

  mem.write8(0xd002, regs.a, 10);
  m.step(0x079f, 13); // ld (0xd002),a -- bit 3 low (falling edge -> audio /INT)

  m.step(0x07a0, 4);
  m.step(0x07a1, 4);
  m.step(0x07a2, 4);
  m.step(0x07a3, 4);

  regs.a = mem.read8(0x83d9);
  m.step(0x07a6, 13);

  regs.or(0x08);
  m.step(0x07a8, 7); // or 0x08 -- set bit 3

  mem.write8(0xd002, regs.a, 10);
  m.step(0x07ab, 13); // ld (0xd002),a -- bit 3 high again

  m.ret();
}
