// SPDX-License-Identifier: GPL-3.0-only
/**
 * Fixed-width integer truncation helpers for the idiomatic layer.
 *
 * JavaScript has no 8- or 16-bit integer type, so a value that lived in a Z80 8-bit
 * register (or a 16-bit register pair) and is used AS that width — compared, indexed,
 * or otherwise observed — has to be truncated explicitly. u8/u16 name that intent
 * ("this is a byte / a word") where a bare `& 0xff` reads as an opaque bit op.
 *
 * Only needed for a value kept in a LOCAL and then observed at its width. A value
 * written to memory needs no wrap — mem8[]/write8 already truncate on store, so a mask
 * right before a store is dead. And `% 256` is NOT a correct 8-bit wrap (`-1 % 256` is
 * -1 in JavaScript, whereas `u8(-1)` is 255), which is why these mask instead.
 */
export const u8 = (x) => x & 0xff;
export const u16 = (x) => x & 0xffff;
