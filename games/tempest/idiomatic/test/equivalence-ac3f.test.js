// SPDX-License-Identifier: GPL-3.0-only
// Memory-equivalence for loc_ac3f (ROM 0xac3f-0xad21) -- a CALLER that dissolves three m.calls into direct
// idiomatic calls: loc_ca62 (conditional block-clear), loc_ddfb (arm the merge with mask 4), and the
// fall-through loc_ad22 (walk the request word). It bubble-sorts each channel's record rows counting passes,
// records per-channel pass counts, nudges a running total, and derives a packed request byte. Effect is
// memory only, so each side runs on a clone and the contract is RAM (dumpState, minus STACK_SCRATCH).
// Run: node --test games/tempest/idiomatic/test/equivalence-ac3f.test.js

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_ac3f as oracle } from "../../translated/loc_ac3f.js";
import { loc_ac3f } from "../loc_ac3f.js";
import { loc_ca62 } from "../loc_ca62.js";
import { loc_ddfb } from "../loc_ddfb.js";
import { loc_ad22 } from "../loc_ad22.js";
import { Machine } from "../../machine.js";
import { u8, u16 } from "../../../../core/int.js";
import { firstStateDiff } from "../../../../core/equivalence.js";
import {
  STACK_SCRATCH, loc_5, loc_9, loc_29, loc_2a, loc_2b, loc_2c, loc_2d, loc_2e, loc_36, loc_3d, loc_3e,
  loc_40, loc_41, loc_42, loc_51e, loc_51f, loc_520, loc_600, loc_601, loc_603, loc_605, loc_61e, loc_61f, loc_620,
} from "../names.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const OPTS = { vectorrom: opt("vectorrom.bin"), avgprom: opt("avgprom.bin") };
function opt(name) {
  const u = new URL(name, ROM_DIR);
  return existsSync(u) ? new Uint8Array(readFileSync(u)) : undefined;
}
const test = ROM_PRESENT ? nodeTest : (name, fn) => nodeTest(name, { skip: "ROM not built" }, fn);

const TARGET = 0xac3f;
const inDeadStack = (a) => a != null && a >= STACK_SCRATCH.lo && a < STACK_SCRATCH.hi;
const ramDiff = (ma, mb) =>
  firstStateDiff(ma.dumpState(), mb.dumpState(), (off) => ma.stateOffsetToAddr(off), inDeadStack);

function captureDispatches(K, maxFrames) {
  const caps = [];
  const snap = new Map([[TARGET, (mm) => { if (caps.length < K) caps.push(mm.clone()); return oracle(mm); }]]);
  try { new Machine(ROM, { overrides: snap, ...OPTS }).runFrames(maxFrames); } catch { /* keep caps before boot-gap throw */ }
  return caps;
}
const CAPS = ROM_PRESENT ? captureDispatches(16, 4000) : [];

test("CAPTURE: real 0xac3f dispatches -- loc_ac3f == oracle in RAM (-stack)", () => {
  for (const cap of CAPS) {
    const o = cap.clone(), c = cap.clone();
    oracle(o); loc_ac3f(c);
    assert.equal(ramDiff(o, c), null);
  }
  console.log(`  CAPTURE: ${CAPS.length} dispatch(es) checked`);
});

// Fill the sort's working RAM window deterministically, then seat the control + key cells.
function fillWindow(m) {
  let s = 0x12345 >>> 0;
  for (let a = 0x0500; a <= 0x07ff; a++) {
    s = (Math.imul(s, 1103515245) + 12345) >>> 0;
    m.mem.write8(a, (s >>> 16) & 0xff);
  }
  // Key triple cells (indexed by channel) live outside the window -- seat them explicitly.
  m.mem.write8(loc_40, 0x40); m.mem.write8(loc_41, 0x60); m.mem.write8(loc_42, 0x80);
  m.mem.write8(0x0043, 0x30); m.mem.write8(0x0044, 0x50); m.mem.write8(0x0045, 0x70);
  m.mem.write8(loc_3e, 0x01); // nonzero -> channel starts at 3, two channels processed
  m.mem.write8(loc_3d, 0x45); // request-byte flag (bit6 set -> carry-in is live)
}

test("CRAFTED (no ca62): full bubble sort + request derivation match the oracle in RAM", () => {
  const o = new Machine(ROM, OPTS); fillWindow(o); o.mem.write8(loc_5, 0xff); o.mem.write8(loc_9, 0x00);
  const c = new Machine(ROM, OPTS); fillWindow(c); c.mem.write8(loc_5, 0xff); c.mem.write8(loc_9, 0x00);
  oracle(o); loc_ac3f(c);
  assert.equal(ramDiff(o, c), null, "RAM equal after ac3f (no ca62 path)");
  assert.equal(c.mem.read8(loc_5) & 0x40, 0x00, "$05 bit6 cleared");
});

