// SPDX-License-Identifier: GPL-3.0-only
/**
 * mountOrKillFrogOnTwoPairFigure — frog-vs-diver collision test, gated on the arm bit and dive phase >= 2. Box-checks the
 * frog Y/X against the diver's Y band and X window: an inner overlap tail-calls the frog-kill routine,
 * an outer overlap stamps the mounted-frog tile quad and raises the mount flag. LIVE-OUT: memory-only.
 */
import { loc_8150, loc_83b7, FROG_Y, FROG_X, loc_8101, HOLD_FLAG, loc_a846 } from "./names.js";

const KILL_TAIL = 0x12d0;

const DIVE_PHASE_MIN = 2;
const BOX_Y_LOW = 42, BOX_Y_HIGH = 59; // frog-Y band (after the +8 bias) overlapping the diver
const X_WINDOW = 32;
const BIAS = 8; // half-tile bias on the frog Y/X and diver X edges
const MOUNT_TILE = 104; // first of the 2x2 mounted-frog tile quad (104..107)
const ROW_STRIDE = 32;

export function mountOrKillFrogOnTwoPairFigure(m) {
  const { mem8 } = m;

  if ((mem8[loc_8150] & 1) === 0) return;
  if (mem8[loc_83b7] < DIVE_PHASE_MIN) return;

  const frogTop = (mem8[FROG_Y] + BIAS) & 0xff;
  if (frogTop < BOX_Y_LOW || frogTop >= BOX_Y_HIGH) return;

  const frogRight = (mem8[FROG_X] + BIAS) & 0xff;
  const diverX = mem8[loc_8101];
  if (((diverX + BIAS) & 0xff) < frogRight) return;
  if (((diverX - X_WINDOW) & 0xff) >= frogRight) return;

  if (((diverX - BIAS) & 0xff) >= frogRight) { // outer overlap -> ride the diver
    mem8[HOLD_FLAG] = 1;
    mem8[loc_a846] = MOUNT_TILE;
    mem8[(loc_a846 + 1) & 0xffff] = MOUNT_TILE + 1;
    mem8[(loc_a846 + ROW_STRIDE) & 0xffff] = MOUNT_TILE + 2;
    mem8[(loc_a846 + ROW_STRIDE + 1) & 0xffff] = MOUNT_TILE + 3;
    return;
  }

  m.push16(0x28ee); // inner overlap -> frog-kill tail
  m.call(KILL_TAIL);
}
