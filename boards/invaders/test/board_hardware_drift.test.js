// SPDX-License-Identifier: GPL-3.0-only
/**
 * hardware.json drift test — the board's tool-facing hardware declaration (boards/invaders/hardware.json,
 * read by the shared Python tools via --hardware) must not drift from the code the JS engine runs
 * (boards/invaders/memory.js + io.js + video.js). Runbook §1: hardware.json is the single source of truth
 * for the tools; if it and the code disagree, one of them is wrong. This asserts they agree on every value
 * BOTH declare (screen size, the state-dump layout, the write surface) and pins hardware.json's driver
 * identity + clock numbers to the mw8080bw.cpp driver. No ROM needed, so it runs on a fresh clone.
 * All grounding is midw8080/mw8080bw.cpp + mw8080bw.h (the MAME driver), not the JS itself.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { RAM_BASE, RAM_SIZE, ROM_END, STATE_DUMP_SIZE, VIDEO_SIZE, AddressSpace } from "../memory.js";
import { SCREEN_W, SCREEN_H, BYTES_PER_ROW } from "../video.js";

const hw = JSON.parse(readFileSync(new URL("../hardware.json", import.meta.url), "utf8"));

test("hardware.json screen size matches video.js SCREEN_W/SCREEN_H (256x224 pre-rotation)", () => {
  assert.equal(hw.screen.width, SCREEN_W, "screen.width == video.js SCREEN_W");
  assert.equal(hw.screen.height, SCREEN_H, "screen.height == video.js SCREEN_H");
  // Framebuffer geometry (mw8080bw_v.cpp screen_update_invaders: offs=(y<<5)|(x>>3), y up to VBSTART 0xe0):
  // 32 bytes/row * 8 = 256 wide; VIDEO RAM 0x2400-0x3fff = 7168 bytes = 224 rows.
  assert.equal(SCREEN_W, BYTES_PER_ROW * 8, "width = 32 bytes/row * 8");
  assert.equal(SCREEN_H, VIDEO_SIZE / BYTES_PER_ROW, "height = 7168-byte fb / 32 bytes/row");
  assert.equal(VIDEO_SIZE, 7168, "video framebuffer is 224*32 bytes");
  // Mutation: this is the PRE-rotation frame. ROT270 (mw8080bw.cpp:3305 GAMEL invaders) is display-only,
  // so width must be 256, NOT the post-rotation 224.
  assert.equal(hw.screen.width, 256, "width is pre-rotation 256, not ROT270 224");
});

test("hardware.json state-dump region matches memory.js (RAM_BASE / RAM_SIZE / STATE_DUMP_SIZE)", () => {
  // MAME main_map: map(0x0000,0x1fff).rom(); map(0x2000,0x3fff).mirror(0x4000).ram().share("main_ram").
  assert.equal(ROM_END, 0x1fff, "ROM ends at 0x1fff");
  assert.equal(RAM_BASE, ROM_END + 1, "RAM begins where ROM ends (0x2000)");
  assert.equal(RAM_BASE, 8192, "RAM_BASE 0x2000");
  assert.equal(RAM_SIZE, 8192, "main_ram 0x2000-0x3fff = 8192 bytes");

  assert.equal(hw.stateDumpSize, STATE_DUMP_SIZE, "stateDumpSize == memory.js STATE_DUMP_SIZE");
  assert.equal(Array.isArray(hw.stateRegions) && hw.stateRegions.length, 1, "one state region (main_ram)");
  const r = hw.stateRegions[0];
  assert.equal(r.name, "main_ram", "region name matches MAME .share(\"main_ram\")");
  assert.equal(r.base, RAM_BASE, "region.base == RAM_BASE");
  assert.equal(r.size, RAM_SIZE, "region.size == RAM_SIZE");
  assert.equal(hw.stateRegions.reduce((s, x) => s + x.size, 0), hw.stateDumpSize, "regions sum == stateDumpSize");
  // Mutation: the dump is the WHOLE 8KB main_ram (work RAM + framebuffer), not just the 7168-byte framebuffer.
  assert.equal(hw.stateDumpSize, 8192, "state dump is 8192, not the 7168-byte framebuffer alone");
});

test("hardware.json driver + cpu match the mw8080bw.cpp invaders machine", () => {
  // GAMEL(1978, invaders, ...) driver short name; I8080(config, m_maincpu, ...) is the CPU.
  assert.equal(hw.driver, "invaders", "driver short name is 'invaders'");
  assert.equal(hw.cpu, "8080", "CPU is the Intel 8080");
  // Mutation: MAME instantiates I8080, not the 8085 superset nor a Z80 (the Konami boards' CPU).
  assert.notEqual(hw.cpu, "8085", "not 8085");
  assert.notEqual(hw.cpu, "z80", "not z80");
});

test("hardware.json has no memory-mapped write surface, matching memory.js isHardwareWrite", () => {
  // main_map is rom+ram only; every device (shift reg, sound, watchdog) is on the 8080 IN/OUT port space
  // (io_map), not the memory bus — so there are no hardware writeRanges and no memory address is a hw write.
  assert.deepEqual(hw.writeRanges, [], "writeRanges empty (devices are on the port bus)");
  for (const addr of [0x2000, 0x2400, 0x3fff, 0x6000, 0xa180]) {
    assert.equal(AddressSpace.isHardwareWrite(addr), false, `no memory-mapped hw write at 0x${addr.toString(16)}`);
  }
});

test("hardware.json clock/frame numbers match the mw8080bw.h driver formulas", () => {
  // mw8080bw.h: MASTER 19968000; CPU_CLOCK=MASTER/10; PIXEL_CLOCK=MASTER/4; HTOTAL 0x140=320; VTOTAL 0x106=262.
  const MASTER = 19968000;
  assert.equal(hw.cpuHz, MASTER / 10, "cpuHz = MASTER/10 = 1996800");
  // cyclesPerFrame = CPU_CLOCK / 60HZ = HTOTAL*VTOTAL*4/10, exactly 33536.
  assert.equal(hw.cyclesPerFrame, (320 * 262 * 4) / 10, "cyclesPerFrame = HTOTAL*VTOTAL*4/10 = 33536");
  const refresh = (MASTER / 4) / 320 / 262; // MW8080BW_60HZ
  assert.ok(Math.abs(hw.refreshHz - refresh) < 1e-4, `refreshHz ~= ${refresh}`);
  // Mutation: MW8080BW_60HZ is 59.54..., deliberately NOT exactly 60.
  assert.ok(hw.refreshHz > 59.5 && hw.refreshHz < 60, "refresh is 59.54Hz, not exactly 60");
});
