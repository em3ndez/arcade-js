// SPDX-License-Identifier: GPL-3.0-only
/**
 * core/entropy-pin.js tests — the TEST-ONLY RNG seam (see docs/idiomatic-generation.md (Entropy pinning)).
 *
 * No ROM, no MAME: a minimal fake `mem` seam exercises the two behaviours the pin promises —
 * dropped writes to the seed (so it stays at its boot value) and redirected reads of the spin
 * counter (so it reads the pinned seed) — plus passthrough for everything else, and the spec
 * string the MAME side consumes.  Run: node --test
 */

import test from "node:test";
import assert from "node:assert/strict";
import { installEntropyPin, entropyPinRomSpec } from "../entropy-pin.js";

function fakeMachine() {
  const ram = new Uint8Array(0x10000);
  return {
    ram,
    mem: { read8: (a) => ram[a], write8: (a, v) => { ram[a] = v & 0xff; } },
  };
}

const DK_CFG = {
  seedBytes: [0x6018],
  redirectReads: [{ from: 0x6019, to: 0x6018 }],
  romPatches: [
    { at: 0x0063, from: 0x18, to: 0x00 },
    { at: 0x0064, from: 0x60, to: 0x00 },
    { at: 0x03f4, from: 0x19, to: 0x18 },
    { at: 0x2c3d, from: 0x19, to: 0x18 },
    { at: 0x34cd, from: 0x19, to: 0x18 },
  ],
};

test("seed writes are dropped — the byte stays at its boot value", () => {
  const m = fakeMachine();
  installEntropyPin(m, DK_CFG);
  m.mem.write8(0x6018, 0x55);
  assert.equal(m.mem.read8(0x6018), 0, "0x6018 must stay 0 despite the write");
  assert.equal(m.ram[0x6018], 0, "the underlying byte is never written");
});

test("spin-counter reads are redirected to the pinned seed", () => {
  const m = fakeMachine();
  installEntropyPin(m, DK_CFG);
  m.ram[0x6019] = 0x77; // whatever the (unpinned) counter happens to hold
  assert.equal(m.mem.read8(0x6019), 0, "0x6019 reads must return the pinned seed (0)");
  // and it tracks the seed's live value, not a hardcoded 0:
  m.ram[0x6018] = 0x2a; // (a raw poke; the pin only drops writes via write8)
  assert.equal(m.mem.read8(0x6019), 0x2a, "0x6019 read follows 0x6018");
});

test("every other address passes through unchanged", () => {
  const m = fakeMachine();
  installEntropyPin(m, DK_CFG);
  m.mem.write8(0x6200, 0x42);
  assert.equal(m.mem.read8(0x6200), 0x42);
  m.mem.write8(0x601a, 0x99); // the synced twin is untouched by the pin
  assert.equal(m.mem.read8(0x601a), 0x99);
});

test("no config, or an empty one, is a no-op", () => {
  for (const cfg of [undefined, null, {}, { seedBytes: [], redirectReads: [] }]) {
    const m = fakeMachine();
    const read = m.mem.read8, write = m.mem.write8;
    installEntropyPin(m, cfg);
    assert.equal(m.mem.read8, read, "read8 seam left untouched");
    assert.equal(m.mem.write8, write, "write8 seam left untouched");
  }
});

test("entropyPinRomSpec renders the MAME patch string", () => {
  assert.equal(
    entropyPinRomSpec(DK_CFG),
    "0063:00,0064:00,03f4:18,2c3d:18,34cd:18",
  );
  assert.equal(entropyPinRomSpec(undefined), "");
  assert.equal(entropyPinRomSpec({}), "");
});
