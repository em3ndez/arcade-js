// SPDX-License-Identifier: GPL-3.0-only
/**
 * Memory-equivalence gate for loc_3d8a (ROM 0x3d8a, The Pit) — the fixed 9-cell
 * vertical-strip painter at column 6, row 12: stage the cell, copy nine ROM glyphs down
 * the video column (still-oracle helper 0x3dea), then tail into the colour-column filler.
 *
 * loc_3d8a is a CALLER with three real internal calls plus a tail jump. The idiomatic
 * rewrite reaches the SAME callees — the decompiled rowColToTileOffset (0x3dae),
 * deriveTileWriteCursors (0x3dc9) and fillColourColumn (0x3e01) are called directly, and
 * the one not-yet-decompiled helper (0x3dea) stays a registry hand-off. So both sides run
 * identical callee behaviour; the only thing that can differ is the routine's own stores
 * and its stack discipline.
 *
 * THE CONTRACT is memory-equivalence, and it is proven on the FULL contract — RAM + exit
 * pc + exit stack pointer — with ONE principled exclusion:
 *
 *   The oracle models each internal call by pushing a literal return address the callee's
 *   ret then pops. Those pushes are balanced (the callees are leaves), so all but the last
 *   overwrite the same word two bytes below the entry stack pointer, and that word survives
 *   as DEAD scratch: it sits below the EXIT stack pointer and is never read back. The
 *   idiomatic model reaches the same callees without that push, so it leaves the pre-entry
 *   value there instead. That two-byte return-address slot is the ONLY divergence, and it
 *   is excluded — every other byte, plus the exit pc and stack pointer, matches exactly.
 *   (The single oracle-callee ret at 0x3dea consumes the caller's return address just as
 *   the oracle's tail jump does, which is why pc and SP land identical without any stack
 *   modelling in the idiomatic routine.)
 *
 * EQUAL is proven on the routine's one real attract dispatch (it runs once during screen
 * setup) AND on crafted entries that scribble the tile-scratch bytes and the target video/
 * colour columns first, proving the strip is repainted cleanly regardless of prior state.
 * The teeth twins (wrong fill colour, wrong cell count, a corrupted painted cell) are
 * caught in the compared painted / scratch region.
 *
 * Run: node --test games/thepit/idiomatic/test/equivalence-3d8a.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_3d8a as oracle } from "../../translated/loc_3d8a.js";
import { loc_3d8a as idiomatic } from "../loc_3d8a.js";
import { rowColToTileOffset } from "../rowColToTileOffset.js";
import { deriveTileWriteCursors } from "../deriveTileWriteCursors.js";
import { fillColourColumn } from "../fillColourColumn.js";
import { TILE_COL, TILE_ROW } from "../ram.js";
import { makeMachineFactory } from "../../machine.js";
import { unitEquivalence } from "../../../../core/equivalence.js";

const ROM_PATH = new URL("../../rom/maincpu.bin", import.meta.url);
const ROM_PRESENT = existsSync(ROM_PATH);
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(ROM_PATH)) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) =>
      nodeTest(name, { skip: "skipped: ROM not present at games/thepit/rom/maincpu.bin" }, fn);

const TARGET = 0x3d8a;
const FILL_COLOUR = 0x8057; // the strip's flat colour byte
const CELL_COUNT = 0x8055; // cells per strip
const OFFSET = 0x805a; // tilemap offset the address helpers compute
const COL_CURSOR = 0x805e; // colour-RAM write cursor
const VID_CURSOR = 0x8060; // video-RAM write cursor
const VIDEO_TOP = 0x9186; // top painted video cell (offset 32*12 + 6 = 390, video base 0x9000)
const COLOUR_TOP = 0x8986; // top painted colour cell (same offset, colour base 0x8800)
const COLUMN_STRIDE = 32; // one screen row down the 32-cell-wide map
const hx = (v) => "0x" + (v & 0xffff).toString(16);

// The Pit's routine registry is async, so build the factory once and reuse it.
const makeMachine = ROM_PRESENT ? await makeMachineFactory(ROM) : null;

// -- capture / contract helpers ----------------------------------------------

/** Clone the machine at up to K real 0x3d8a dispatches, then let attract proceed. */
function captureDispatches(K, maxFrames) {
  const caps = [];
  const snapshot = new Map([[TARGET, (mm) => {
    if (caps.length < K) caps.push(mm.clone());
    return oracle(mm);
  }]]);
  makeMachine(snapshot).runFrames(maxFrames);
  return caps;
}

