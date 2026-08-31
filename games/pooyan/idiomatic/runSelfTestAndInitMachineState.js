// SPDX-License-Identifier: GPL-3.0-only
import { fillByteRun } from "./fillByteRun.js";
import { fetchByteFromTableIndex } from "./fetchByteFromTableIndex.js";
import { clearSpriteBanksAndBlankVideoRam } from "./clearSpriteBanksAndBlankVideoRam.js";
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
 * runSelfTestAndInitMachineState — power-on boot entry.
 *
 * WHAT IT IS: the first game code the processor runs after the reset vector. It performs the
 * power-on self-test, then establishes the entire initial state of the machine before a single
 * frame is drawn, and finally hands control to the free-running main loop that never returns.
 *
 * ROLE IN THE MACHINE: this routine is the boundary between a cold, uninitialised board and a
 * playable machine. Nothing else seeds the DIP-derived configuration, empties the two command
 * rings, paints the blank field, or lays down the default high-score table — every later subsystem
 * assumes that work is already done. Crucially it also gates the whole machine on program
 * integrity: it writes a self-test pass tally that the play-state gate later refuses to run the
 * game without, so a corrupt program image is caught here and the board never leaves the test.
 *
 * ROM ADDRESS: 0x0092 (runs through 0x01d2), reached by the reset vector's jump into it.
 * Grounding: [seen].
 *
 * WHAT IT DOES, IN ORDER:
 *   1. Checksums the eight 4K program-memory banks against the reference checksum table, bumping a
 *      pass tally once per intact bank.
 *   2. Zeroes work RAM (all but the tally word parked above the stack), seeds one sound-side cell,
 *      marks both the display-command and the sound-command rings empty, and parks their read and
 *      write cursors at the origin.
 *   3. Seeds the upright (unflipped) screen orientation.
 *   4. Floods the colour map with the default attribute and arms the row-by-row tile fill.
 *   5. Decodes the two DIP-switch ports into their work-RAM configuration cells.
 *   6. Clears the sprite banks and blanks the lower tile map, silences the audio processor, and
 *      enables the vblank interrupt.
 *   7. Lays down the default high-score table and clears the status-panel digit source.
 *   8. Hands control to the main loop.
 *
 * THE CHECKSUM SCHEME: each bank is folded into a 24-bit rolling sum kept as three bytes
 * (low/mid/high) and compared against that bank's three-byte reference entry in the checksum
 * table. The tally is seeded with the bank count and incremented once per matching bank, so a
 * wholly-intact image lands at exactly twice the bank count. The self-test writes only the tally
 * cell; every other write in the routine is plain machine state.
 *
 * LIVE-OUT: none — control passes to the main loop, which reads only memory; no register survives
 * as a consumed value. Everything this routine produces lives in RAM and hardware latches.
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

