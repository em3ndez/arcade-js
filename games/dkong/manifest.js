// SPDX-License-Identifier: GPL-3.0-only
//
// Donkey Kong — game manifest. Declares which CPU + board this romset runs on,
// how to assemble its (uncommitted, copyrighted) ROM, and metadata for the
// launcher. This is the single source of truth for the ROM part list + checksums
// (tools/build-rom.mjs reads it; nothing duplicates the part names).
//
// NOTE: the deeper hardware config (memory map, i/o bit maps, video decode,
// frame timing, ROM entry points) currently lives in the board + machine code
// (boards/dkong/*, games/dkong/machine.js). Those migrate into this manifest as
// declarative data when the core is parameterized for a second board — see
// core/README.md. Kept in code for now to preserve the pixel-validated engine
// byte-for-byte.

export default {
  id: "dkong",
  title: "Donkey Kong",
  year: 1981,
  manufacturer: "Nintendo",
  orientation: "vertical",     // portrait; the display is rotated 90° CCW
  screen: { width: 256, height: 224, rot: 270 },  // MAME ROT270 = 90° CCW (SWAP_XY|FLIP_Y)

  cpu: "z80",                  // core/cpu/z80.js
  board: "dkong",              // boards/dkong/
  mameDriver: "dkong.cpp",     // the board is named after its MAME driver

  // Live runtime. "translated" runs the faithful translated layer on the cycle-driven engine.
  // "idiomatic" runs the whole game on the readable idiomatic layer under the COROUTINE engine
  // (web/worker.js: runGeneratorGame + machine.js resolveAllIdiomatic). DK is on "translated"
  // while its idiomatic layer is rebuilt from the oracle: only ram.js survives, so
  // resolveAllIdiomatic cannot resolve a single routine and the idiomatic runtime would not boot.
  // ★ NOTE FOR ANYONE FLIPPING A GAME TO THIS RUNTIME: the two runtimes RENDER DIFFERENTLY. The
  // cycle-driven one captures per scanline and adds a sprite post-pass; this one calls
  // machine.renderFrame() on demand. renderFrame() painted the TILEMAP ONLY until the sprite
  // post-pass was added to it, so switching a game here without that fix yields a game whose
  // girders, ladders and HUD are perfect and whose Mario, Kong, barrels and Pauline are simply
  // absent — a picture plausible enough to pass a careless glance.
  runtime: "translated",

  // The declarative input contract the game-agnostic web layer reads: it builds
  // its keyboard map, coin/start buttons, and worker port list from here, so no
  // DK-specific ports/keys/bits are hardcoded in web/. A second game supplies its
  // own inputs block and the same web player drives it. Values mirror the board's
  // input ports (boards/dkong/io.js) and the historical web/player.html bindings.
  inputs: {
    ports: { in0: 0x7c00, in1: 0x7c80, in2: 0x7d00 },
    // logical action -> { port address, bit mask }
    actions: {
      right:  { port: 0x7c00, bit: 0x01 },
      left:   { port: 0x7c00, bit: 0x02 },
      up:     { port: 0x7c00, bit: 0x04 },
      down:   { port: 0x7c00, bit: 0x08 },
      jump:   { port: 0x7c00, bit: 0x10 },
      coin:   { port: 0x7d00, bit: 0x80 },
      start1: { port: 0x7d00, bit: 0x04 },
      start2: { port: 0x7d00, bit: 0x08 },
    },
    // web-player keyboard bindings: KeyboardEvent.code -> action name
    keys: {
      ArrowRight: "right", KeyD: "right", ArrowLeft: "left", KeyA: "left",
      ArrowUp: "up", KeyW: "up", ArrowDown: "down", KeyS: "down",
      Space: "jump", KeyZ: "jump", KeyX: "jump",
      Digit5: "coin", KeyC: "coin", Digit1: "start1", Digit2: "start2",
    },
  },

  // Optional audio contract, read by the game-agnostic web player exactly the way
  // `inputs` is: `map` is the declarative sound-command map (games/dkong/audio/
  // sounds.js — data only), `synth` the module that RE-CREATES the board's
  // discrete analogue effects, `samples` the directory the local recorder writes
  // to. ALL THREE PATHS ARE RELATIVE TO THIS GAME'S DIRECTORY.
  //
  // The two sound sources are not equally available, and that asymmetry is the
  // whole point of having both:
  //   • `synth` ships with arcade-js and needs nothing installed — DK's walk,
  //     jump and boom are discrete circuits with no sample data in any ROM, so
  //     they are synthesised from measured circuit parameters and are our own
  //     work. Every visitor hears these.
  //   • `samples` holds the tunes, which come out of a second CPU running its
  //     own ROM and so can only be recorded — LOCALLY, by the visitor's own
  //     `make samples` from their own MAME + ROM. That directory is gitignored
  //     and normally ABSENT; a fresh clone therefore plays the three effects and
  //     no music. Where a recording exists it overrides the synthesis of the
  //     same name (see the AUDIO section of web/player.html).
  // Omitting this block in another game's manifest means that game has no audio
  // layer at all; omitting just `synth` means it has no synthesisable effects.
  audio: {
    map: "audio/sounds.js",
    synth: "audio/synth.js",
    samples: "audio/samples",
    // Filenames record_samples.py gives a clip, by write. Kept here rather than in
    // sounds.js because it is a property of the RECORDER's output layout, not of
    // the hardware: sounds.js is the hardware map and stays free of file paths.
    // `irq` is the 0x7D80 line, which carries the death tune -- it is a third
    // write surface, not a trigger bit, so it gets its own id.
    clipIds: { trigger: "trig{n}", latch: "latch_{vv}", irq: "irq" },
  },

  // ROM assembly: MAME part filenames (from your own dkong.zip), concatenated in
  // address order into the flat images the engine loads. sha256 + size verify each,
  // so a wrong/damaged romset fails loudly. ROM bytes are copyrighted and never
  // committed — see rom/README.md.
  rom: {
    zip: "dkong.zip",
    images: {
      maincpu: {
        parts: ["c_5et_g.bin", "c_5ct_g.bin", "c_5bt_g.bin", "c_5at_g.bin"],
        size: 16384,
        sha256: "b24ea34a6554489184374635e5646f5e0dd4fccaec4c78c84fbfb9a6ea328c5d",
      },
      gfx1: {
        parts: ["v_5h_b.bin", "v_3pt.bin"],
        size: 4096,
        sha256: "fff4f3dfb860834d9a3d57bc794a7d0a84d3da19d86dd051bbd9ebba8501f581",
      },
      gfx2: {
        parts: ["l_4m_b.bin", "l_4n_b.bin", "l_4r_b.bin", "l_4s_b.bin"],
        size: 8192,
        sha256: "db4f7a4433febed7e609bd2705ad22b2ac4610299f61c37877116f646a457873",
      },
      proms: {
        parts: ["c-2k.bpr", "c-2j.bpr", "v-5e.bpr"],
        size: 768,
        sha256: "740d05416129bf52126396d814c39a517134132e18b202e8058ecdbde453b278",
      },
    },
  },

  // Entropy pinning for JS<->MAME equivalence testing (TEST-ONLY; never shipped). DK's RNG is a
  // main-loop spin counter at 0x6019, raced against the vblank NMI and mixed into the seed 0x6018
  // once per frame by sub_0057 (0x6018 = 0x6018 + 0x601a + 0x6019). The spin count is the only
  // divergent input (0x601a, the NMI counter, is the synced twin) — it forks within ~9 frames
  // because the translation isn't cycle-exact on the CPU-vs-beam race, and every RNG-driven sprite
  // then drifts. Discovered by the attract-mode RAM diff (docs/decompiler-pipeline.md (Entropy pinning)).
  //
  // The pin makes the whole RNG working set read a deterministic 0 on both engines: pin the seed
  // 0x6018 to its boot value (drop its single writer, sub_0057's store) and point 0x6019's direct
  // readers at the pinned seed. This is independent of 0x601a (which carries ±1 cutscene jitter
  // from the DMA-timing artifact) and of any 0x6019 writer. See core/entropy-pin.js (JS seam) and
  // tools/lua/pin_entropy.lua (MAME ROM patches); both realize the SAME intent, expressed twice so
  // they can be checked against each other. Result: the RNG-driven pixel divergence vanishes; the
  // residual is the accepted DMA cutscene artifact (validate under a convergent/align-tolerant diff).
  entropyPin: {
    seedBytes: [0x6018], // JS: drop writes -> 0x6018 stays boot 0
    redirectReads: [{ from: 0x6019, to: 0x6018 }], // JS: reads of 0x6019 return the pinned seed
    romPatches: [
      // MAME: same effect via cycle-neutral operand rewrites (`from` documents the original byte).
      { at: 0x0063, from: 0x18, to: 0x00 }, // sub_0057 `ld (0x6018),a` -> `ld (0x0000),a` (write to ROM ignored)
      { at: 0x0064, from: 0x60, to: 0x00 },
      { at: 0x03f4, from: 0x19, to: 0x18 }, // sub_03f2 `ld a,(0x6019)` -> `ld a,(0x6018)`
      { at: 0x2c3d, from: 0x19, to: 0x18 }, // state0   `ld a,(0x6019)` -> `ld a,(0x6018)`
      { at: 0x34cd, from: 0x19, to: 0x18 }, // state0   `ld a,(0x6019)` -> `ld a,(0x6018)`
    ],
  },

  // Cycle-free / coroutine convergence config (core/frame-stepped.js). The idiomatic layer is
  // cycle-free (never calls m.step), so its frame boundary is the vblank WAIT — DK's task-scheduler
  // main loop busy-waits at 0x02BD (`cp (0x6383); jr z,0x02BD`) until the NMI advances the frame
  // counter 0x601A. That is the yield point for the coroutine go-live engine (runGeneratorGame) AND
  // the poll PC where the translated oracle (runCycleFree) fires its once-per-frame NMI, so both
  // runs cross the frame boundary at the same logical point and reproduce each other on every live
  // cell (work + sprite + video RAM) — except the dead stack scratch (see below and
  // idiomatic/test/golive.test.js).
  convergence: {
    pollPCs: [0x02bd],
    // The go-live gate compares the idiomatic run against the poll-PC oracle over the whole dumped
    // state — work RAM 0x6000-0x6BFF, sprite RAM 0x7000-0x73FF, video RAM 0x7400-0x77FF — EXCEPT the
    // dead stack scratch. This is the MEMORY-EQUIVALENCE contract (docs/decompiler-pipeline.md): once
    // a leaf is idiomatic and DIRECT-called, the caller drops the oracle's push16/ret bracket, so the
    // guest stack stays clean and the transient bytes the oracle pushes below SP are simply never
    // written. Those bytes are dead — SP stays at/above the scratch floor, nothing reads them as data
    // — so they are excluded; every LIVE cell (incl. the rendered sprite/video output) is still
    // compared byte-for-byte. STACK_SCRATCH = [0x6BE0, 0x6C00) (SP inits at 0x6C00).
    stateExclude: { stack: [0x6be0, 0x6c00] }, // [start, end) — dead stack scratch below SP
    golive: { nmiReturnPC: 0x02bd },
  },

};