/**
 * The two-byte return-address slot the oracle's balanced internal calls leave in dead
 * stack scratch, just below the entry stack pointer. The idiomatic model reaches the same
 * callees without that push, so this word is the one expected divergence; it is below the
 * exit stack pointer and never read back, so it is excluded from the compare.
 */
function deadStackAddrs(entry) {
  const sp = entry.regs.sp;
  return new Set([(sp - 2) & 0xffff, (sp - 1) & 0xffff]);
}

/** First differing RAM byte outside the dead stack slot, or null. */
function firstRamDiffExStack(a, b, dead) {
  const da = a.dumpState();
  const db = b.dumpState();
  const n = Math.min(da.length, db.length);
  for (let i = 0; i < n; i++) {
    if (da[i] === db[i]) continue;
    const addr = a.stateOffsetToAddr(i);
    if (dead.has(addr)) continue;
    return { addr, a: da[i], b: db[i] };
  }
  return null;
}

/**
 * Run the oracle and a candidate on two independent clones of one entry and diff the full
 * memory-equivalence contract: RAM (minus the dead return-address slot) + exit pc + exit
 * stack pointer. Returns a list of human-readable divergences (empty when equivalent).
 */
function contractDiffs(entry, fn) {
  const dead = deadStackAddrs(entry);
  const o = entry.clone();
  oracle(o);
  const c = entry.clone();
  fn(c);

  const diffs = [];
  const ram = firstRamDiffExStack(o, c, dead);
  if (ram) diffs.push(`RAM@${hx(ram.addr)} oracle=${ram.a} cand=${ram.b}`);
  if (o.pc !== c.pc) diffs.push(`pc oracle=${hx(o.pc)} cand=${hx(c.pc)}`);
  if (o.regs.sp !== c.regs.sp) diffs.push(`SP oracle=${hx(o.regs.sp)} cand=${hx(c.regs.sp)}`);
  return { diffs, ram };
}

// -- 0. IDENTITY --------------------------------------------------------------

test("IDENTITY: the unit gate runs on The Pit and reports EQUAL when both arms are the oracle", () => {
  const res = unitEquivalence(makeMachine, TARGET, oracle, oracle);
  assert.equal(
    res.equal,
    true,
    `gate reported a diff for identical arms: ram=${JSON.stringify(res.ram)} regs=${JSON.stringify(res.regs)}`,
  );
  console.log("  IDENTITY: captured 0x3d8a, cloned, ran oracle vs oracle -> EQUAL");
});

// -- 1. EQUAL: the real attract dispatch, full contract -----------------------

test("EQUAL (real dispatch): idiomatic == oracle on the captured 0x3d8a entry", () => {
  const caps = captureDispatches(4, 240);
  assert.ok(caps.length >= 1, "expected the real 0x3d8a dispatch during screen setup");
  for (const cap of caps) {
    const { diffs } = contractDiffs(cap, idiomatic);
    assert.equal(diffs.length, 0, diffs.join("; "));
  }
  const s = caps[0];
  console.log(
    `  EQUAL/real: ${caps.length} captured dispatch(es) identical over RAM(−dead stack)+pc+SP ` +
      `(entry SP=${hx(s.regs.sp)}, col=${s.mem.read8(TILE_COL)} row=${s.mem.read8(TILE_ROW)})`,
  );
});

// -- 2. EQUAL: crafted entries with scribbled prior state ---------------------

