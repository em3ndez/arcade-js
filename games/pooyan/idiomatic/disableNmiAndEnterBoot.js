// SPDX-License-Identifier: GPL-3.0-only
import { runSelfTestAndInitMachineState } from "./runSelfTestAndInitMachineState.js";
import { NMI_ENABLE_LATCH } from "./names.js";
/**
 * disableNmiAndEnterBoot — the power-on reset vector. Disables the vblank NMI latch, then hands control to the
 * boot entry, which runs the self-test and lays down the full initial machine state. The NMI-disable
 * is transient: the boot re-enables the latch before it finishes, so it leaves no lasting trace in
 * the final state.
 *
 * LIVE-OUT: none — control passes through the boot into the main-loop generator, and no register
 * survives as a consumed value.
 */

export function disableNmiAndEnterBoot(m) {
  m.mem8[NMI_ENABLE_LATCH] = 0; // hold the vblank NMI off while the boot runs
  return runSelfTestAndInitMachineState(m); // hand off to the boot entry
}
