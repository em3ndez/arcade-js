// SPDX-License-Identifier: GPL-3.0-only
// Fixed-width integer helpers for the idiomatic layer: a value kept in a LOCAL and observed at a Z80
// register width must be truncated explicitly (`& 0xff` reads as an opaque bit op; a mask right before
// a store is dead — mem8[]/write8 truncate already). `% 256` is NOT a correct wrap (`-1 % 256` is -1,
// `u8(-1)` is 255), so these mask.
export const u8 = (x) => x & 0xff;
export const u16 = (x) => x & 0xffff;

// The page-aligned base of a 16-bit address (high byte kept, low cleared) — the `page(base) | offset`
// in-page-addressing idiom where a strided access advances only the low byte.
export const page = (x) => x & 0xff00;
