// SPDX-License-Identifier: GPL-3.0-only
import {
  loc_00, loc_0100, loc_0400, loc_0500, loc_0600, loc_0700, loc_64,
  loc_86, loc_8a, loc_8b, loc_8c, loc_c1, loc_c2, loc_ff, CONFIG_DIP_BYTE,
  DSW1, IN0, IN1,
  AUDF1, AUDC1, AUDC2, AUDC3, AUDC4, AUDCTL, SKCTL, WATCHDOG, loc_2400,
  PALETTE_COLOR_04, PALETTE_COLOR_05, PALETTE_COLOR_06, PALETTE_COLOR_07,
  PALETTE_COLOR_0D, PALETTE_COLOR_0E, PALETTE_COLOR_0F, FLIP_SCREEN,
} from "./names.js";
import { loadHighScoreTableFromEarom } from "./loadHighScoreTableFromEarom.js";
import { validateOrResetHighScores } from "./validateOrResetHighScores.js";
import { loc_200e } from "./loc_200e.js";

// Service-port bit masks: bit6 = beam vblank (edges once per frame), bit5 = service switch (idle high,
// cleared while held).  [code]
const VBLANK = 0x40;
const SERVICE = 0x20;

/**
 * coldBootReset — the power-on reset entry (reset-vector target). Clears all work/stack/video/object RAM,
 * quiets the sound and flip latches, then splits on the service switch:
 *   - switch idle (normal boot): snapshot the option switches, seed a few flags, load and validate the
 *     high-score mirror from NVRAM, then hand off to the game entry.
 *   - switch held (operator self-test): march RAM and the memory pages, beeping any failure, and otherwise
 *     draw the test screens or hand off to the checksum display.
 * The self-test marches poll the beam and the service switch, so they are inherently clock-coupled. [code]
 *
 * A generator: the normal path delegates into the main-loop spine, whose vblank yields propagate up to the
 * clock-free engine. Isolated capture-replay can't drive a forever-yielding boot, so this spine entry is
 * engine-validated (whole-machine convergence) rather than by an isolated capture test.
 */
export function* coldBootReset(m) {
  const { mem8 } = m;

  // Clear zeropage, page 1 (stack), and the video/object pages with 0.
  let x = 0;
  do {
    mem8[(loc_00 + x) & 0xff] = 0;
    mem8[loc_0100 + x] = 0;
    mem8[loc_0400 + x] = 0;
    mem8[loc_0500 + x] = 0;
    mem8[loc_0600 + x] = 0;
    mem8[loc_0700 + x] = 0;
    x = (x - 1) & 0xff;
  } while (x !== 0);

  // Quiet the sound-status/coin regs and drop the flip-screen latch.
  mem8[SKCTL] = 0;
  mem8[AUDCTL] = 0;
  mem8[loc_2400] = 0;
  mem8[FLIP_SCREEN] = 0;

  if ((mem8[IN0] & SERVICE) !== 0) {
    // Normal boot: the service switch is idle.
    mem8[CONFIG_DIP_BYTE] = mem8[DSW1];
    mem8[loc_86] = 0xff;
    mem8[loc_c1] = 0xff;
    mem8[loc_c2] = 0xff;
    mem8[loc_ff] = 1;
    loadHighScoreTableFromEarom(m, 1); // A live-in is a don't-care; the NVRAM read overwrites it
    validateOrResetHighScores(m);
    yield* loc_200e(m); // hand off to the game entry — the main-loop generator runs forever
    return;
  }

  return runSelfTest(m);
}

// ---- operator self-test (service switch held) -------------------------------------------------------

