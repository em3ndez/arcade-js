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
import { existsSync } from "node:fs";
import { join } from "node:path";

import { REPO, probeGame, instrumentSource } from "../translated_live_probe.mjs";

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
