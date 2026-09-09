// SPDX-License-Identifier: GPL-3.0-only

/**
 * returnNoop -- do nothing and return.
 *
 * ROLE: a second shared no-op landing (a sibling of returnImmediately). In the ROM a group of code paths
 * that reach a "nothing to do here" conclusion all branch to one RTS byte rather than each ending in their
 * own; the decompiler keeps that shared target as a named routine so those call sites converge on a single
 * empty body instead of many. It differs from returnImmediately only in which set of exits fold onto it —
 * behaviourally the two are identical (both simply return).
 *
 * ROM/HARDWARE: no memory access, no hardware access. It is a control-flow convenience, not a computation.
 *
 * GROUNDING: [code] (behaviour-derived; there is no state change to confirm against MAME).
 * LIVE-OUT: none — state on exit equals state on entry.
 */
export function returnNoop() {}
