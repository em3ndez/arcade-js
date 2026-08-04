// SPDX-License-Identifier: GPL-3.0-only
/**
 * serviceVblankNmi — the vblank NMI handler: one frame of interrupt service.  ROM 0x0066.
 *
 * Donkey Kong runs everything time-critical off the vblank NMI (it uses NMI, not
 * IM1 — the bytes at 0x0038 are an ordinary subroutine). Once per frame the video
 * hardware asserts the NMI at the frame boundary and the CPU vectors here. The
 * handler does the frame's fixed housekeeping, in ROM order:
 *
 *   1. Acknowledge — clear the interrupt-enable latch (0x7D84 <- 0). That IS the
 *      ack, and because the latch gates the NMI it also blocks re-entry until the
 *      epilogue re-enables it, so a second vblank cannot nest into this handler.
 *   2. Watchdog + SERVICE — read IN2 (0x7D00). The READ is the watchdog kick (the
 *      dog is fed exactly once per vblank, as a side effect); bit 0 is the SERVICE
 *      switch, which would `jp 0x4000` into a diagnostic ROM this romset does not
 *      ship — out of policy, so it throws instead of running off into 0x4000.
 *   3. Sprite DMA — blit the sprite shadow buffer (0x6900) into sprite RAM (0x7000)
 *      through the i8257, programmed from the 9-byte block at ROM 0x0138 (HL).
 *   4. Controls — when a credited game is in play (ATTRACT == 0) read and
 *      edge-debounce the joystick into P1_INPUT (0x6010/0x6011); attract skips input.
 *   5. Per-frame work + epilogue — decrement the frame counter at 0x601A (which is
 *      what releases the main loop's vblank spin), stir the RNG, drain the sound and
 *      task schedulers, dispatch on GAME_STATE (0x6005) through the 4-entry table at
 *      ROM 0x00CA, then restore the interrupted registers and re-enable the NMI.
 *
 * Callees: all three are idiomatic and called directly — blitSpritesViaDma (the sprite
 * blit), readControls (ROM 0x0087) and perFrame (ROM 0x00B5, the tail + epilogue), the
 * last of which owns step 5 and the register/NMI-mask restore. The 0x0087 and 0x00B5
 * imports were dissolved from the frozen oracle in the same unit that wrote this note.
 * ★ NOTE THIS ROUTINE IS DEAD AT RUNTIME: Machine.fireNmi calls the TRANSLATED loc_0066
 * directly, so nothing here executes under the flip, swap_check, or the shipped player
 * (0 calls measured). It is still gated by equivalence-0066. The dissolves above are
 * therefore readability-only, with zero runtime effect — do not read them as behaviour.
 *
 * The oracle opens by pushing AF/BC/DE/HL/IX/IY (12 bytes) and loc_00b5's epilogue
 * pops them back: that save/restore is the interrupt ABI (it hands the interrupted
 * main loop its registers back untouched). The idiomatic layer does NOT model the
 * register save — the registers are dead to the memory gate — but loc_00b5 is still
 * the frozen oracle and its epilogue unconditionally pops that 12-byte frame + the
 * return PC. So the one concession this routine makes to the oracle's Z80 ABI is to
 * RESERVE the 12-byte frame (advance SP by 12) before calling loc_00b5, exactly where
 * the six pushes would have left SP. That keeps loc_00b5's pops in mapped RAM (without
 * it they overrun past 0x6C00) and makes its SP arithmetic and the final `ret` land
 * IDENTICALLY to the oracle: SP returns to the interrupted value and the popped PC is
 * the real return address. The reserved bytes and the whole stack live inside
 * STACK_SCRATCH [0x6be0,0x6c00) — the DK stack, NMI included, measured never to dip
 * below 0x6be0 — so they are masked from the gate. (Consequence: memory + SP + pc are
 * faithful; the popped REGISTER VALUES are dead scratch, not the saved originals —
 * fine for the gate, and the reviewer's only caveat for a future LIVE wiring. Note
 * fireNmi calls the oracle directly today, not via the manifest, so nothing wires
 * this routine; a live wiring would additionally need the real register restore.)
 *
 * Memory-equivalent to the frozen oracle — equivalence-0066.test.js.
 * GATE:     crafted-entry — dispatched every vblank, so the attract/dispatch path is
 *           covered by real captured NMI entries; the game-in-play arm (loc_0087,
 *           reached only when ATTRACT == 0) by a crafted 0x6007=0 entry. FRESH clone
 *           per case (it writes RAM everywhere). Teeth included.
 * LIVE-OUT: memory-only — the work/sprite/video RAM the frame produces (frame counter,
 *           RNG, input latch, sound/task rings, and whatever the GAME_STATE handler
 *           writes). SP and pc happen to match the oracle too (the reserved frame makes
 *           loc_00b5's epilogue restore them), but the test does not rely on that and
 *           the register FILE is EXCLUDED — the oracle's saved-register values are the
 *           modelled interrupt ABI the direct-call layer drops. All stack traffic lands
 *           in the excluded STACK_SCRATCH region (verified: min SP over a 2600-frame
 *           run == 0x6be0, the region's low bound).
 * NAMES:    ATTRACT (0x6007) from names.js. Board I/O 0x7D84 (NMI-enable latch) and
 *           0x7D00 (IN2 / watchdog kick, bit 0 = SERVICE) stay hex — they are control
 *           ports, not work RAM (names.js is work-RAM only). The DMA setup block at
 *           0x0138 is a ROM constant, kept hex as in blitSpritesViaDma.
 */

