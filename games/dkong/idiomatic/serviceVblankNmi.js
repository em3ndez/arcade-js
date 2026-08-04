// SPDX-License-Identifier: GPL-3.0-only
/**
 * serviceVblankNmi — the vblank NMI handler: one frame of interrupt service.
 *
 * Donkey Kong runs everything time-critical off the vblank NMI — the non-maskable
 * interrupt, not the maskable one. Once per frame the video hardware asserts the NMI
 * at the frame boundary and the CPU vectors here. The handler does the frame's fixed
 * housekeeping, in order:
 *
 *   1. Acknowledge — clear the interrupt-enable latch. That IS the ack, and because
 *      the latch gates the NMI it also blocks re-entry until the epilogue re-enables
 *      it, so a second vblank cannot nest into this handler.
 *   2. Watchdog + SERVICE — read the coin/start input port. The READ is the watchdog
 *      kick (the dog is fed exactly once per vblank, as a side effect); bit 0 is the
 *      SERVICE switch, which would jump into a diagnostic image this romset does not
 *      ship — out of policy, so it throws instead of running off into unmapped space.
 *   3. Sprite DMA — blit the sprite shadow buffer into sprite RAM through the i8257,
 *      programmed from a 9-byte setup block.
 *   4. Controls — when a credited game is in play (ATTRACT == 0) read and edge-
 *      debounce the joystick into the input latch; attract skips input entirely.
 *   5. Per-frame work + epilogue — decrement the frame counter (which is what releases
 *      the main loop's vblank spin), stir the RNG, drain the sound and task
 *      schedulers, dispatch on the game state, then restore the interrupted registers
 *      and re-enable the NMI.
 *
 * THE 12-BYTE STACK RESERVE, and why it is here. On hardware the handler's prologue
 * pushes six register pairs — 12 bytes — and the per-frame tail's epilogue pops them
 * back; that save/restore is the interrupt ABI, handing the interrupted main loop its
 * registers back untouched. This layer does NOT model the register save, because those
 * registers are dead to it — but the epilogue still unconditionally pops that 12-byte
 * frame plus the return address. So the one concession made here is to RESERVE the
 * frame — advance the stack pointer by 12, exactly where the six pushes would have
 * left it. That keeps the epilogue's pops inside mapped RAM and makes its stack
 * arithmetic and its final return land where they would have: the stack pointer comes
 * back to the interrupted value and the popped return address is the real one.
 * Consequence: memory, the stack pointer and the return address are faithful, while
 * the popped REGISTER VALUES are dead scratch rather than the saved originals.
 *
 * LIVE-OUT: memory-only — the work, sprite and video RAM the frame produces: the frame
 * counter, the RNG, the input latch, the sound and task rings, and whatever the
 * game-state handler writes.
 */

import { NotImplemented } from "../../../boards/dkong/io.js";
import { ATTRACT } from "./names.js";
import { blitSpritesViaDma } from "./blitSpritesViaDma.js";
import { readControls } from "./readControls.js";
import { perFrame } from "./perFrame.js";

// Board control ports (io side, NOT work RAM — never appear in the state dump).
const NMI_ENABLE = 0x7d84; // interrupt-enable latch; cleared to ack, re-enabled by the tail
const IN2_WATCHDOG = 0x7d00; // IN2 read (the read kicks the watchdog); bit 0 = SERVICE switch

// Address of the 9-byte i8257 setup block the DMA blit programs from.
const DMA_SETUP_BLOCK = 0x0138;

export function serviceVblankNmi(m) {
  const { regs, mem } = m;

  // 1. Acknowledge the NMI (and lock out re-entry until the tail re-enables it).
  mem.write8(NMI_ENABLE, 0);

  // 2. Kick the watchdog (the read is the kick) and reject the SERVICE switch.
  if (mem.read8(IN2_WATCHDOG) & 0x01) {
    throw new NotImplemented(
      "SERVICE switch held: jp 0x4000 at ROM 0x0077 -- out-of-policy input, " +
        "no diagnostic ROM exists on this romset",
    );
  }

  // 3. Blit the sprite shadow buffer to sprite RAM. The blit reads the setup-block
  //    pointer out of the register pair, so aim it there first.
  regs.hl = DMA_SETUP_BLOCK;
  blitSpritesViaDma(m);

  // 4. Read + debounce the controls only while a credited game is in play; attract
  //    (ATTRACT != 0) leaves the input latch alone.
  if (mem.read8(ATTRACT) === 0) {
    readControls(m);
  }

  // 5. Frame counter, RNG, schedulers, game-state dispatch, and the restore epilogue.
  //    That epilogue unwinds the 12-byte register-save frame the hardware prologue
  //    pushed, plus the return address. The register save is not modelled here (those
  //    registers are dead), so RESERVE the frame — advance the stack pointer by 12,
  //    exactly where the six pushes would leave it — and the epilogue's arithmetic and
  //    its final return land where they would have. The reserved bytes are never read
  //    as live data.
  regs.sp = (regs.sp - 12) & 0xffff;
  perFrame(m);
}
