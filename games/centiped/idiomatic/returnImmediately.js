// SPDX-License-Identifier: GPL-3.0-only

/**
 * returnImmediately -- a shared no-op return; does nothing observable.
 *
 * ROLE: in the original ROM this is a bare RTS byte that several "there is nothing to do on this path"
 * exits jump to instead of each carrying their own RTS. Folding those exits onto one shared return byte
 * is a common 6502 space-saving trick, and the decompiler preserves it as a single named routine so the
 * many call sites can all point at one target rather than duplicating an empty body.
 *
 * ROM/HARDWARE: touches no memory and no hardware — it exists purely as a control-flow landing pad.
 *
 * GROUNDING: [code] (behaviour-derived; nothing to observe in MAME because it produces no effect).
 * LIVE-OUT: none. The machine state is exactly what it was on entry.
 */
export function returnImmediately(_m) {
  // Intentionally empty: the routine's only job is to return. In the guest that RTS is supplied by the
  // dispatch seam (the port's call/return plumbing), so the JS body itself does nothing and holds no code.
}
