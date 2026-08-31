// SPDX-License-Identifier: GPL-3.0-only
import { runSelfTestAndInitMachineState } from "./runSelfTestAndInitMachineState.js";
import { NMI_ENABLE_LATCH } from "./names.js";
/**
 * disableNmiAndEnterBoot — the Z80 power-on reset vector.
 *
 * WHAT IT IS: the very first code the CPU runs. After a power-on or reset the Z80 begins fetching
 * instructions from address 0x0000, so this routine is the machine's cold-start entry point. It
 * does exactly two things: silence the per-frame vblank interrupt, then jump into the boot routine
 * that builds the entire initial machine state.
 *
 * ROLE IN THE MACHINE: the vblank NMI is the machine's per-frame heartbeat — once armed, the video
 * hardware raises it at every vertical blank and it drives all per-frame work (input sampling,
 * coin service, state dispatch, rendering). At the instant of power-on none of the game's work RAM
 * has been initialized, so letting that interrupt fire would run the service routine against
 * garbage. This routine holds the interrupt off across the whole boot window, then defers to the
 * boot entry (runSelfTestAndInitMachineState), which self-tests the ROM, lays down the initial
 * state, and only then re-arms the interrupt so the heartbeat can begin.
 *
 * ROM ADDRESS: 0x0000 (the Z80 reset vector).
 * Grounding: [seen].
 *
 * The NMI-disable here is transient: the boot re-arms the NMI-enable latch before it finishes, so
 * this write leaves no lasting trace in the final machine state — its only job is to keep the
 * interrupt quiet until the machine state exists.
 *
 * LIVE-OUT: none — control flows through the boot and on into the main loop, and no register
 * survives as a value the machine later consumes.
 */

export function disableNmiAndEnterBoot(m) {
  // Silence the vblank NMI before any state exists. 0xa180 (NMI_ENABLE_LATCH) is bit 0 of the
  // LS259 control latch: the write is address-encoded, so the address itself carries the bit index
  // (addr & 7 == 0 selects bit 0) and only the low bit of the data (0 here) is stored — clearing
  // the vblank-interrupt-enable line. With that line low, the video hardware's vertical-blank pulse
  // cannot vector the CPU into the per-frame service routine, which is essential this early because
  // work RAM is still uninitialized. The boot routine writes 1 back into this same latch bit once
  // the initial machine state has been built, arming the heartbeat.
  m.mem8[NMI_ENABLE_LATCH] = 0;
  // Hand control to the boot entry at ROM 0x0092. runSelfTestAndInitMachineState checksums the
  // eight program-ROM banks, zeroes work RAM, empties the display- and sound-command rings, floods
  // the colour map, decodes the two DIP-switch banks into their config cells, re-arms the vblank
  // NMI, seeds the default high-score table, and finally enters the main loop — from which it never
  // returns. This transfer is therefore terminal: the reset vector's whole remaining job is simply
  // to reach the boot code.
  return runSelfTestAndInitMachineState(m);
}
