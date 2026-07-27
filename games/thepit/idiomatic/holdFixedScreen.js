// SPDX-License-Identifier: GPL-3.0-only
/**
 * holdFixedScreen — paint a canned full-screen image from ROM, then hold it on display forever.  ROM 0x3ba8.
 *
 * Puts one prebuilt static screen up and then never leaves it — this is a terminal
 * "hold this screen" state, escaped only by the watchdog reset on hardware. It is the
 * never-returning sibling of showFixedScreen (0x3b81), which shows its screen for a
 * fixed spell and returns; this one shows its screen and stays there. In order it:
 *
 *   1. Waits a single frame so the previous display setup settles.
 *   2. Copies a prebuilt full-screen tile image out of ROM into the entire tilemap,
 *      one tile per cell.
 *   3. Floods the whole colour RAM with one flat background attribute, then paints
 *      three accent colour strips down the playfield (each a full-height column in
 *      its own colour), and draws the fixed setup/credits panel.
 *   4. Then loops forever displaying the finished screen: each pass advances one
 *      column's colour by a step (a slow colour-cycle shimmer), holds for 15 frames,
 *      and re-reads the cabinet DIP switches so an operator's setting changes take
 *      effect while the screen is up. Control never comes back.
 *
 * Which particular screen this is is not pinned (the ROM image is raw tile codes); the
 * name asserts only the mechanism — a canned full-screen image held on view forever
 * with a per-pass colour shimmer — which is exactly what the code does.
 *
 * The frame image copy and colour flood are plain memory writes. The accent strips, the
 * setup panel, the per-pass colour step, and the DIP decode are all already decompiled and
 * called directly by name. The frame-wait (waitFrames) still keeps its register-in /
 * stack-return boundary, so each wait is handed its frame count as an argument and bracketed
 * with the address it pops on return.
 *
 * Memory-equivalent to the frozen oracle — equivalence-3ba8.test.js.
 * GATE:     crafted-entry — never reached in a plain boot/attract run (only showCreditScreen
 *           tail-hands here, and only on the warm-restart flag a plain attract never sets, so
 *           0 dispatches). The gate runs it from a real captured attract state. The two frame
 *           waits busy-wait on a countdown the per-frame interrupt drains in the live game, so
 *           the harness models that once-per-frame tick identically on both sides; the display
 *           loop never returns, so the harness bounds it by throwing after a fixed number of
 *           frame ticks — enough to cover the full setup plus one complete display pass — and
 *           diffs both arms at that point. Teeth: a corrupted colour cell and a corrupted image
 *           cell, both caught outside the dead stack scratch.
 * LIVE-OUT: none — the routine never returns (the display loop spins forever). Its whole effect
 *           is memory: the canned tile image in video RAM, the flooded + striped colour RAM, the
 *           setup panel, the DIP-decoded parameter block, and the per-pass colour step.
 * NAMES:    none from ram.js apply to the painted regions — video RAM (0x9000..0x93ff), colour
 *           RAM (0x8800..0x8bff) and the ROM image source (0x4232) are fixed hardware/ROM
 *           addresses. The DIP / parameter / colour work-RAM cells are written inside the
 *           decompiled callees (applyDipSwitches, cycleStagedColumnColour, drawSetupCreditsPanel),
 *           which carry their own names.
 */

import { waitFrames } from "./waitFrames.js";
import { fillColourColumnAt } from "./fillColourColumnAt.js";
import { drawSetupCreditsPanel } from "./drawSetupCreditsPanel.js";
import { cycleStagedColumnColour } from "./cycleStagedColumnColour.js";
import { applyDipSwitches } from "./applyDipSwitches.js";

const VIDEO_RAM_BASE = 0x9000; // start of the 32x32 tilemap the display reads
const COLOR_RAM_BASE = 0x8800; // start of the per-tile colour RAM
const SCREEN_IMAGE_SOURCE = 0x4232; // ROM address of the prebuilt full-screen tile image
const SCREEN_CELLS = 1024; // the whole 32x32 tilemap / colour RAM (0x9000..0x93ff, 0x8800..0x8bff)
const BACKGROUND_ATTRIBUTE = 2; // the flat colour flooded across the whole screen before the strips

// The three accent colour strips: [column offset from the colour-RAM top-of-column anchor, colour].
const ACCENT_STRIPS = [
  [18, 7],
  [22, 4],
  [26, 6],
];

export function holdFixedScreen(m) {
  const { mem8 } = m;

  // 1. Let the previous display setup settle for one frame. The frame-wait returns here,
  //    back into this routine, so hand it that resume address.
  m.push16(0x3bad);
  waitFrames(m, 1);

  // 2. Stamp the prebuilt full-screen tile image over the tilemap.
  for (let cell = 0; cell < SCREEN_CELLS; cell++) {
    mem8[VIDEO_RAM_BASE + cell] = mem8[SCREEN_IMAGE_SOURCE + cell];
  }

  // 3. Flood the whole display one flat background colour, then paint the three accent
  //    colour strips over it and draw the fixed setup/credits panel.
  for (let cell = 0; cell < SCREEN_CELLS; cell++) {
    mem8[COLOR_RAM_BASE + cell] = BACKGROUND_ATTRIBUTE;
  }
  for (const [columnOffset, colour] of ACCENT_STRIPS) {
    fillColourColumnAt(m, columnOffset, colour);
  }
  drawSetupCreditsPanel(m);

  // 4. Hold the finished screen forever: shimmer one column's colour a step, wait 15
  //    frames, and re-decode the DIP switches. This loop never exits — the routine
  //    never returns to its caller.
  for (;;) {
    cycleStagedColumnColour(m);

    m.push16(0x3be7); // the frame-wait returns here, back into this loop
    waitFrames(m, 15);

    applyDipSwitches(m);
  }
}
