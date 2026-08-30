// SPDX-License-Identifier: GPL-3.0-only
/**
 * hardware.json drift test — the board's tool-facing hardware declaration (boards/pooyan/hardware.json,
 * read by the shared Python tools via --hardware) must not drift from the code the JS engine actually runs
 * (boards/pooyan/memory.js + io.js). Runbook §1: hardware.json is the single source of truth for the tools;
 * if it and the code disagree, one of them is wrong. This asserts the two agree on every value BOTH declare
 * (the memory map / state-dump layout, the LS259 latch width, the DSW idle) — no ROM needed, so it runs on a
 * fresh clone. It also pins the MEASURED idle IN/DSW bytes (runbook §2: the board unit tests assert them).
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  STATE_DUMP_SIZE,
  COLOR_RAM_BASE, COLOR_RAM_SIZE, VIDEO_RAM_BASE, VIDEO_RAM_SIZE,
  WORK_RAM_BASE, WORK_RAM_SIZE, SPRITE0_BASE, SPRITE1_BASE, SPRITE_SIZE,
} from "../memory.js";
import {
  LATCH_NMI_ENABLE, LATCH_AUDIO_IRQ, LATCH_AUDIO_MUTE,
  LATCH_COIN_COUNTER_0, LATCH_COIN_COUNTER_1, LATCH_PAYOUT, LATCH_FLIPSCREEN,
  IDLE_IN0, IDLE_IN1, IDLE_IN2, IDLE_DSW0, IDLE_DSW1,
} from "../io.js";

const hw = JSON.parse(readFileSync(new URL("../hardware.json", import.meta.url), "utf8"));
const region = (name) => hw.stateRegions.find((r) => r.name === name);

test("hardware.json state-dump layout matches memory.js (base + size, every region)", () => {
  assert.equal(hw.stateDumpSize, STATE_DUMP_SIZE, "stateDumpSize");
  const want = {
    color:   [COLOR_RAM_BASE, COLOR_RAM_SIZE],
    video:   [VIDEO_RAM_BASE, VIDEO_RAM_SIZE],
    work:    [WORK_RAM_BASE, WORK_RAM_SIZE],
    sprite0: [SPRITE0_BASE, SPRITE_SIZE],
    sprite1: [SPRITE1_BASE, SPRITE_SIZE],
  };
  for (const [name, [base, size]] of Object.entries(want)) {
    const r = region(name);
    assert.ok(r, `hardware.json is missing stateRegion '${name}'`);
    assert.equal(r.base, base, `${name}.base`);
    assert.equal(r.size, size, `${name}.size`);
  }
  // internal consistency: the declared regions must sum to the declared dump size.
  assert.equal(hw.stateRegions.reduce((s, r) => s + r.size, 0), hw.stateDumpSize, "regions sum == stateDumpSize");
});

test("hardware.json LS259 mainlatch width matches io.js LATCH_* bit space", () => {
  const ml = hw.writeRanges.find((w) => w.name === "mainlatch");
  assert.ok(ml, "hardware.json is missing the mainlatch writeRange");
  // ONE address per bit (bit = (addr - start) & 7), so the range must be exactly as wide as the bit space.
  const bits = [LATCH_NMI_ENABLE, LATCH_AUDIO_IRQ, LATCH_AUDIO_MUTE,
    LATCH_COIN_COUNTER_0, LATCH_COIN_COUNTER_1, LATCH_PAYOUT, LATCH_FLIPSCREEN];
  assert.equal(ml.end - ml.start + 1, Math.max(...bits) + 1, "mainlatch address span == max LATCH bit + 1");
  assert.equal(ml.start, 0xa180, "mainlatch base 0xA180");
  // the documented bit assignment (b0=NMI, b1=audio irq, b2=mute, b3/b4=coin, b5=payout, b7=flipscreen).
  assert.deepEqual(bits, [0, 1, 2, 3, 4, 5, 7], "LATCH_* bit positions");
});

test("hardware.json DSW0 config-probe matches io.js idle, and measured idle bytes are pinned", () => {
  assert.equal(hw.dsw0.addr, 0xa0e0, "dsw0.addr 0xA0E0");
  assert.equal(hw.dsw0.expected, IDLE_DSW0, "dsw0.expected == io.js IDLE_DSW0");
  // Measured idle values (runbook §2: the board tests assert the IN/DSW idles, not just port routing).
  assert.equal(IDLE_IN0, 0xff, "IN0 idle (active-low, all-high)");
  assert.equal(IDLE_IN1, 0xff, "IN1 idle");
  assert.equal(IDLE_IN2, 0xff, "IN2 idle");
  assert.equal(IDLE_DSW0, 0xff, "DSW0 idle (KONAMI_COINAGE default)");
  assert.equal(IDLE_DSW1, 0x7b, "DSW1 idle (3 lives / 50K bonus / easy / demo-on)");
});
