// SPDX-License-Identifier: GPL-3.0-only
import { loc_0010 } from "./loc_0010.js";
import { loc_0020 } from "./loc_0020.js";
import { loc_01ea } from "./loc_01ea.js";
import { seedTileFillCursor } from "./seedTileFillCursor.js";
import { sendSoundCommand } from "./sendSoundCommand.js";
import { mainLoop } from "./mainLoop.js";
import {
  DSW0_PORT,
  DSW1_PORT,
  NMI_ENABLE_LATCH,
  FLIP_SCREEN_LATCH,
  FLIP_SCREEN_FLAG,
  ROM_SELFTEST_CHECKSUM_TABLE,
  ROM_SELFTEST_TALLY,
  COLOR_RAM_BASE,
  VIDEO_RAM_BASE,
  BONUS_AWARD_DSW,
  CABINET_MODE_FLAG,
  DIFFICULTY_DSW,
  DEMO_SOUNDS_DSW,
  LIVES_DSW,
  COINAGE_TABLE,
  COINAGE_CONFIG,
  COINAGE_CONFIG_SLOT2,
  DISPLAY_CMD_RING_BUFFER,
  DISPLAY_CMD_RING_WRITE_PTR,
  DISPLAY_CMD_RING_READ_PTR,
  SOUND_RING_BUFFER,
  SOUND_RING_WRITE_PTR,
  SOUND_RING_READ_PTR,
  PANEL_DIGIT_SOURCE_TABLE,
  HIGH_SCORE_TABLE,
  HIGH_SCORE_BCD_HI,
  loc_8a42,
} from "./names.js";

/**
 * loc_0092 — power-on boot entry.
 *
 * Checksums the eight 4K program-memory banks against the checksum table, bumping a pass tally that
 * the play-state gate later requires to equal its full-pass value. Then it builds the initial machine
 * state: zeroes work RAM, marks both the display-command and sound-command ring buffers empty and
 * parks their read/write cursors at the origin, floods the colour map, arms the row-by-row tile fill,
 * decodes the two DIP-switch ports into their work-RAM config cells, clears the sprite banks and blanks
 * the lower tile map, silences the audio CPU, enables the vblank interrupt, and lays down the default
 * high-score table. Finally it hands control to the born-live main-loop generator.
 *
 * The banks are checked with a 24-bit rolling sum kept as three bytes (low/mid/high). The tally is
 * seeded with the bank count and incremented once per matching bank, so a wholly-intact image lands at
 * twice the bank count. The self-test writes only the tally cell; every other write is plain state.
 *
 * LIVE-OUT: none — control passes to the main-loop generator, which reads only memory; no register
 * survives as a consumed value.
 */

const BANK_COUNT = 8; //          4K program-memory banks the self-test sums
const BANK_SIZE = 4096; //        bytes per bank (16 pages of 256)
const CKSUM_STRIDE = 3; //        bytes per checksum-table entry (low, mid, high)
const ATTR_FILL = 0x10; //        value flooded across the colour map
const WORK_CLEAR_LEN = 0x7fe; //  work-RAM bytes zeroed (leaves the two-byte tally word at the top)
const SOUND_RING_A42 = 8; //      seeded into the standalone sound-side cell
const RING_EMPTY = 0xff; //       empty-slot marker for both command rings
const DISPLAY_RING_LEN = 0x40; // display-command ring size
const SOUND_RING_LEN = 0x1c; //   sound-command ring size
const DISPLAY_RING_ORIGIN = 0xc0; // display-ring read/write cursor origin
const SOUND_RING_ORIGIN = 0x43; // sound-ring read/write cursor origin
const PANEL_CLEAR_LEN = 0x1e; //  panel digit-source bytes cleared
const HIGH_SCORE_ENTRIES = 10; // default high-score table entries
const HIGH_SCORE_STRIDE = 3; //   bytes per high-score entry

const rotr8 = (v) => ((v >>> 1) | ((v & 1) << 7)) & 0xff;

