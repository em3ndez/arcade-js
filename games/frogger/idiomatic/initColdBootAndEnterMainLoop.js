// SPDX-License-Identifier: GPL-3.0-only
/**
 * initColdBootAndEnterMainLoop  —  ROM 0x02a3  ·  grounding: [code]
 *
 * WHAT IT IS
 *   The cold-boot power-on init — the routine the reset vector falls into. It brings the Frogger board up
 *   from a dead start: it silences the interrupt and video-flip hardware, wipes all of work RAM and the
 *   sprite (OBJRAM) page, reads the operator DIP switches to seed the starting time / cabinet type /
 *   coinage, copies two blocks of ROM-baked defaults into RAM, waits out the hardware power-on settle,
 *   programs the two i8255 parallel-port chips, wakes the sound board with a mute-then-unmute pulse, and
 *   finally hands control to the foreground main loop. Everything downstream — attract mode, coin-in,
 *   play — starts from the RAM and hardware state this routine establishes.
 *
 * WHERE IT SITS
 *   Reached once, from the reset vector (seatStackAndEnterColdBoot at ROM 0x0000) after a hardware reset.
 *   It runs to completion exactly once per power-on and never again; from then on the machine lives inside
 *   the main loop and its vblank NMI. The ordering here is load-bearing: the NMI is held OFF across the
 *   whole RAM wipe and hardware program, and only re-armed once the world it services is coherent.
 *
 * LIVE-OUT
 *   Memory and hardware IO. It zeroes work RAM + OBJRAM, seeds a dozen state cells, programs the PPIs and
 *   sound port, and then tail-hands to drainForegroundThenYieldEachVblank — returning that main-loop
 *   generator as the machine's ongoing driver. It leaves no register the caller reads.
 */
import {
  IN1_PORT, IN2_PORT, FLIP_X_LATCH, FLIP_Y_LATCH, NUM_PLAYERS,
  COCKTAIL_ENABLED_FLAG, COINAGE_WORD, SOUND_CTRL_SHADOW, SOUND_CTRL_PORT,
  OBJRAM_BASE, OBJRAM_CTRL_LO, OBJRAM_CTRL_HI, NMI_ENABLE, PPI1_CTRL, PPI0_CTRL,
  SPIN_DELAY_WORD, SPIN_DELAY_INIT, FANFARE_INDEX, WORK_RAM_TOP, loc_8000,
  SHARED_TIME_BYTE, STARTING_TIME_DSW_TABLE, PLAYER2_SCORE, SCORE_STATE_INIT_SRC,
  SPAWN_RNG_RING_BASE, SPAWN_RING_INIT_SRC,
} from "./names.js";
import { drainForegroundThenYieldEachVblank } from "./drainForegroundThenYieldEachVblank.js";
import { spinWatchdogSettleDelay } from "./spinWatchdogSettleDelay.js";
import { clearTilemapToTile16 } from "./clearTilemapToTile16.js";
import { issueSoundCommand } from "./issueSoundCommand.js";

// Length of the score / high-score / game-state block seeded from ROM defaults: 18 bytes (0x12), copied
// from SCORE_STATE_INIT_SRC (0x2e0a) into RAM starting at PLAYER2_SCORE (0x83eb) and running up through
// the adjacent score/high-score/state cells.
const SCORE_STATE_LEN = 0x12;

// Length of the spawn-RNG ring page seeded from ROM defaults: 32 bytes (0x20), the full ring buffer at
// SPAWN_RNG_RING_BASE (0x8400) that nextSpawnRandomByte later XOR-folds to drive object spawns.
const SPAWN_RING_LEN = 0x20;

