// SPDX-License-Identifier: GPL-3.0-only
// Skeleton smoke test: the machine constructs from the ROM and BOOTS without a fault -- it either
// runs clean or stops on a NotImplemented gap (the next routine to translate), never a crash or a
// silent run-off. `new Machine(rom, {})` treats {} as opts and builds the CURRENT registry, so as
// translation batches land the boot runs deeper; this asserts only clean-run-or-gap, not a fixed depth.

import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { Machine } from "../machine.js";
import { NotImplemented } from "../../../boards/pooyan/io.js";

const ROM_URL = new URL("../rom/maincpu.bin", import.meta.url);
const ROM_PRESENT = existsSync(ROM_URL);
const t = ROM_PRESENT ? test : (name) => test(name, { skip: "ROM not built — run `make -C games/pooyan rom`" }, () => {});

t("pooyan boots without a fault (clean run or a translation gap)", () => {
  const rom = new Uint8Array(readFileSync(ROM_URL));
  const m = new Machine(rom, {});
  const frames = m.runFrames(60);

  assert.ok(frames.length >= 2, "boot did not cross into frame 1 (only state[0] captured)");
  // null == booted clean this far; NotImplemented == more to translate. Anything else is a real fault.
  assert.ok(
    m.stoppedBy == null || m.stoppedBy instanceof NotImplemented,
    `boot should be a clean run or a NotImplemented gap, got ${m.stoppedBy}`,
  );
  if (m.stoppedBy) {
    assert.match(m.stoppedBy.message, /no routine registered at 0x[0-9a-f]{4}/);
  }
});