export function loc_0092(m) {
  const { mem8 } = m;

  // program-memory self-test: 24-bit rolling sum per bank vs its checksum-table entry
  let tally = BANK_COUNT;
  let addr = 0;
  let entry = ROM_SELFTEST_CHECKSUM_TABLE;
  for (let bank = 0; bank < BANK_COUNT; bank++) {
    let lo = 0;
    let mid = 0;
    let hi = 0;
    for (let i = 0; i < BANK_SIZE; i++) {
      const sum = lo + mem8[addr];
      lo = sum & 0xff;
      if (sum > 0xff) {
        mid = (mid + 1) & 0xff;
        if (mid === 0) hi = (hi + 1) & 0xff;
      }
      addr++;
    }
    if (lo === mem8[entry] && mid === mem8[entry + 1] && hi === mem8[entry + 2]) tally++;
    entry += CKSUM_STRIDE;
  }
  mem8[ROM_SELFTEST_TALLY] = tally;

  // clear work RAM (all but the tally word), then seed the loose cell and both command rings
  for (let i = 0; i < WORK_CLEAR_LEN; i++) mem8[BONUS_AWARD_DSW + i] = 0;
  mem8[loc_8a42] = SOUND_RING_A42;
  loc_0010(m, DISPLAY_CMD_RING_BUFFER, RING_EMPTY, DISPLAY_RING_LEN);
  loc_0010(m, SOUND_RING_BUFFER, RING_EMPTY, SOUND_RING_LEN);
  mem8[SOUND_RING_WRITE_PTR] = SOUND_RING_ORIGIN;
  mem8[SOUND_RING_READ_PTR] = SOUND_RING_ORIGIN;
  mem8[DISPLAY_CMD_RING_WRITE_PTR] = DISPLAY_RING_ORIGIN;
  mem8[DISPLAY_CMD_RING_READ_PTR] = DISPLAY_RING_ORIGIN;

  mem8[FLIP_SCREEN_LATCH] = 1; // upright (unflipped) orientation
  mem8[FLIP_SCREEN_FLAG] = 1;

  // flood the colour map; the run is one cell long, spilling the flood value into the tile map's
  // first cell, exactly as the fill's inclusive span does
  for (let a = COLOR_RAM_BASE; a <= VIDEO_RAM_BASE; a++) mem8[a] = ATTR_FILL;
  seedTileFillCursor(m, VIDEO_RAM_BASE); // arm the row-by-row tile fill from the tile-map base

  // decode DIP-switch bank 1 (switches active-low) into its config cells by rotating the
  // complemented port and masking the selected field
  const dsw1 = ~mem8[DSW1_PORT] & 0xff;
  let bits = rotr8(rotr8(dsw1));
  mem8[CABINET_MODE_FLAG] = bits & 0x01;
  bits = rotr8(bits);
  mem8[BONUS_AWARD_DSW] = bits & 0x01;
  bits = rotr8(bits);
  mem8[DIFFICULTY_DSW] = bits & 0x07;
  bits = rotr8(rotr8(rotr8(bits)));
  mem8[DEMO_SOUNDS_DSW] = bits & 0x01;
  const lives = dsw1 & 0x03;
  mem8[LIVES_DSW] = lives === 0x03 ? 0xff : lives + 0x03;

  // decode DIP-switch bank 0 coinage nibbles through the coinage table
  const dsw0 = mem8[DSW0_PORT];
  mem8[COINAGE_CONFIG_SLOT2] = loc_0020(m, COINAGE_TABLE, (dsw0 >> 4) & 0x0f)[0];
  mem8[COINAGE_CONFIG] = loc_0020(m, COINAGE_TABLE, dsw0 & 0x0f)[0];

  loc_01ea(m, mem8[COINAGE_CONFIG]); // clear sprite banks + blank the lower tile map
  sendSoundCommand(m, 0); //           silence the audio CPU
  mem8[NMI_ENABLE_LATCH] = 1; //       enable the vblank interrupt

  // default high-score table: ten (0, 0, 1) entries plus the top-score high byte
  for (let e = 0; e < HIGH_SCORE_ENTRIES; e++) {
    const base = HIGH_SCORE_TABLE + e * HIGH_SCORE_STRIDE;
    mem8[base] = 0;
    mem8[base + 1] = 0;
    mem8[base + 2] = 1;
  }
  mem8[HIGH_SCORE_BCD_HI] = 1;

  loc_0010(m, PANEL_DIGIT_SOURCE_TABLE, 0, PANEL_CLEAR_LEN); // clear the panel digit source

  return mainLoop(m);
}
