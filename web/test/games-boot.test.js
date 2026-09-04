// SPDX-License-Identifier: GPL-3.0-only
//
// games-boot — the WEB-INTEGRATION smoke gate. Every node gate and the §5 done-audit exercise the
// idiomatic layer DIRECTLY; NONE construct the board `Inputs` the shared web player passes, or boot the
// worker's run loop. So a game can pass every gate + a two-auditor §5 done-audit and still be UNPLAYABLE
// in the browser: invaders shipped DONE while `boards/invaders/io.js` had no `Inputs` export, so the
// worker's `new Inputs()` threw at construction. This gate replays web/worker.js's per-game boot in node —
// import the board `Inputs` + the game `Machine`, load the bring-your-own ROM, resolve the idiomatic
// overrides, `new Machine(maincpu, {inputs: new Inputs(), ...gfx, overrides})` (the EXACT worker form), and
// drive runIdiomaticGame — asserting no throw and that frames advance. ROM-guarded per game (skips a game
// whose ROM the developer hasn't built). "Passes the gates" must mean "runs in the browser".
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { runIdiomaticGame } from "../../core/frame-stepped.js";
import { GAMES } from "../../games/registry.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..");
const FRAMES = 400; // boot through attract into the main loop -- catches boot + early-run throws

for (const gameId of GAMES) {
  const manifest = (await import(`../../games/${gameId}/manifest.js`)).default;
  const names = Object.keys(manifest.rom.images);
  const romPath = (n) => join(ROOT, "games", gameId, "rom", `${n}.bin`);
  const haveRom = names.every((n) => existsSync(romPath(n)));

  test(`${gameId}: boots the way the web worker constructs it`, { skip: !haveRom }, async () => {
    // The worker only runs runtime "idiomatic" games this way; all registered games are idiomatic.
    assert.equal(manifest.runtime, "idiomatic", `${gameId} runtime must be idiomatic for this boot path`);
    const nmiReturnPC = manifest.convergence?.idiomatic?.nmiReturnPC;
    assert.notEqual(nmiReturnPC, undefined, `${gameId}: runtime idiomatic needs convergence.idiomatic.nmiReturnPC`);

    // web/player.html's keydown handler matches KeyboardEvent.CODE, so every manifest key must be a valid
    // e.code (Digit5/Space/ArrowLeft...), NOT an e.key character ("5"/" "). invaders shipped with e.key
    // chars, so coin/start/fire were dead in the browser while the arrows (identical in both) worked.
    const CODE = /^(Key[A-Z]|Digit[0-9]|Arrow(Up|Down|Left|Right)|Space|Enter|Escape|Tab|Backspace|Numpad[0-9]|(Shift|Control|Alt|Meta)(Left|Right))$/;
    for (const k of Object.keys(manifest.inputs.keys)) {
      assert.ok(CODE.test(k), `${gameId}: manifest.inputs.keys "${k}" is not a KeyboardEvent.code (player.html matches e.code) — use Digit5/Space/ArrowLeft, not e.key chars`);
    }

    // The board Inputs the worker constructs per Machine -- the exact thing whose absence made invaders
    // unplayable. It must be a real constructor.
    const { Inputs } = await import(`../../boards/${manifest.board}/io.js`);
    assert.equal(typeof Inputs, "function", `boards/${manifest.board}/io.js must export an Inputs class`);
    const inputs = new Inputs(); // must not throw

    const machineMod = await import(`../../games/${gameId}/machine.js`);
    const { Machine } = machineMod;
    const overrides = await machineMod.resolveAllIdiomatic();
    const bins = Object.fromEntries(names.map((n) => [n, new Uint8Array(readFileSync(romPath(n)))]));
    const { maincpu, ...gfx } = bins;

    // The EXACT worker construction (web/worker.js): (rom, {inputs, ...gfx, overrides}).
    const m = new Machine(maincpu, { inputs, ...gfx, overrides });

    const r = runIdiomaticGame(m, {
      bootAddr: 0x0000,
      nmiReturnPC,
      maxFrames: FRAMES,
      onFrame: (mm) => { mm.io.inputAssert = {}; }, // no input; matches the worker's per-frame assert shape
    });
    assert.equal(r.stopError, null, `${gameId}: worker-form run threw: ${r.stop}`);
    assert.ok(r.frames >= FRAMES, `${gameId}: only advanced ${r.frames}/${FRAMES} frames (${r.stop})`);
  });
}
