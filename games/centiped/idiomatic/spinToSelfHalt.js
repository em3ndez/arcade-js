// SPDX-License-Identifier: GPL-3.0-only

/**
 * spinToSelfHalt -- a self-jump halt trap: it hangs the processor forever, writing nothing.
 *
 * ROLE: this is the dedicated terminal stop for a diagnostic failure. In the ROM it is a one-instruction
 * "JMP to itself" — the program counter lands on the jump and re-executes it endlessly, so the CPU makes
 * no further progress. It is reached ONLY from a self-test error arm (the operator holds the service switch
 * and a memory march fails), which is why it never executes during a normal power-on boot. The boot's own
 * beep-and-halt reporter ends the same way (see coldBootReset's selfTestBeepAndHalt), so this is that same
 * "stop the board and wait for a human" idiom, factored out as a shared target.
 *
 * ROM/HARDWARE: it touches no memory and no I/O. Crucially it does NOT kick the watchdog — but the machine
 * is already committed to a hard stop here, so a watchdog reset (or a power cycle) is exactly the intended
 * escape: the fault is meant to be sticky until a technician intervenes.
 *
 * GROUNDING: [code] (behaviour-derived; it produces no observable state change to confirm against MAME).
 * LIVE-OUT: none — control never leaves this routine.
 */
export function spinToSelfHalt(m) {
  // The endless loop is the halt itself: the guest's self-jump becomes a JS infinite for(;;). Nothing in
  // the body ever changes, so the only way out is the machine being reset or power-cycled externally.
  for (;;) { /* halt: the machine hangs here until it is power-cycled */ }
}
