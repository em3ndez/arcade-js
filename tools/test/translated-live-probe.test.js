// SPDX-License-Identifier: GPL-3.0-only
//
// translated_live_probe -- can it fail? Controls on galaxian (fast, and its vblank handler + sound tick
// are direct-import idiomatic, so every entry path can be forced in a temp tree):
//   NEGATIVE  the translated twin of a routine the live game runs as JS every frame (loc_1898,
//             driveSoundLfoLevel) counts 0, and the instrument is transparent (end state == uninstrumented);
//   POSITIVE  that same twin, forced to run translated three ways, is counted every frame and attributed
//             to the path that entered it:
//               m.call dispatch   -- the handler calls m.call(0x1898) with the 0x1898 override removed;
//               direct import     -- the handler imports loc_1898 from ../translated/ in place of the JS;
//               machine.js        -- fireNmi calls translated loc_0066 in place of the JS handler.
// A probe that wraps only the routine map passes the first and fails the other two.

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import {
  REPO, probeGame, instrumentSource, assertOnlyExportFunctions, assertRegistryTableOnly, buildProbeTree,
} from "../translated_live_probe.mjs";

const HAVE_ROM = ["maincpu", "gfx1", "proms"].every((n) => existsSync(join(REPO, "games", "galaxian", "rom", `${n}.bin`)));
const test = HAVE_ROM ? nodeTest : (name, fn) => nodeTest(name, { skip: "galaxian ROM absent (BYO)" }, fn);

const FRAMES = 400;
const TWIN = "loc_1898"; // translated twin of idiomatic driveSoundLfoLevel, called once per vblank
// The handler runs once per vblank after boot (boot holds the first ~100 engine frames), so a forced twin
// counts ~300 of 400; the floor is loose on purpose -- it separates "every frame" from "0".
const EVERY_FRAME = 250;
const HANDLER = "idiomatic/enterVblankService.js";

const count = (res, name) => res.summary.routines.find((r) => r.name === name)?.count ?? 0;
const paths = (res, name) => res.summary.routines.find((r) => r.name === name)?.entries.map((e) => e.path) ?? [];

