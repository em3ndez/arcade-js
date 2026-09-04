// SPDX-License-Identifier: GPL-3.0-only
// Grounded in mame-src/src/mame/midw8080/mw8080bw.cpp (ROM_START(invaders), invaders_state::invaders,
// GAMEL macro) + mw8080bw.h. entropyPin is null -- the attract-demo fork is a clock-free mid-ISR-phase residual (see DONE.md), not a pinnable counter.

export default {
  id: "invaders",
  title: "Space Invaders",
  year: 1978,
  manufacturer: "Taito / Midway",
  orientation: "vertical",
  screen: { width: 256, height: 224, rot: 270 }, // MAME ROT270 (mw8080bw.cpp:3305 GAMEL invaders)

  cpu: "8080", // Intel 8080 -- core/cpu/8080.js (ALU/register model)
  board: "invaders",
  mameDriver: "mw8080bw.cpp",

  runtime: "idiomatic", // born-live on the generator engine; translated fallback until routines land
  idiomaticComplete: true, // §3/§4 complete -- idiomatic_gate reports total 0

  rom: {
    zip: "invaders.zip",
    images: {
      // 4x2KB program ROM, loaded h/g/f/e at 0x0000/0x0800/0x1000/0x1800 (mw8080bw.cpp ROM_START).
      // sha256 is of the concatenation in that order (games/invaders/rom/maincpu.bin), SHA1-verified per chip.
      maincpu: {
        parts: ["invaders.h", "invaders.g", "invaders.f", "invaders.e"],
        size: 0x2000,
        sha256: "7446e0994117596de5206519e693f8875ff3455e0be121d5cb975c3bcc224c4e",
      },
      // No graphics ROMs (1bpp bitmap in RAM) and no sound ROM (discrete/samples audio) -- unlike the
      // Konami boards, invaders has only the program ROM.
    },
  },

  // 8080 PORT space (IN/OUT), ACTIVE HIGH (pressed bit reads 1). Ports 0/1/2 read via io.portIn.
  inputs: {
    ports: { in0: 0, in1: 1, in2: 2 },
    // Bits/polarity from INPUT_PORTS(invaders) in mw8080bw.cpp: coin ACTIVE-LOW (see io.js), rest active-high; verified by gap-free boot+gameplay.
    actions: {
      coin:   { port: 1, bit: 0x01, activeLow: true }, // IPT_COIN1
      start2: { port: 1, bit: 0x02 }, // IPT_START2
      start1: { port: 1, bit: 0x04 }, // IPT_START1
      fire:   { port: 1, bit: 0x10 }, // P1 button 1 (IN1 control bits)
      left:   { port: 1, bit: 0x20 }, // P1 left
      right:  { port: 1, bit: 0x40 }, // P1 right
      // P2 controls mirror onto IN2 control bits; DIPs (lives/bonus/coinage) also on IN2.
    },
    // KeyboardEvent.code values (web/player.html matches on e.code) -- NOT e.key characters.
    keys: {
      ArrowLeft: "left", KeyA: "left",
      ArrowRight: "right", KeyD: "right",
      Space: "fire",
      Digit5: "coin", KeyC: "coin",
      Digit1: "start1", Digit2: "start2",
    },
  },

  // Mechanics needing a poke-vs-MAME test (tools/mechanics_gate.py). Each is poked identically into the
  // idiomatic JS engine and MAME, and its own write-set asserted to agree (tools/mechanics_suite.py).
  mechanics: ["extra_ship_award", "player_shot_hits_alien", "player_death"],

  // The 8080 has NO NMI -- two RST interrupts/frame (RST1 0x08 mid, RST2 0x10 vblank); machine.fireNmi is
  // the ordered pair (§4 clock-free). Attract-validated: the two-RST cycle-free run reconverges to a MAME
  // state golden with only benign residual. Gameplay may expose more pollPCs -- extend from a longer golden.
  convergence: {
    pollPCs: [0x0a9e, 0x0ada, 0x0b71, 0x0b83], // ISR-timer busy-waits + pre-round loop tops
    // Excluded from the state reconverge: the ISR per-frame phase flag 0x2072 (set by RST2, cleared by RST1 --
    // a sampling-timing artifact of firing the pair together), the vblank frame-delay timer 0x20c0, and the stack.
    stateExclude: { cells: [0x2072, 0x20c0], stack: [0x23e0, 0x2400] },
    idiomatic: {
      // Cosmetic return PC for the delay-driven attract (frame-stepped.js just parks the PC there). The
      // transitional bootSp seat was retired in §4 step 3: the idiomatic ISR bodies are pure JS (no push16),
      // so fireNmi fires them directly with no seated stack.
      nmiReturnPC: 0x0ada,
    },
  },

  // Discrete-analogue audio (no sound CPU/ROM): `map` = the OUT-port bit-edge sound map (audio/sounds.js,
  // model "bitports"); `samples` = the gitignored bring-your-own clip dir. No `synth` (recorded clips).
  audio: {
    map: "audio/sounds.js",
    samples: "audio/samples",
  },

  // null: no pinnable spin counter. The attract-demo pixel fork past ~11-13s is a clock-free (model-b)
  // mid-ISR-phase residual, not RNG -- an entropy pin cannot close a phase drift; accepted, see DONE.md.
  entropyPin: null,
};
