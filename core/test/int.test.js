// SPDX-License-Identifier: GPL-3.0-only
/**
 * Gate for the fixed-width integer helpers (core/int.js). Proves u8/u16 truncate the
 * way the memory layer's write8/write16 do (so a local wrapped with u8 matches a value
 * that went through a byte store), and — the point of preferring them over `% 256` —
 * that they wrap negatives correctly.
 *
 * Run: node --test core/test/int.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";

import { u8, u16 } from "../int.js";

test("u8 truncates to 8 bits, wrapping over- and under-flow", () => {
  assert.equal(u8(0), 0);
  assert.equal(u8(255), 255);
  assert.equal(u8(256), 0);
  assert.equal(u8(257), 1);
  assert.equal(u8(300), 44);
  assert.equal(u8(-1), 255, "the whole reason to prefer u8 over % 256: -1 -> 255");
  assert.equal(u8(-256), 0);
});

test("u16 truncates to 16 bits, wrapping over- and under-flow", () => {
  assert.equal(u16(0), 0);
  assert.equal(u16(0xffff), 0xffff);
  assert.equal(u16(0x10000), 0);
  assert.equal(u16(0x12345), 0x2345);
  assert.equal(u16(-1), 0xffff);
});

test("u8/u16 match a value round-tripped through the memory layer's width", () => {
  // The property the idiomatic layer relies on: u8(x) equals what write8/read8 would
  // leave, and u16(x) equals write16/read16. Modelled with a one-byte / two-byte array.
  const byte = new Uint8Array(1);
  const word = new Uint8Array(2);
  for (const x of [-1, 0, 1, 200, 255, 256, 511, 65535, 65536, -256]) {
    byte[0] = x;
    assert.equal(u8(x), byte[0], `u8(${x}) must match a byte store`);
    word[0] = x & 0xff;
    word[1] = (x >> 8) & 0xff;
    assert.equal(u16(x), word[0] | (word[1] << 8), `u16(${x}) must match a little-endian word store`);
  }
});

test("% 256 is the trap u8 avoids: they differ on negatives", () => {
  assert.notEqual(-1 % 256, u8(-1), "-1 % 256 is -1, u8(-1) is 255 — the reason % 256 is banned");
});