nodeTest("instrumentSource opens every exported function body, skipping nested parens in parameters", () => {
  const { src, names } = instrumentSource(
    "export function a(m, x = f(1)) {\n  return x;\n}\nfunction inner() {}\nexport function* b(m) { yield 1; }\n",
    (n) => `H(${JSON.stringify(n)});`,
  );
  assert.deepEqual(names, ["a", "b"]);
  assert.match(src, /export function a\(m, x = f\(1\)\) \{ H\("a"\);/);
  assert.match(src, /export function\* b\(m\) \{ H\("b"\);/);
  assert.match(src, /function inner\(\) \{\}/); // non-exported helpers untouched
});

test("negative: the live twin of a JS-run routine counts 0, and the probe is transparent", async () => {
  const probed = await probeGame("galaxian", { frames: FRAMES });
  const plain = await probeGame("galaxian", { frames: FRAMES, instrument: false });
  assert.equal(probed.stopError, null, probed.stop);
  assert.equal(probed.frames, FRAMES);
  assert.ok(probed.instrumented > 100, `only ${probed.instrumented} translated functions instrumented`);
  assert.equal(count(probed, TWIN), 0, `${TWIN} ran translated in the unmodified live game`);
  assert.equal(probed.digest, plain.digest, "the instrumented run's end state differs from the uninstrumented run");
  assert.equal(plain.summary.routinesExecuted, 0, "instrument:false must count nothing");
});

test("positive: an m.call dispatch into translated code is counted", async () => {
  const res = await probeGame("galaxian", {
    frames: FRAMES,
    edits: { [HANDLER]: (s) => s.replace(/^  driveSoundLfoLevel\(m\);$/m, "  m.call(0x1898);") },
    editOverrides: (o) => { assert.ok(o.delete(0x1898), "0x1898 override missing"); },
  });
  assert.ok(count(res, TWIN) >= EVERY_FRAME, `${TWIN} counted ${count(res, TWIN)} over ${FRAMES} frames`);
  assert.ok(paths(res, TWIN).some((p) => p.startsWith(`${TWIN} <- machine.js:Machine.call <- ${HANDLER}:enterVblankService`)),
    `entry path not attributed to the m.call from the handler: ${paths(res, TWIN)}`);
});

test("positive: a direct ES import of translated code from idiomatic/ is counted", async () => {
  const res = await probeGame("galaxian", {
    frames: FRAMES,
    edits: {
      [HANDLER]: (s) => s.replace('import { driveSoundLfoLevel } from "./driveSoundLfoLevel.js";',
        `import { ${TWIN} as driveSoundLfoLevel } from "../translated/${TWIN}.js";`),
    },
  });
  assert.ok(count(res, TWIN) >= EVERY_FRAME, `${TWIN} counted ${count(res, TWIN)} over ${FRAMES} frames`);
  assert.ok(paths(res, TWIN).some((p) => p.startsWith(`${TWIN} <- ${HANDLER}:enterVblankService`)),
    `entry path not attributed to the importing handler: ${paths(res, TWIN)}`);
});

test("positive: translated code called directly from machine.js (fireNmi) is counted", async () => {
  const res = await probeGame("galaxian", {
    frames: 60,
    edits: {
      "machine.js": (s) => s
        .replace("return enterVblankService(this);", "return loc_0066(this);")
        .replace('import { enterVblankService } from "./idiomatic/enterVblankService.js";',
          'import { enterVblankService } from "./idiomatic/enterVblankService.js";\nimport { loc_0066 } from "./translated/loc_0066.js";'),
    },
  });
  // The translated handler may derail the idiomatic foreground; the count, not a clean run, is the point.
  assert.ok(count(res, "loc_0066") >= 1, `loc_0066 counted ${count(res, "loc_0066")}`);
  assert.ok(paths(res, "loc_0066").some((p) => p.startsWith("loc_0066 <- machine.js:Machine.fireNmi")),
    `entry path not attributed to machine.js fireNmi: ${paths(res, "loc_0066")}`);
});

nodeTest("fail closed: any translated export form but a line-leading `export function` throws", () => {
  const check = (src) => assertOnlyExportFunctions(src, "t.js", instrumentSource(src, () => "").names);
  // counted: plain and generator functions; `export` in comments, strings and member names is not code
  check("// comment ends with a period.\nexport function f(m) { return \"export const x\"; }\n");
  check("/* export default 1 */\nexport function* g(m) { m.export(1); }\n");
  for (const bad of [
    "export function f(m) {}\nexport const g = (m) => 1;\n",
    "export async function g(m) {}\n",
    "function g(m) {}\nexport { g };\n",
    "export default function (m) {}\n",
    "export let g = function (m) {};\n",
    "export * from \"./x.js\";\n",
    "  export function g(m) {}\n", // indented: instrumentSource's line-anchored match would miss it
    "x(); export function g(m) {}\n", // mid-line: likewise
    "export function f(m) {}\nfunction h(m) {}\nglobalThis.h = h;\n", // a non-export handed out globally
    "export function f(m) {}\nfunction h(m) {}\nwindow[\"h\"] = h;\n",
    "export function f(m) { return eval(\"m\"); }\n",
  ]) {
    assert.throws(() => check(bad), /cannot instrument|instrumented|global-object/, `accepted: ${JSON.stringify(bad)}`);
  }
});

nodeTest("fail closed: an edit whose real path leaves the temp tree is refused, and the repo file is untouched", () => {
  const target = join(REPO, "tools", "translated_live_probe.mjs");
  const before = readFileSync(target, "utf8");
  // games/<g>/../../tools is the tree's link to the REAL tools/ -- inside the tree by name, outside by realpath
  assert.throws(() => buildProbeTree("galaxian", {
    instrument: false,
    edits: { "../../tools/translated_live_probe.mjs": (s) => `${s}// mutant\n` },
  }), /outside the temp tree/);
  assert.equal(readFileSync(target, "utf8"), before);
});

nodeTest("temp trees are removed when the process is killed by SIGTERM or SIGINT", async () => {
  for (const sig of ["SIGTERM", "SIGINT"]) {
    const code = `import { buildProbeTree } from ${JSON.stringify(join(REPO, "tools", "translated_live_probe.mjs"))};
      console.log(buildProbeTree("galaxian", { instrument: false }).root); setInterval(() => {}, 1000);`;
    const child = spawn(process.execPath, ["--input-type=module", "-e", code], { stdio: ["ignore", "pipe", "inherit"] });
    const root = await new Promise((resolve) => child.stdout.once("data", (d) => resolve(String(d).trim())));
    assert.ok(existsSync(join(root, "games", "galaxian", "translated")), `${sig}: no tree at ${root}`);
    const exited = new Promise((resolve) => child.once("exit", (c, s) => resolve(s)));
    child.kill(sig);
    assert.equal(await exited, sig, `${sig}: the child did not die by the signal`);
    assert.equal(existsSync(root), false, `${sig}: ${root} survived the signal`);
  }
});

test("positive: a REAL (uninstrumented) translated module loaded past the copy is reported, with its importer", async () => {
  // Stands in for any module reached through a link (games/<g>/audio/, core/, boards/, web/, another game):
  // Node resolves it to its real path, so its ../translated/ import bypasses the instrumented copy.
  const real = join(REPO, "games", "galaxian", "translated", `${TWIN}.js`);
  const res = await probeGame("galaxian", {
    frames: 60,
    edits: {
      "machine.js": (s) => `import { ${TWIN} as __real } from ${JSON.stringify(real)};\nglobalThis.__tlpReal = __real;\n${s}`,
    },
  });
  assert.deepEqual(res.summary.uncounted.map((u) => u.file), [`games/galaxian/translated/${TWIN}.js`]);
  assert.equal(res.summary.uncounted[0].importer, "games/galaxian/machine.js");
  const clean = await probeGame("galaxian", { frames: 60 });
  assert.deepEqual(clean.summary.uncounted, [], "the unmodified game loads an uninstrumented translated module");
});

nodeTest("fail closed: the name-skipped registry must be a table -- any code line throws", () => {
  const table = '// gen\nimport { loc_0001, loc_0002 } from "./loc_0001.js";\n\nexport const ROUTINE_ENTRIES = [\n' +
    "  [0x0001, loc_0001],\n];\nexport const ORACLE_ROUTINES = new Map([\n  [0x0002, loc_0002],\n]);\n";
  assertRegistryTableOnly(table);
  for (const bad of ["function f(m) { m.call(1); }\n", "  [0x0003, (m) => loc_0001(m)],\n", "loc_0001(globalThis.m);\n",
    "export function loc_0009(m) {}\n"]) {
    assert.throws(() => assertRegistryTableOnly(table + bad), /not a table line/, `accepted: ${JSON.stringify(bad)}`);
  }
});

// Deferred execution: the live run is synchronous, so code it QUEUES runs only after it returns. Each plant
// runs the game's own (in-tree, instrumented) translated loc_0000 exactly once, from renderFrame, deferred.
const RENDER = "  renderFrame() {";
const plant = (head, body) => ({
  "machine.js": (s) => {
    assert.ok(s.includes(RENDER), "galaxian machine.js renderFrame() not found");
    return head + s.replace(RENDER, `${RENDER}\n    if (!this.__tlpPlant) { this.__tlpPlant = 1; ${body} }`);
  },
});
const STATIC = 'import { loc_0000 as __q } from "./translated/loc_0000.js";\n';

test("positive: a deferred dynamic import().then of translated code is counted and reported late", async () => {
  const res = await probeGame("galaxian", {
    frames: 120,
    edits: plant("", 'import("./translated/loc_0000.js").then((mm) => { try { mm.loc_0000({}); } catch {} });'),
  });
  assert.equal(count(res, "loc_0000"), 1, "the .then's translated call was not counted");
  assert.deepEqual(res.summary.late.map((u) => u.file), ["games/galaxian/translated/loc_0000.js"]);
});

test("positive: translated code run from setTimeout(0) / queueMicrotask after the run is counted", async () => {
  for (const q of ["setTimeout(() => { try { __q({}); } catch {} });", "queueMicrotask(() => { try { __q({}); } catch {} });"]) {
    const res = await probeGame("galaxian", { frames: 120, edits: plant(STATIC, q) });
    assert.equal(count(res, "loc_0000"), 1, `${q}: not counted`);
  }
});

// The engine runs a session synchronously (web/worker.js: while-loop + Atomics.wait), so the live game creates
// no async resource; the probe fails any it does ON CREATION -- including ones created during the drain by
// the run's own lineage -- whether or not translated code ran in it or was seen.
const types = (res) => Object.fromEntries(res.summary.deferred.map((d) => { const [n, t] = d.split(" "); return [t, Number(n)]; }));
const ASYNC_PLANTS = {
  "a long unref'd timer": [STATIC, "setTimeout(() => { try { __q({}); } catch {} }, 60000).unref();", (t) => t.Timeout === 1],
  "a timer created then cleared": [STATIC, "clearTimeout(setTimeout(() => { try { __q({}); } catch {} }, 0));", (t) => t.Timeout === 1],
  // hop 1 is created in the live run, the rest by the drain turning -- each tainted through its trigger
  "a 20-hop setTimeout chain": [STATIC, "const hop = (n) => { if (n) setTimeout(() => hop(n - 1)); }; hop(20);", (t) => t.Timeout >= 2],
  "a bare promise": ["", "Promise.resolve(1);", (t) => t.PROMISE >= 1],
  "a Worker running translated code off-thread (error swallowed)": [
    'import { Worker as __W } from "node:worker_threads";\n',
    "const u = new URL(\"./translated/loc_0000.js\", import.meta.url).href; " +
      "const w = new __W(`import(${JSON.stringify(u)}).then((mm) => { try { mm.loc_0000({}); } catch {} })`, { eval: true }); " +
      "w.on(\"error\", () => {}); w.unref();",
    (t) => t.WORKER >= 1,
  ],
};
for (const [name, [head, body, ok]] of Object.entries(ASYNC_PLANTS)) {
  test(`positive: ${name} in the live run is reported`, async () => {
    const res = await probeGame("galaxian", { frames: 120, edits: plant(head, body) });
    assert.ok(ok(types(res)), `${name}: deferred ${JSON.stringify(res.summary.deferred)}`);
  });
}

test("negative: the unmodified game creates no async resource and resolves nothing late", async () => {
  const clean = await probeGame("galaxian", { frames: 120 });
  assert.deepEqual([clean.summary.late, clean.summary.deferred], [[], []]);
});
