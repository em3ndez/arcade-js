// SPDX-License-Identifier: GPL-3.0-only

/**
 * spinToSelfHalt -- a self-jump halt trap: it hangs the processor forever. Writes nothing; only reached
 * from a self-test error arm (service switch held), so it never runs in a normal boot. Clock-free, the
 * halt is a bare endless loop -- the same idiom the boot's own error paths use. [code]
 */
export function spinToSelfHalt(m) {
  for (;;) { /* halt: the machine hangs here until it is power-cycled */ }
}