import { NotImplemented } from "../../../boards/dkong/io.js";
import { ATTRACT } from "./names.js";
import { blitSpritesViaDma } from "./blitSpritesViaDma.js";
import { readControls } from "./readControls.js"; // ROM 0x0087
import { perFrame } from "./perFrame.js"; //        ROM 0x00B5

// Board control ports (io side, NOT work RAM — never appear in the state dump).
const NMI_ENABLE = 0x7d84; // interrupt-enable latch; cleared to ack, re-enabled by perFrame
const IN2_WATCHDOG = 0x7d00; // IN2 read (the read kicks the watchdog); bit 0 = SERVICE switch

// ROM address of the 9-byte i8257 setup block the DMA blit programs from.
const DMA_SETUP_BLOCK = 0x0138;

export function serviceVblankNmi(m) {
  const { regs, mem } = m;

  // 1. Acknowledge the NMI (and lock out re-entry until loc_00b5 re-enables it).
  mem.write8(NMI_ENABLE, 0);

  // 2. Kick the watchdog (the read is the kick) and reject the SERVICE switch.
  if (mem.read8(IN2_WATCHDOG) & 0x01) {
    throw new NotImplemented(
      "SERVICE switch held: jp 0x4000 at ROM 0x0077 -- out-of-policy input, " +
        "no diagnostic ROM exists on this romset",
    );
  }

  // 3. Blit the sprite shadow buffer to sprite RAM. blitSpritesViaDma reads HL as
  //    the setup-block pointer, exactly as the ROM `ld hl,0x0138 / call 0x0141`.
  regs.hl = DMA_SETUP_BLOCK;
  blitSpritesViaDma(m);

  // 4. Read + debounce the controls only while a credited game is in play; attract
  //    (ATTRACT != 0) leaves the input latch alone.
  if (mem.read8(ATTRACT) === 0) {
    readControls(m);
  }

  // 5. Frame counter, RNG, schedulers, GAME_STATE dispatch, and the restore epilogue.
  //    perFrame's epilogue unwinds the 12-byte register-save frame the ROM prologue
  //    pushed, plus the return PC. We don't model the register save (registers are dead
  //    here), so RESERVE that frame — advance SP by 12, exactly where the six pushes would
  //    leave it — so perFrame's `sp = frameBase + 12` lands on the return PC and its
  //    `ret` matches the oracle byte for byte. The reserved bytes are inside STACK_SCRATCH
  //    and never read as live data. The reservation is still required with the idiomatic
  //    twin: it does the SAME frameBase arithmetic the oracle's pops did.
  regs.sp = (regs.sp - 12) & 0xffff;
  perFrame(m);
}
