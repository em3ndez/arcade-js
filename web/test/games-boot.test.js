// SPDX-License-Identifier: GPL-3.0-only
//
// games-boot — WEB-INTEGRATION smoke gate. Node gates + the §5 done-audit exercise the idiomatic layer
// directly; none construct the board `Inputs` or boot the worker loop, so a game can pass every gate and be
// UNPLAYABLE (invaders: no `Inputs` export; galaxian: input ports as hw addresses -> crash-loop; gfx1 key ->
// black screen; synth 404 -> silent). This replays web/worker.js's boot in node: worker-form construction +
// per-frame input keyed by the manifest port VALUES + sound tap armed, then asserts no throw, frames advance,
// a rendered frame is non-uniform, and an audio game drives the tap. ROM-guarded. Gates must mean "runs".
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

  // A §2 skeleton has no convergence.idiomatic.nmiReturnPC yet (the worker itself refuses idiomatic without
  // it) and boots short of FRAMES -- SKIP until nmiReturnPC lands. A DONE-time "runs in the browser" gate,
  // not a skeleton gate; it engages the moment nmiReturnPC lands.
  const nmiReturnPC = manifest.convergence?.idiomatic?.nmiReturnPC;
  const notReady = nmiReturnPC === undefined;
  test(`${gameId}: boots the way the web worker constructs it`, { skip: !haveRom || notReady }, async () => {
    // The worker only runs runtime "idiomatic" games this way; all registered games are idiomatic.
    assert.equal(manifest.runtime, "idiomatic", `${gameId} runtime must be idiomatic for this boot path`);

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

    // Feed input the worker way (readInputsInto): inputAssert keyed by the manifest PORT VALUES, not {}.
    // galaxian shipped ports as hw addresses (0x6000...) not io indices, so the worker keying crash-looped;
    // a bare {} never exercised the port keys.
    const zeroInput = Object.fromEntries(Object.values(manifest.inputs.ports).map((v) => [v, 0]));

    // Arm the sound tap as the worker does; an audio game must drive it during attract (galaxian shipped
    // silent -- a 404 synth path + a model that never voiced the background/tune).
    let soundWrites = 0;
    m.io.onSoundWrite = () => { soundWrites++; };

    const r = runIdiomaticGame(m, {
      bootAddr: 0x0000,
      nmiReturnPC,
      maxFrames: FRAMES,
      onFrame: (mm) => { mm.io.inputAssert = zeroInput; },
    });
    assert.equal(r.stopError, null, `${gameId}: worker-form run threw: ${r.stop}`);
    assert.ok(r.frames >= FRAMES, `${gameId}: only advanced ${r.frames}/${FRAMES} frames (${r.stop})`);

    // Render the worker way (machine.renderFrame) and assert a NON-uniform buffer: the gfx1 key mismatch left
    // this.video null -> an all-black (uniform) frame that boots fine but shows nothing.
    const frame = m.renderFrame();
    assert.ok(frame && frame.length > 0, `${gameId}: renderFrame produced no buffer`);
    let uniform = true;
    for (let i = 1; i < frame.length; i++) if (frame[i] !== frame[0]) { uniform = false; break; }
    assert.ok(!uniform, `${gameId}: rendered attract frame is uniform (decoded graphics missing? black screen)`);

    // "Tick audio": a game declaring an audio block must drive the sound tap during attract.
    if (manifest.audio) assert.ok(soundWrites > 0, `${gameId}: declares audio but wrote no sound in ${FRAMES} frames (dead sound seam?)`);
  });
}