test("CRAFTED (ca62 path): the conditional block-clear fires and still matches the oracle", () => {
  const o = new Machine(ROM, OPTS); fillWindow(o); o.mem.write8(loc_5, 0xff); o.mem.write8(loc_9, 0x40);
  const c = new Machine(ROM, OPTS); fillWindow(c); c.mem.write8(loc_5, 0xff); c.mem.write8(loc_9, 0x40);
  oracle(o); loc_ac3f(c);
  assert.equal(ramDiff(o, c), null, "RAM equal after ac3f (ca62 path)");
});

// Step the row cursor down by two (or three when still high).
function advanceCursor(y) {
  if (y >= 0x55) y = u8(y - 1);
  y = u8(y - 1);
  y = u8(y - 1);
  return y;
}

test("TEETH: a faithful twin that drops the request byte's ADC carry-in diverges from the oracle", () => {
  const o = new Machine(ROM, OPTS); fillWindow(o); o.mem.write8(loc_5, 0xff); o.mem.write8(loc_9, 0x00);
  const c = new Machine(ROM, OPTS); fillWindow(c); c.mem.write8(loc_5, 0xff); c.mem.write8(loc_9, 0x00);
  oracle(o);
  // Byte-for-byte loc_ac3f, with exactly one omission: the (flag>>6)&1 carry-in on the request byte.
  const broken = (m) => {
    const { mem8 } = m;
    mem8[loc_5] = mem8[loc_5] & 0xbf;
    if ((mem8[loc_9] & 0x43) === 0x40) loc_ca62(m);
    loc_ddfb(m);
    mem8[loc_601] = 0x00;
    let channel = mem8[loc_3e] === 0 ? 0 : 3;
    while (true) {
      mem8[loc_2c] = mem8[u8(loc_42 + channel)];
      mem8[loc_2d] = mem8[u8(loc_41 + channel)];
      mem8[loc_2e] = mem8[u8(loc_40 + channel)];
      mem8[loc_36] = channel & 0x01;
      mem8[loc_2b] = 0x00; mem8[loc_2a] = 0x1a; mem8[loc_29] = 0x1a; mem8[loc_605] = 0x00;
      let y = 0xfd;
      while (true) {
        let ordered;
        const hi = mem8[u16(loc_620 + y)];
        if (hi !== mem8[loc_2c]) ordered = hi >= mem8[loc_2c];
        else {
          const mid = mem8[u16(loc_61f + y)];
          if (mid !== mem8[loc_2d]) ordered = mid >= mem8[loc_2d];
          else if (y < 0x52) ordered = true;
          else ordered = mem8[u16(loc_61e + y)] >= mem8[loc_2e];
        }
        if (!ordered) {
          while (true) {
            if (y >= 0xe8) {
              let t = mem8[u16(loc_51e + y)];
              mem8[u16(loc_51e + y)] = mem8[loc_29]; mem8[loc_29] = t;
              t = mem8[u16(loc_51f + y)];
              mem8[u16(loc_51f + y)] = mem8[loc_2a]; mem8[loc_2a] = t;
              t = mem8[u16(loc_520 + y)];
              mem8[u16(loc_520 + y)] = mem8[loc_2b]; mem8[loc_2b] = t;
            }
            let t = mem8[u16(loc_61f + y)];
            mem8[u16(loc_61f + y)] = mem8[loc_2d]; mem8[loc_2d] = t;
            t = mem8[u16(loc_620 + y)];
            mem8[u16(loc_620 + y)] = mem8[loc_2c]; mem8[loc_2c] = t;
            if (y >= 0x52) {
              t = mem8[u16(loc_61e + y)];
              mem8[u16(loc_61e + y)] = mem8[loc_2e]; mem8[loc_2e] = t;
            }
            y = advanceCursor(y);
            if (y === 0) break;
          }
          y = 0x02;
        }
        mem8[loc_605] = u8(mem8[loc_605] + 1);
        y = advanceCursor(y);
        if (y === 0) break;
      }
      channel = mem8[loc_36];
      mem8[u16(loc_600 + channel)] = mem8[loc_605];
      channel = u8(channel - 1);
      if ((channel & 0x80) !== 0) break;
    }
    const total = mem8[loc_601];
    if (total >= mem8[loc_600] && total < 0x63) mem8[loc_601] = u8(mem8[loc_601] + 1);
    const flag = mem8[loc_3d];
    let request = (((flag ^ 0x01) << 2) & 0xff) | flag;
    request = u8(request + 0x05); // BUG: dropped + ((flag >> 6) & 0x01)
    mem8[loc_603] = request;
    return loc_ad22(m);
  };
  broken(c);
  assert.notEqual(ramDiff(o, c), null, "the RAM diff FAILED to catch the dropped carry-in");
});
