// SPDX-License-Identifier: GPL-3.0-only
/**
 * scoreFrogRowProgress — memory-equivalent to the frozen oracle at ROM 0x1FD6.
 * GATE: crafted-entry. From a captured post-boot state the frog row and the progress high-water mark are
 * poked to drive every branch: below the band, above the band, a new record (award, with PLAY_FLAG set),
 * not a record, the same row, the mid row (updates the mark but awards nothing), and the 0xd0 edge with a
 * zero mark (seeded above the band, then scores) and a nonzero mark (no record). Live-out memory-only; RAM
 * compared, stack masked. Teeth: no-op and a perturbed high-water mark; positive control the mark advances.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { romsPresent, craft, ramDiff, FROG_Y, PLAY_FLAG, FURTHEST } from "./_frogHop.js";
import { scoreFrogRowProgress as cand } from "../scoreFrogRowProgress.js";
import { loc_1fd6 as oracle } from "../../translated/loc_1fd6.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

const newRecord = () => craft((mem) => { mem[FROG_Y] = 0x40; mem[FURTHEST] = 0x80; mem[PLAY_FLAG] = 1; });
const noRecord = () => craft((mem) => { mem[FROG_Y] = 0x60; mem[FURTHEST] = 0x40; });
const sameRow = () => craft((mem) => { mem[FROG_Y] = 0x50; mem[FURTHEST] = 0x50; });
const midRow = () => craft((mem) => { mem[FROG_Y] = 0x80; mem[FURTHEST] = 0xa0; });
const belowBand = () => craft((mem) => { mem[FROG_Y] = 0x20; mem[FURTHEST] = 0x90; });
const aboveBand = () => craft((mem) => { mem[FROG_Y] = 0xe0; mem[FURTHEST] = 0x90; });
const edgeSeed = () => craft((mem) => { mem[FROG_Y] = 0xd0; mem[FURTHEST] = 0x00; mem[PLAY_FLAG] = 1; });
const edgeNonzero = () => craft((mem) => { mem[FROG_Y] = 0xd0; mem[FURTHEST] = 0x90; });

test("EQUAL (crafted): scoreFrogRowProgress == oracle across the band/record/edge branches", { skip }, () => {
  for (const [name, mk] of [["new-record", newRecord], ["no-record", noRecord], ["same-row", sameRow], ["mid-row", midRow], ["below-band", belowBand], ["above-band", aboveBand], ["edge-seed", edgeSeed], ["edge-nonzero", edgeNonzero]]) {
    assert.equal(ramDiff(oracle, cand, mk()), null, `the ${name} path diverged`);
  }
  const e = newRecord(); const before = e.mem8[FURTHEST]; const a = e.clone(); oracle(a);
  assert.notEqual(a.mem8[FURTHEST], before, "record path not exercised: high-water mark never moved");
  console.log(`  EQUAL: 8 branches; new record moved the high-water mark ${before}->${a.mem8[FURTHEST]}`);
});

test("TEETH: broken twins are caught", { skip }, () => {
  const noOp = () => {};
  const wrongMark = (m) => { cand(m); m.mem8[FURTHEST] = (m.mem8[FURTHEST] + 1) & 0xff; };
  assert.ok(ramDiff(oracle, noOp, newRecord()), "no-op twin escaped on a new record");
  assert.ok(ramDiff(oracle, wrongMark, newRecord()), "wrong-mark twin escaped");
  console.log("  TEETH: no-op, wrong-mark caught");
});
