// SPDX-License-Identifier: GPL-3.0-only
import { NotImplemented } from "../../../boards/dkong/io.js";

/**
 * readControls  (ROM 0x0087–0x00B4) — selects the active input port and edge-debounces the controls into 0x6010/0x6011.
 *
 * Selects between IN1 (0x7C80) and IN0 (0x7C00) depending on 0x6026/0x600E
 * (two-player alternation), then debounces: 0x6011 holds the previous
 * reading, so `cpl / and b` keeps only bits that are newly set -- an
 * edge detector. The jump bit (0x10) is shifted up three places by the three
 * `rla`s and merged with the direction nibble, and the pair is stored to
 * 0x6010/0x6011 in one `ld (0x6010),hl`.
 */
export function readControls(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x6026);
  m.tick(13);
  regs.and(regs.a);
  m.tick(4);
  const twoPlayer = regs.fNZ;
  m.tick(10); // jp nz,0x0098

  if (!twoPlayer) {
    regs.a = mem.read8(0x600e);
    m.tick(13);
    regs.and(regs.a);
    m.tick(4);
    const alt = regs.fNZ;
    // NOTE: this read happens BETWEEN the flag-setting `and a` and the `jp nz`
    // that consumes it. `ld a,(nn)` does not affect flags, so the branch still
    // tests 0x600E -- but A now holds IN1. Translating these in the wrong
    // order would silently use the wrong port.
    regs.a = mem.read8(0x7c80); // IN1
    m.tick(13);
    m.tick(10); // jp nz,0x009b
    if (!alt) {
      regs.a = mem.read8(0x7c00); // loc_0098 -- IN0
      m.tick(13);
    }
  } else {
    regs.a = mem.read8(0x7c00); // loc_0098 -- IN0
    m.tick(13);
  }

  // loc_009b
  regs.b = regs.a;
  m.tick(4);
  regs.and(0x0f); // direction nibble
  m.tick(7);
  regs.c = regs.a;
  m.tick(4);
  regs.a = mem.read8(0x6011); // previous reading
  m.tick(13);
  regs.cpl();
  m.tick(4);
  regs.and(regs.b); // newly-set bits only (edge detect)
  m.tick(4);
  regs.and(0x10); // the jump bit
  m.tick(7);
  for (let i = 0; i < 3; i++) {
    regs.rla();
    m.tick(4);
  }
  regs.or(regs.c);
  m.tick(4);
  regs.h = regs.b;
  m.tick(4);
  regs.l = regs.a;
  m.tick(4);
  mem.write16(0x6010, regs.hl);
  m.tick(16);
  regs.a = regs.b;
  m.tick(4);
  const bit6 = regs.bit(6, regs.a);
  m.tick(8); // bit 6,a
  if (bit6) {
    m.tick(10);
    throw new NotImplemented(
      "input bit 6 set: jp 0x0000 at ROM 0x00B2 -- soft reset via input, " +
        "path not yet exercised",
    );
  }
  m.tick(10);
}