export function initColdBootAndEnterMainLoop(m) {
  const { mem8 } = m;

  // ── Silence the hardware before touching RAM ─────────────────────────────────────────
  // Drop the vblank NMI-enable latch NMI_ENABLE (0xb808) to 0 so the frame interrupt cannot fire while we
  // rewrite the very RAM it reads — an NMI mid-wipe would service a half-cleared world. Also zero both
  // screen-flip IO latches FLIP_X_LATCH (0xb810) and FLIP_Y_LATCH (0xb80c) so the display comes up
  // un-flipped regardless of whatever state the flip hardware powered on in.
  mem8[NMI_ENABLE] = 0;
  mem8[FLIP_X_LATCH] = 0;
  mem8[FLIP_Y_LATCH] = 0;

  // ── Wipe work RAM and the sprite page ────────────────────────────────────────────────
  // Zero the whole 2KB of work RAM — from the page base loc_8000 (0x8000) through WORK_RAM_TOP (0x87ff)
  // inclusive — so every game-state cell, counter, and object record starts from a known 0. Then zero the
  // 256-byte OBJRAM sprite page from OBJRAM_BASE (0xb000), clearing any stale sprites the DMA engine would
  // otherwise shovel to the screen.
  for (let addr = loc_8000; addr <= WORK_RAM_TOP; addr++) mem8[addr] = 0;
  for (let i = 0; i < 0x100; i++) mem8[OBJRAM_BASE + i] = 0;

  // ── Seed the starting time from the difficulty DIP switch ─────────────────────────────
  // The operator sets game length via two DIP-switch bits read on IN1_PORT (0xe002). Their value (0..3)
  // indexes the 4-entry ROM table STARTING_TIME_DSW_TABLE (0x2e00); the selected byte becomes the shared
  // start-time SHARED_TIME_BYTE (0x83e4), the value the time bar starts from.
  mem8[SHARED_TIME_BYTE] = mem8[STARTING_TIME_DSW_TABLE + (mem8[IN1_PORT] & 0x03)];

  // ── Cabinet type and coinage from IN2 ────────────────────────────────────────────────
  // IN2_PORT (0xe004) carries two more operator settings. Bit 3 selects a cocktail cabinet (two players
  // facing each other with a flipped screen); when set, raise COCKTAIL_ENABLED_FLAG (0x83c2). Bits 1-2
  // (mask 0x06) are the coinage selector — one of {0,2,4,6} — stored verbatim in COINAGE_WORD (0x83d4),
  // which scanCoinInputAndCredit later uses to index the per-coin credit amount.
  const in2 = mem8[IN2_PORT];
  if (in2 & 0x08) mem8[COCKTAIL_ENABLED_FLAG] = 1; // cocktail cabinet
  mem8[COINAGE_WORD] = in2 & 0x06;

  // ── Copy the ROM score/state defaults into RAM ───────────────────────────────────────
  // Lay down the 18-byte score / high-score / game-state block: copy SCORE_STATE_LEN bytes from the ROM
  // template SCORE_STATE_INIT_SRC (0x2e0a) into RAM at PLAYER2_SCORE (0x83eb) up. This installs the
  // power-on high score and clears the score/state cells to their designed initial values.
  for (let i = 0; i < SCORE_STATE_LEN; i++) mem8[PLAYER2_SCORE + i] = mem8[SCORE_STATE_INIT_SRC + i];

  // ── Wait out the hardware power-on settle ────────────────────────────────────────────
  // Spin a long delay while the board's analog rails and the watchdog settle. spinWatchdogSettleDelay
  // reads the watchdog reset port (0x8800) once per pass so the watchdog stays fed across the wait; the
  // pass count is pure timing and leaves RAM untouched.
  spinWatchdogSettleDelay(m); // power-on settle

  // ── Default to a 1-player game and re-arm the NMI ────────────────────────────────────
  // Set NUM_PLAYERS (0x8370) to 1 as the default (the start buttons promote to 2 later), then write
  // NMI_ENABLE (0xb808) = 1 to re-arm the vblank interrupt. RAM is now coherent, so from this point the
  // frame clock is allowed to fire and the machine begins keeping time.
  mem8[NUM_PLAYERS] = 1;
  mem8[NMI_ENABLE] = 1; // NMI on from here

  // ── Clear the screen ─────────────────────────────────────────────────────────────────
  // Fill all 1024 tilemap cells (0xa800..0xabff) with the blank tile 0x10, so the board comes up blank
  // before attract mode paints anything.
  clearTilemapToTile16(m); // clear the screen

  // ── Program the OBJRAM DMA control bytes ─────────────────────────────────────────────
  // Two control cells inside the OBJRAM DMA block configure the sprite-copy engine: OBJRAM_CTRL_LO
  // (0xb001) = 0 and OBJRAM_CTRL_HI (0xb003) = 6 are the fixed values the hardware expects for normal
  // sprite output.
  mem8[OBJRAM_CTRL_LO] = 0;
  mem8[OBJRAM_CTRL_HI] = 6;

  // ── Seed the main-loop spin count and the fanfare pointer ─────────────────────────────
  // Prime the 16-bit spin-delay counter SPIN_DELAY_WORD (0x83c7) with SPIN_DELAY_INIT (0x0100); the main
  // loop reads it as the busy-wait it spins between NMI firings. Set the arrival-fanfare index
  // FANFARE_INDEX (0x8381) to its power-on value 0x15 (the home-goal handler steps it during play).
  m.mem16[SPIN_DELAY_WORD] = SPIN_DELAY_INIT;
  mem8[FANFARE_INDEX] = 0x15;

  // ── Copy the ROM spawn-RNG ring defaults into RAM ────────────────────────────────────
  // Fill the 32-byte spawn PRNG ring page: copy SPAWN_RING_LEN bytes from the ROM template
  // SPAWN_RING_INIT_SRC (0x2eb1) into the ring buffer at SPAWN_RNG_RING_BASE (0x8400). This gives the
  // object-spawn PRNG a fixed, known seed pool so the first game plays out deterministically.
  for (let i = 0; i < SPAWN_RING_LEN; i++) mem8[SPAWN_RNG_RING_BASE + i] = mem8[SPAWN_RING_INIT_SRC + i];

  // ── Program the two i8255 PPI chips ──────────────────────────────────────────────────
  // Write each PPI's control register to set its port directions. PPI0_CTRL (0xe006) = 0x9b puts PPI0 in
  // mode 0 with all ports as inputs (it reads the control-panel/DIP switches). PPI1_CTRL (0xd006) = 0x88
  // configures PPI1's ports A/B as outputs — that chip drives the sound board.
  mem8[PPI0_CTRL] = 0x9b; // mode0, all inputs
  mem8[PPI1_CTRL] = 0x88; // A/B outputs (sound)

  // ── Mute-pulse the sound board ───────────────────────────────────────────────────────
  // Write 0x18 to both the sound-control RAM shadow SOUND_CTRL_SHADOW (0x83d9) and the live sound-control
  // port SOUND_CTRL_PORT (0xd002) — the mute bit (0x10) is set here — then strobe command 0x00 to the
  // sound board. Muting first keeps the audio hardware quiet while it powers up.
  mem8[SOUND_CTRL_SHADOW] = 0x18;
  mem8[SOUND_CTRL_PORT] = 0x18;

  issueSoundCommand(m, 0x00); // mute-pulse command 0

  // ── Unmute the sound board ───────────────────────────────────────────────────────────
  // Clear the mute bit (0x10) from the shadow value — 0x18 & 0xef = 0x08 — and write it back to both the
  // shadow SOUND_CTRL_SHADOW (0x83d9) and the port SOUND_CTRL_PORT (0xd002), then strobe command 0xff.
  // Sound is now live for the machine.
  const unmuted = mem8[SOUND_CTRL_SHADOW] & 0xef; // clear the mute bit
  mem8[SOUND_CTRL_SHADOW] = unmuted;
  mem8[SOUND_CTRL_PORT] = unmuted;

  issueSoundCommand(m, 0xff); // unmute-pulse command 0xff

  // ── Enter the main loop ──────────────────────────────────────────────────────────────
  // Boot is complete: tail-hand to the foreground main loop drainForegroundThenYieldEachVblank (ROM
  // 0x0341), returning its generator as the machine's ongoing driver. From here the loop free-runs and
  // yields at each vblank, and the NMI armed above services every frame.
  return drainForegroundThenYieldEachVblank(m); // hand back the main-loop generator
}