function runSelfTest(m) {
  const { mem8, mem16 } = m;

  // Seed a colour ramp and quiet the four sound channels.
  mem8[PALETTE_COLOR_04] = 0;
  mem8[AUDC1] = 0; mem8[AUDC2] = 0; mem8[AUDC3] = 0; mem8[AUDC4] = 0;
  mem8[PALETTE_COLOR_05] = 1; mem8[PALETTE_COLOR_0D] = 1;
  mem8[PALETTE_COLOR_06] = 2; mem8[PALETTE_COLOR_0E] = 2;
  mem8[PALETTE_COLOR_07] = 3; mem8[PALETTE_COLOR_0F] = 3;

  // Zeropage march: each cell must read back 0, then walk a 1-bit pattern up through it.
  for (let cell = 0; ; cell = (cell + 1) & 0xff) {
    if (mem8[(loc_00 + cell) & 0xff] !== 0) return selfTestErrorFromRam(m, mem8[(loc_00 + cell) & 0xff]);
    let a = 0x11;
    for (;;) {
      mem8[(loc_00 + cell) & 0xff] = a;
      const readback = mem8[(loc_00 + cell) & 0xff];
      if ((a ^ readback) !== 0) return selfTestErrorFromRam(m, a ^ readback);
      a = a << 1;
      if ((a & 0x100) === 0) { a &= 0xff; continue; } // walking bit still in range
      break;
    }
    if (((cell + 1) & 0xff) === 0) break;
  }

  // Page march over the ($8b) pointer: page 1, then 4..7 (pages 2-3 are skipped). Pointer low is 0.
  mem8[loc_8b] = 0;
  mem8[loc_8c] = 1;
  let page = 1;
  for (;;) {
    mem8[loc_8c] = page;
    for (let y = 0; ; y = (y + 1) & 0xff) {
      const at = mem16[loc_8b] + y;
      if (mem8[at] !== 0) return selfTestErrorFromPage(m, mem8[at], y);
      let a = 0x11;
      for (;;) {
        mem8[(mem16[loc_8b] + y)] = a;
        const readback = mem8[(mem16[loc_8b] + y)];
        if ((a ^ readback) !== 0) return selfTestErrorFromPage(m, a ^ readback, y);
        a = a << 1;
        if ((a & 0x100) === 0) { a &= 0xff; continue; }
        break;
      }
      if (((y + 1) & 0xff) === 0) break;
    }
    let next = (page + 1) & 0xff;
    if (next === 2) next = 4; // remap: skip the unmapped pages
    if (next >= 8) break;
    page = next;
  }

  // Marches passed. Branch on the coin/self-test option bit into the checksum-display screen.
  if ((mem8[IN1] & 0x10) !== 0) return m.call(0x3c97); // cyclic spine — kept

  // Re-clear zeropage, seed the $64.. row, and paint the self-test glyph grid.
  for (let cell = 0; ; cell = (cell + 1) & 0xff) {
    mem8[(loc_00 + cell) & 0xff] = 0;
    if (((cell + 1) & 0xff) === 0) break;
  }
  for (let i = 0x0f; i >= 0; i--) mem8[(loc_64 + i) & 0xff] = 0xf8;

  mem8[loc_8c] = 7;
  let y = 0xbf;
  for (;;) {
    let glyph = 0x2d;
    for (;;) {
      // Lay 8 descending cells of this glyph through the ($8b) pointer, then step the glyph code down.
      let n = 8;
      do {
        mem8[(mem16[loc_8b] + y)] = glyph;
        y = (y - 1) & 0xff;
        n = (n - 1) & 0xff;
      } while (n !== 0);
      glyph = (glyph - 1) & 0xff;
      if (glyph < 0x2a) break; // wrapped below the printable base
    }
    if (y !== 0xff) continue;
    mem8[loc_8c] = (mem8[loc_8c] - 1);
    if (mem8[loc_8c] >= 4) continue;
    break;
  }

  // Input-response screen: wait for the service switch, kick the dog, wait for a control.
  for (;;) {
    while ((mem8[IN0] & SERVICE) !== 0) { /* wait for the service switch to clear */ }
    mem8[loc_8a] = mem8[loc_8a] >> 1;
    mem8[WATCHDOG] = 0; // watchdog
    if ((((mem8[IN1] & 0xe0) ^ 0xe0)) !== 0) break; // a control was actuated
  }

  // Paint the response colour into the play/object pages, then hold in the review loop.
  const fill = 0x1d;
  for (let cell = 0; ; cell = (cell + 1) & 0xff) {
    mem8[loc_0400 + cell] = fill;
    mem8[loc_0500 + cell] = fill;
    mem8[loc_0600 + cell] = fill;
    if (((cell + 1) & 0xff) === 0) break;
  }
  for (let cell = 0; cell < 0xc0; cell++) mem8[loc_0700 + cell] = fill;
  mem8[PALETTE_COLOR_05] = 8;
  mem8[PALETTE_COLOR_04] = 0x0f;

  // Review loop: kick the dog and pace on $8a while the service switch is held clear (holds here). [code]
  for (;;) {
    while ((mem8[IN0] & SERVICE) !== 0) { /* wait for service clear */ }
    mem8[WATCHDOG] = 0;
    mem8[loc_8a] = mem8[loc_8a] >> 1;
  }
}

// Zeropage-march failure: the beep count derives from just the fail flag (bit4 of the failing value).
function selfTestErrorFromRam(m, fail) {
  return selfTestBeepAndHalt(m, 0, fail >= 0x10 ? 1 : 0);
}

// Page-march failure: a low page ($8c < 4) falls back to the RAM-style report; otherwise the count folds
// in the position nibble of Y.
function selfTestErrorFromPage(m, fail, y) {
  if (m.mem8[loc_8c] < 4) return selfTestErrorFromRam(m, fail);
  const seed = ((y & 0x30) >> 4) + 1;
  return selfTestBeepAndHalt(m, seed, fail >= 0x10 ? 1 : 0);
}

// Beep the error on channel 1 in sync with the beam, then halt for a power cycle.
function selfTestBeepAndHalt(m, seed, carry) {
  const { mem8 } = m;
  let count = ((seed << 1) | carry) & 0xff;
  mem8[AUDF1] = 0x40;
  mem8[SKCTL] = 3;
  do {
    mem8[AUDC1] = 0xaf;
    for (let x = 0x10; x > 0; x--) {
      while ((mem8[IN0] & VBLANK) === 0) { /* wait for vblank */ }
      while ((mem8[IN0] & VBLANK) !== 0) { /* wait for active video */ }
      mem8[WATCHDOG] = 0;
    }
    mem8[AUDC1] = 0;
    for (let x = 0x10; x > 0; x--) {
      while ((mem8[IN0] & VBLANK) === 0) { /* wait for vblank */ }
      while ((mem8[IN0] & VBLANK) !== 0) { /* wait for active video */ }
      mem8[WATCHDOG] = 0;
    }
    count = (count - 1) & 0xff;
  } while ((count & 0x80) === 0);

  while ((mem8[IN0] & SERVICE) === 0) { mem8[WATCHDOG] = 0; } // wait for service, kicking the dog
  for (;;) { /* halt: an error stops the machine until it is power-cycled */ }
}
