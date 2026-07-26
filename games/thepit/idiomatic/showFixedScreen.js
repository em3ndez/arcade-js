// SPDX-License-Identifier: GPL-3.0-only
/**
 * showFixedScreen — paint a canned full-screen image from ROM and hold it briefly.  ROM 0x3b81.
 *
 * Puts one prebuilt static screen up and leaves it on view for a moment. The whole
 * playfield is a fixed 32x32 tile picture baked into ROM; this routine drops it on
 * screen wholesale and tints the entire display one flat colour, then pauses so the
 * player can read it before the game moves on. In order it:
 *
 *   1. Runs the blank-screen display setup (clears the tilemap and colour RAM to the
 *      neutral board-mode background), then waits a single frame for it to take.
 *   2. Copies the prebuilt full-screen tile image out of ROM into the entire tilemap,
 *      one tile per cell, replacing the blanked screen with the picture.
 *   3. Floods the whole colour RAM with one flat colour attribute, so the picture
 *      shows in a single uniform palette.
 *   4. Holds the finished screen for 160 frames, then returns to its caller.
 *
 * Which particular screen this is (a title/intermission/interstitial) is not yet
 * pinned; the name asserts only the mechanism — a fixed full-screen image shown for a
 * fixed spell — which is exactly what the code does.
 *
 * The blank-screen setup (0x4b44) is still the frozen oracle, reached through the
 * registry; its call is bracketed with the return address it pops off the work stack,
 * a genuine oracle boundary that keeps the stack byte-identical to the original. The
 * frame-wait (waitFrames) is already decompiled but kept its register-in / stack-return
 * boundary, so the frame count is handed to it in the machine and its non-tail call is
 * likewise bracketed with the return address it pops. The final wait is a tail call: its
 * return unwinds straight to showFixedScreen's caller, so it is this routine's exit.
 *
 * Memory-equivalent to the frozen oracle — equivalence-3b81.test.js.
 * GATE:     crafted-harness — dispatched once in a boot/attract run (~frame 530). It is
 *           straight-line with no input-dependent branch, so that single real dispatch
 *           exercises the whole path; oracle vs idiomatic are diffed on clones of the
 *           captured entry on the memory-equivalence contract (RAM + pc + SP). Both frame
 *           waits busy-wait on a countdown the per-frame interrupt drains in the live
 *           game, so the isolated replay models that once-per-frame tick identically on
 *           both sides (the same discipline waitFrames uses). Teeth: a wrong flat-colour
 *           twin and a short image-copy twin.
 * LIVE-OUT: memory-only — the full tilemap image (video RAM), the flooded colour RAM, the
 *           frame-countdown left at 0, plus the balanced work stack and the return to the
 *           caller (pc/SP). The register file the paint leaves is dead: the routine exits
 *           through the frame-wait tail call and the caller chain reads no returned register.
 * NAMES:    none from ram.js apply — video RAM (0x9000..0x93ff), colour RAM (0x8800..0x8bff)
 *           and the ROM image source (0x3e32) are fixed hardware/ROM addresses, not work RAM.
 */
import { waitFrames } from "./waitFrames.js";

const VIDEO_RAM_BASE = 0x9000; // start of the 32x32 tilemap the display reads
const COLOR_RAM_BASE = 0x8800; // start of the per-tile colour RAM
const SCREEN_IMAGE_SOURCE = 0x3e32; // ROM address of the prebuilt full-screen tile image
const SCREEN_CELLS = 1024; // the whole 32x32 tilemap / colour RAM (0x9000..0x93ff, 0x8800..0x8bff)
const SCREEN_ATTRIBUTE = 147; // the one flat colour attribute painted across the whole screen

export function showFixedScreen(m) {
  const { mem } = m;

  // 1. Blank the screen to the neutral background, then let a frame pass.
  //    0x4b44 is still the frozen oracle and returns through the work stack, so seed
  //    the return address it pops (0x3b84, where it lands back in this routine).
  m.push16(0x3b84);
  m.call(0x4b44);
  m.push16(0x3b89); // the frame-wait returns here, back into this routine
  waitFrames(m, 1); // one frame to wait

  // 2. Stamp the prebuilt full-screen tile image over the blanked tilemap.
  for (let cell = 0; cell < SCREEN_CELLS; cell++) {
    mem.write8(VIDEO_RAM_BASE + cell, mem.read8(SCREEN_IMAGE_SOURCE + cell));
  }

  // 3. Tint the entire display one flat colour.
  for (let cell = 0; cell < SCREEN_CELLS; cell++) {
    mem.write8(COLOR_RAM_BASE + cell, SCREEN_ATTRIBUTE);
  }

  // 4. Hold the finished screen for 160 frames. This is a tail call: the frame-wait's
  //    return unwinds straight to showFixedScreen's caller, so it is this routine's exit.
  return waitFrames(m, 160);
}
