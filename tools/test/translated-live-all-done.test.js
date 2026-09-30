// SPDX-License-Identifier: GPL-3.0-only
//
// STANDING GATE -- runbook §5 done criterion (a) for every DONE game: the live idiomatic game executes ZERO
// translated routines. For each game with a committed games/<g>/DONE.md, tools/translated_live_probe.mjs
// runs the shipped engine twice -- over the game's coin/start/play tape (its in-play witness must show play
// reached, so a zero is not a zero-over-attract) and over attract alone (boot + the demo cycle, no input) --
// and any translated routine executed, in either run, fails the game -- as does any real (uninstrumented)
// games/*/translated/ module the live run loads through a linked path, any translated/ module resolved after
// frame 0 (a deferred import), and any async resource (timer, promise, Worker, ...) the run creates -- the
// shipped engine runs a session synchronously, so the live game has none.
//
// KNOWN_FAILING is shrink-only: a DONE game that runs translated code goes there WITH a pointer to the
// dated correction in its DONE.md, and its test then asserts it still fails -- so the day it runs clean the
// test goes red until the entry is removed. An entry that is not a DONE game is also red.
//
// The runs are child processes (the probe is synchronous and CPU-bound), several at once. A game whose ROM
// images are absent skips (README's promise to a stranger's clone), it does not pass.

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { availableParallelism, tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { REPO, DONE_GAMES, TAPES, PLAY_WITNESS } from "../translated_live_probe.mjs";

// game -> where its DONE.md records the correction (e.g. "games/x/DONE.md, correction 2026-10-01").
const KNOWN_FAILING = new Map([]);

// Engine frames per run (60/s). Each covers boot + attract + play: every tape's play starts by f480 and
// every DONE game's in-play witness reads true from f71..f464 over 3600; attract runs twice as long to
// cycle the demo. Measured cost (M-series, one process each): ~1-2 s per run, tempest ~4 s tape / ~8 s attract.
const TAPE_FRAMES = 3600;
const ATTRACT_FRAMES = 7200;
const PARALLEL = Math.max(2, Math.min(8, Math.floor(availableParallelism() / 2)));

const PROBE = join(REPO, "tools", "translated_live_probe.mjs");

async function romAbsent(game) {
  const manifest = (await import(pathToFileURL(join(REPO, "games", game, "manifest.js")).href)).default;
  const missing = Object.keys(manifest.rom.images).filter((n) => !existsSync(join(REPO, "games", game, "rom", `${n}.bin`)));
  return missing.length ? `${game} ROM absent (BYO): ${missing.join(", ")}` : null;
}

// A bounded pool of probe child processes; each job resolves to the probe's JSON result (or throws).
const queue = [];
let running = 0;
function pump() {
  while (running < PARALLEL && queue.length) {
    const job = queue.shift();
    running++;
    job().finally(() => { running--; pump(); });
  }
}
function runProbe(game, attract) {
  return new Promise((resolve, reject) => {
    queue.push(() => new Promise((done) => {
      const dir = mkdtempSync(join(tmpdir(), `tlp-all-${game}-`));
      const out = join(dir, "r.json");
      const frames = attract ? ATTRACT_FRAMES : TAPE_FRAMES;
      const args = [PROBE, "--game", game, "--frames", String(frames), "--top", "40", "--json", out];
      if (attract) args.push("--attract");
      const t0 = Date.now();
      const child = spawn(process.execPath, args, { cwd: REPO, stdio: ["ignore", "pipe", "pipe"] });
      let text = "";
      child.stdout.on("data", (d) => { text += d; });
      child.stderr.on("data", (d) => { text += d; });
      child.on("close", (code, signal) => {
        try {
          if (!existsSync(out)) throw new Error(`probe ${game}${attract ? " --attract" : ""} wrote no result (exit ${code ?? signal}):\n${text}`);
          const [res] = JSON.parse(readFileSync(out, "utf8"));
          resolve({ ...res, ms: Date.now() - t0, text });
        } catch (e) {
          reject(e);
        } finally {
          rmSync(dir, { recursive: true, force: true });
          done();
        }
      });
    }));
    pump();
  });
}

// Translated routines counted in the copy, plus real (uninstrumented) translated modules the live game
// loaded through a link -- their execution cannot be counted, so loading one is itself a failure.
const executed = (res) => [
  ...res.summary.routines.map((r) => `${r.name} x${r.count} [f${r.firstFrame}..f${r.lastFrame}]` +
    (r.entries[0] ? ` via ${r.entries[0].path}` : "")),
  ...res.summary.uncounted.map((u) => `UNCOUNTED module ${u.file} loaded by ${u.importer}`),
  ...res.summary.late.map((u) => `LATE (deferred) resolution of ${u.file} by ${u.importer} during the live run`),
  ...res.summary.deferred.map((d) => `DEFERRED: ${d}`),
];

nodeTest("KNOWN_FAILING names only DONE games", () => {
  for (const g of KNOWN_FAILING.keys()) assert.ok(DONE_GAMES.includes(g), `KNOWN_FAILING ${g} has no games/${g}/DONE.md -- remove it`);
});

nodeTest("every DONE game has a probe tape and an in-play witness", () => {
  assert.ok(DONE_GAMES.length > 0, "no games/*/DONE.md found");
  for (const g of DONE_GAMES) {
    assert.equal(typeof TAPES[g], "function", `${g} is DONE but tools/translated_live_probe.mjs TAPES has no entry for it`);
    assert.ok(PLAY_WITNESS[g], `${g} is DONE but tools/translated_live_probe.mjs PLAY_WITNESS has no entry for it`);
  }
});

// Start every runnable game's two probes now, so the pool runs them while the tests below await in order.
const pending = new Map();
const skipReason = new Map();
for (const g of DONE_GAMES) {
  const why = await romAbsent(g);
  if (why) { skipReason.set(g, why); continue; }
  if (typeof TAPES[g] !== "function") continue; // reported by the test above
  const tape = runProbe(g, false);
  const attract = runProbe(g, true);
  tape.catch(() => {}); attract.catch(() => {}); // awaited below; don't let an early reject go unhandled
  pending.set(g, { tape, attract });
}

for (const g of DONE_GAMES) {
  const skip = skipReason.get(g);
  nodeTest(`${g}: the live idiomatic game executes no translated routine (tape + attract)`, skip ? { skip } : {}, async (t) => {
    const p = pending.get(g);
    assert.ok(p, `${g}: not run (no probe tape)`);
    const [tape, attract] = await Promise.all([p.tape, p.attract]);
    for (const r of [tape, attract]) {
      assert.equal(r.stopError, null, `${g}: the live run stopped with an error: ${r.stopError}`);
      assert.equal(r.stop, "reached maxFrames", `${g}: the live run stopped early: ${r.stop}`);
      assert.ok(r.instrumented > 0, `${g}: no translated routine instrumented`);
    }
    assert.equal(tape.frames, TAPE_FRAMES);
    assert.equal(attract.frames, ATTRACT_FRAMES);
    assert.ok(tape.play.frames > 0, `${g}: the tape never reached play (witness ${tape.play.cell}) -- a zero here would cover attract only`);
    // The witness can also read true in the attract DEMO (pooyan's MAIN_GAME_STATE==3 does), so play must be
    // reached EARLIER under the tape than attract alone ever reaches it -- the coin/start took effect.
    assert.ok(attract.play.first < 0 || tape.play.first < attract.play.first,
      `${g}: tape first in play f${tape.play.first} is not before attract's f${attract.play.first} -- the witness ` +
      `${tape.play.cell} does not prove the tape reached play`);
    t.diagnostic(`${g}: tape ${tape.frames}f (in play ${tape.play.frames}f from f${tape.play.first}, ${tape.play.cell}) ${tape.ms}ms; ` +
      `attract ${attract.frames}f (witness true ${attract.play.frames}f from f${attract.play.first}) ${attract.ms}ms; ` +
      `instrumented ${tape.instrumented}`);
    const ran = [...executed(tape).map((s) => `tape: ${s}`), ...executed(attract).map((s) => `attract: ${s}`)];
    if (KNOWN_FAILING.has(g)) {
      assert.ok(ran.length > 0, `${g} now executes no translated routine -- remove it from KNOWN_FAILING ` +
        `(and close the correction at ${KNOWN_FAILING.get(g)})`);
      t.diagnostic(`${g}: KNOWN_FAILING (${KNOWN_FAILING.get(g)}), still runs ${ran.length} translated routine run(s)`);
      return;
    }
    assert.deepEqual(ran, [], `${g} is DONE but its live game executed translated code:\n  ${ran.join("\n  ")}`);
  });
}