test("EQUAL (crafted): idiomatic == oracle after scribbling the scratch + target columns", () => {
  const seed = captureDispatches(1, 240)[0];
  assert.ok(seed, "need a real capture to craft from");

  // Scribble every tile-scratch byte the routine restages, and the nine video + colour
  // cells it repaints, so an entry that leaves any of them stale would diverge.
  const scratch = [CELL_COUNT, 0x8056, FILL_COLOUR, TILE_COL, TILE_ROW, OFFSET, OFFSET + 1, COL_CURSOR, COL_CURSOR + 1, VID_CURSOR, VID_CURSOR + 1];
  const patterns = [0x00, 0xa5, 0x5a, 0xff];
  let checked = 0;
  for (const p of patterns) {
    const entry = seed.clone();
    for (const a of scratch) entry.mem.write8(a, p);
    for (let i = 0; i < 9; i++) {
      entry.mem.write8((VIDEO_TOP + i * COLUMN_STRIDE) & 0xffff, p ^ 0x3c);
      entry.mem.write8((COLOUR_TOP + i * COLUMN_STRIDE) & 0xffff, p ^ 0x3c);
    }
    const { diffs } = contractDiffs(entry, idiomatic);
    assert.equal(diffs.length, 0, `scribble pattern ${hx(p)}: ${diffs.join("; ")}`);
    checked++;
  }
  console.log(`  EQUAL/crafted: ${checked} scribbled entries repaint identically to the oracle`);
});

// -- 3. TEETH -----------------------------------------------------------------

/** Broken twin: wrong fill colour (7 instead of 6). */
function twinWrongColour(m) {
  const { mem } = m;
  mem.write8(TILE_COL, 6);
  mem.write8(TILE_ROW, 12);
  rowColToTileOffset(m);
  deriveTileWriteCursors(m);
  mem.write8(FILL_COLOUR, 7); // BUG: strip should be colour 6
  mem.write8(CELL_COUNT, 9);
  m.regs.ix = 0x49a5;
  m.call(0x3dea);
  return fillColourColumn(m);
}

/** Broken twin: paints one cell short (count 8 instead of 9). */
function twinShort(m) {
  const { mem } = m;
  mem.write8(TILE_COL, 6);
  mem.write8(TILE_ROW, 12);
  rowColToTileOffset(m);
  deriveTileWriteCursors(m);
  mem.write8(FILL_COLOUR, 6);
  mem.write8(CELL_COUNT, 8); // BUG: the strip is nine cells tall, not eight
  m.regs.ix = 0x49a5;
  m.call(0x3dea);
  return fillColourColumn(m);
}

/** Broken twin: the correct routine, then one corrupted painted video cell. */
function twinCorruptCell(m) {
  const r = idiomatic(m);
  m.mem.write8(VIDEO_TOP, m.mem.read8(VIDEO_TOP) ^ 0xff); // BUG: corrupts a painted glyph
  return r;
}

test("TEETH: a wrong fill colour is CAUGHT", () => {
  const seed = captureDispatches(1, 240)[0];
  const { ram, diffs } = contractDiffs(seed, twinWrongColour);
  assert.notEqual(ram, null, "the gate FAILED to catch a wrong fill colour — it is worthless");
  assert.equal(ram.addr, FILL_COLOUR, `teeth caught ${hx(ram.addr)} (expected the fill colour ${hx(FILL_COLOUR)})`);
  console.log(`  TEETH: wrong colour caught (${diffs[0]})`);
});

test("TEETH: a one-cell-short paint is CAUGHT", () => {
  const seed = captureDispatches(1, 240)[0];
  const { ram, diffs } = contractDiffs(seed, twinShort);
  assert.notEqual(ram, null, "the gate FAILED to catch a short paint — it is worthless");
  console.log(`  TEETH: short paint caught (${diffs[0]})`);
});

test("TEETH: a corrupted painted cell is CAUGHT in the video column", () => {
  const seed = captureDispatches(1, 240)[0];
  const { ram, diffs } = contractDiffs(seed, twinCorruptCell);
  assert.notEqual(ram, null, "the gate FAILED to catch a corrupted painted cell — it is worthless");
  assert.equal(ram.addr, VIDEO_TOP, `teeth caught ${hx(ram.addr)} (expected the painted video cell ${hx(VIDEO_TOP)})`);
  console.log(`  TEETH: corrupted painted cell caught (${diffs[0]})`);
});
