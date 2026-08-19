// SPDX-License-Identifier: GPL-3.0-only
// Skeleton smoke test: the machine constructs from the ROM and BOOTS to an unimplemented-routine
// gap (not a crash, not a silent run-off). With an empty translated layer the first m.call throws
// NotImplemented, which runFrames absorbs into stoppedBy -- that is the worklist seed, not an error.
// As routines land the gap moves deeper; this test only asserts the boot reaches SOME gap cleanly.

import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { Machine } from "../machine.js";
import { NotImplemented } from "../../../boards/pooyan/io.js";

const ROM_URL = new URL("../rom/maincpu.bin", import.meta.url);
const ROM_PRESENT = existsSync(ROM_URL);
const t = ROM_PRESENT ? test : (name) => test(name, { skip: "ROM not built — run `make -C games/pooyan rom`" }, () => {});

t("pooyan boots to an unimplemented-routine gap (not a crash)", () => {
  const rom = new Uint8Array(readFileSync(ROM_URL));
  const m = new Machine(rom, {});
  const frames = m.runFrames(3);

  assert.ok(frames.length >= 1, "power-on state[0] was not captured");
  assert.ok(
    m.stoppedBy instanceof NotImplemented,
    `boot should stop on a NotImplemented gap, got ${m.stoppedBy}`,
  );
  assert.match(m.stoppedBy.message, /no routine registered at 0x[0-9a-f]{4}/);
});