export function runSelfTestAndInitMachineState(m) {
  const { mem8 } = m;

  // === STEP 1 — power-on self-test over the eight 4K program-memory banks ===
  // Fold each bank into a 24-bit rolling sum held as three bytes (lo/mid/hi) and compare it against
  // that bank's three-byte reference entry in the checksum table (ROM_SELFTEST_CHECKSUM_TABLE,
  // 0x0079). An exact three-byte match bumps the pass tally. The tally starts at the bank count
  // (8) and is bumped once per intact bank, so a wholly-good image ends at 0x10 — the value the
  // later play-state gate demands before it will run the game. `addr` walks the whole 32K program
  // space one byte at a time; `entry` steps three bytes per bank through the reference table.
  let tally = BANK_COUNT;
  let addr = 0;
  let entry = ROM_SELFTEST_CHECKSUM_TABLE;
  for (let bank = 0; bank < BANK_COUNT; bank++) {
    let lo = 0;
    let mid = 0;
    let hi = 0;
    // Accumulate one 4K bank byte by byte into the three-byte sum: a carry out of the low byte
    // bumps the mid byte, and a carry out of the mid byte bumps the high byte (a 24-bit add).
    for (let i = 0; i < BANK_SIZE; i++) {
      const sum = lo + mem8[addr];
      lo = sum & 0xff;
      if (sum > 0xff) {
        mid = (mid + 1) & 0xff;
        if (mid === 0) hi = (hi + 1) & 0xff;
      }
      addr++;
    }
    // A bank passes only when all three sum bytes match its reference entry; count the pass and
    // advance to the next bank's three-byte entry.
    if (lo === mem8[entry] && mid === mem8[entry + 1] && hi === mem8[entry + 2]) tally++;
    entry += CKSUM_STRIDE;
  }
  // Record the pass count where the play-state gate later reads it. The tally cell sits at the very
  // top of the work page (0x8fff), deliberately above the boot stack so the per-frame interrupt's
  // register save cannot overwrite it.
  mem8[ROM_SELFTEST_TALLY] = tally;

  // === STEP 2 — wipe work RAM to a known-blank state, then set up the two command rings ===
  // Zero the work-RAM page from 0x8800 upward for WORK_CLEAR_LEN (0x7fe) bytes, which stops two
  // bytes short of the top and so leaves the stack word and the self-test tally at 0x8ffe-0x8fff
  // intact. After this every game-state cell reads 0 until something deliberately seeds it.
  for (let i = 0; i < WORK_CLEAR_LEN; i++) mem8[BONUS_AWARD_DSW + i] = 0;
  // Seed the sound-side work cell that sits just below the sound-command ring buffer (0x8a42) to 8.
  mem8[loc_8a42] = SOUND_RING_A42;
  // Mark both command rings empty. A slot holding the empty marker (0xff) is an unused slot: the
  // display-command ring is 0x40 bytes at 0x88c0, the sound-command ring is 0x1c bytes at 0x8a43.
  fillByteRun(m, DISPLAY_CMD_RING_BUFFER, RING_EMPTY, DISPLAY_RING_LEN);
  fillByteRun(m, SOUND_RING_BUFFER, RING_EMPTY, SOUND_RING_LEN);
  // Park each ring's read and write cursors at the ring's origin so producer and consumer start
  // aligned on an empty buffer: the sound ring at 0x43, the display ring at 0xc0.
  mem8[SOUND_RING_WRITE_PTR] = SOUND_RING_ORIGIN;
  mem8[SOUND_RING_READ_PTR] = SOUND_RING_ORIGIN;
  mem8[DISPLAY_CMD_RING_WRITE_PTR] = DISPLAY_RING_ORIGIN;
  mem8[DISPLAY_CMD_RING_READ_PTR] = DISPLAY_RING_ORIGIN;

  // === STEP 3 — seed the upright screen orientation ===
  // The screen-flip control line is inverted in hardware, so a stored 1 selects the normal upright
  // display (a stored 0 would mirror it for a cocktail cabinet's second player). The routine writes
  // both the hardware latch (0xa187 bit 7) and the work-RAM mirror flag (0x881f); the per-frame
  // interrupt copies the flag back into the latch each vblank, so the flag is the master copy.
  mem8[FLIP_SCREEN_LATCH] = 1; // upright (unflipped) orientation
  mem8[FLIP_SCREEN_FLAG] = 1;

  // === STEP 4 — flood the colour plane, then arm the tile fill ===
  // The playfield is two parallel 1K planes over one 32x32 cell grid: the colour/attribute plane
  // at 0x8000-0x83ff and the tile-code plane at 0x8400-0x87ff. Flood every colour cell with the
  // default attribute (0x10). The span is inclusive of VIDEO_RAM_BASE, so the flood writes one cell
  // past the colour plane into the tile plane's first cell (0x8400) — the original fill's span is
  // inclusive of its end address the same way, and that one spilled cell is overwritten by the tile
  // fill that follows.
  for (let a = COLOR_RAM_BASE; a <= VIDEO_RAM_BASE; a++) mem8[a] = ATTR_FILL;
  // Arm the row-by-row tile fill by seeding its write cursor at the tile-plane base (0x8400); a
  // later state handler walks the cursor down the grid one row at a time to blank the field.
  seedTileFillCursor(m, VIDEO_RAM_BASE); // arm the row-by-row tile fill from the tile-map base

  // === STEP 5a — decode DIP-switch bank 1 (DSW1) into the cabinet-shaped config cells ===
  // The switch banks are wired active-low (an off switch reads 1), so the port is complemented once
  // up front; every field below is read from that complemented value. Each field is brought down to
  // bit 0 by right-rotating and then masked out — the rotations are cumulative through the chain.
  const dsw1 = ~mem8[DSW1_PORT] & 0xff;
  // Two rotations put DSW1 bit 2 into bit 0: the cabinet (upright vs cocktail) flag.
  let bits = rotr8(rotr8(dsw1));
  mem8[CABINET_MODE_FLAG] = bits & 0x01;
  // One more rotation exposes DSW1 bit 3: the bonus/extra-life award-schedule selector.
  bits = rotr8(bits);
  mem8[BONUS_AWARD_DSW] = bits & 0x01;
  // One more rotation exposes DSW1 bits 4-6 (masked to 3 bits): the difficulty level.
  bits = rotr8(bits);
  mem8[DIFFICULTY_DSW] = bits & 0x07;
  // Three more rotations expose DSW1 bit 7: the demo/attract-sounds enable.
  bits = rotr8(rotr8(rotr8(bits)));
  mem8[DEMO_SOUNDS_DSW] = bits & 0x01;
  // Starting lives comes from DSW1's low two bits (of the complemented value): a pair of 3 selects
  // the special 0xff setting, otherwise the pair plus 3 gives 3, 4, or 5 lives.
  const lives = dsw1 & 0x03;
  mem8[LIVES_DSW] = lives === 0x03 ? 0xff : lives + 0x03;

  // === STEP 5b — decode DIP-switch bank 0 (DSW0), the coinage bank ===
  // DSW0 is read straight (not complemented). Each of its two nibbles indexes the ROM coinage
  // table (COINAGE_TABLE, 0x0053), which maps a switch nibble to a packed coin-to-credit
  // descriptor. The high nibble configures coin slot 2 (0x882f); the low nibble configures coin
  // slot 1 (0x882c). A resulting descriptor of 0x0f means free play, which the credit logic tests
  // for later.
  const dsw0 = mem8[DSW0_PORT];
  mem8[COINAGE_CONFIG_SLOT2] = fetchByteFromTableIndex(m, COINAGE_TABLE, (dsw0 >> 4) & 0x0f)[0];
  mem8[COINAGE_CONFIG] = fetchByteFromTableIndex(m, COINAGE_TABLE, dsw0 & 0x0f)[0];

  // === STEP 6 — clear the sprite banks and lower tile map, silence audio, arm the interrupt ===
  // Clear both sprite banks and blank the lower tile map so no stale sprites or tiles show on the
  // first frame. Send sound command 0 to the audio processor to silence it. Finally set bit 0 of
  // the control latch (0xa180) to enable the vblank interrupt: from here on the per-frame interrupt
  // runs, so every write above had to be finished before this point.
  clearSpriteBanksAndBlankVideoRam(m, mem8[COINAGE_CONFIG]); // clear sprite banks + blank the lower tile map
  sendSoundCommand(m, 0); //           silence the audio CPU
  mem8[NMI_ENABLE_LATCH] = 1; //       enable the vblank interrupt

  // === STEP 7a — lay down the default high-score table ===
  // The table holds ten 3-byte BCD entries at 0x8a00. Each entry is seeded to (0, 0, 1): the top
  // byte is the score's most-significant BCD byte, so an entry of 0x01 0x00 0x00 reads as the
  // familiar 10000-point default. The live top-score most-significant byte (0x88aa) is seeded to 1
  // for the same reason. This runs after the interrupt is armed, but it only touches RAM.
  for (let e = 0; e < HIGH_SCORE_ENTRIES; e++) {
    const base = HIGH_SCORE_TABLE + e * HIGH_SCORE_STRIDE;
    mem8[base] = 0;
    mem8[base + 1] = 0;
    mem8[base + 2] = 1;
  }
  mem8[HIGH_SCORE_BCD_HI] = 1;

  // === STEP 7b — clear the status-panel digit source ===
  // Zero the 0x1e-byte work-RAM table (ten 3-byte rows) that later feeds packed-BCD digits into the
  // on-screen status panel, so the panel starts blank rather than showing leftover RAM.
  fillByteRun(m, PANEL_DIGIT_SOURCE_TABLE, 0, PANEL_CLEAR_LEN); // clear the panel digit source

  // === STEP 8 — hand control to the main loop ===
  // The initial machine state is fully established. Enter the free-running main loop, which drains
  // the display-command ring and runs the per-frame work; it never returns to the boot code.
  return mainLoop(m);
}
