// SPDX-License-Identifier: GPL-3.0-only
// Atari Centipede (1981), set centiped3 (rev 3, the ROM on hand). MOS 6502 — new CPU family
// (core/cpu/6502.js). ROT270. Driver atari/centiped.cpp; board spec in scratch machine-notes.
// Centipede has NO colour PROM (centiped_v.cpp:186 — colours from writable RAM 0x1400), so there is
// no `proms` image and the board's 256B sync PROM is unused by the port. sha256 = concat of the parts.
// ⚠ ROM-PENDING: MAME rev3 names below; a properly-named/complete set is Karl's morning item. A full
// rev4 set instead flips the four program sha256 (gameplay identical).

export default {
  id: "centiped",
  title: "Centipede",
  year: 1981,
  manufacturer: "Atari",
  orientation: "vertical",
  screen: { width: 256, height: 240, rot: 270 }, // MAME ROT270; native raster 256x240

  cpu: "6502", // MOS 6502 @ 1.512MHz (12.096MHz/8)
  board: "centiped",
  mameDriver: "centiped.cpp",

  runtime: "idiomatic", // born-live on the generator engine; translated fallback until each routine lands
  idiomaticComplete: false,

  rom: {
    zip: "centiped.zip",
    images: {
      maincpu: { // four 2KB program ROMs, contiguous at 0x2000-0x3FFF
        parts: ["136001-307.d1", "136001-308.e1", "136001-309.fh1", "136001-310.j1"],
        size: 0x2000,
        sha256: "5edba8a30cd31c4ca67538fc83c6f6ea9303cc73168d26f46e47ec6753509a88",
      },
      gfx1: { // two 0x800 halves = the two bitplanes; 8x8 chars + 8x16 sprites decode from it
        parts: ["136001-211.f7", "136001-212.hj7"],
        size: 0x1000,
        sha256: "ff6403bd4313c269984f476a35dbe6ed1e9d4433a368e4579a5f4d8964b35177",
      },
    },
  },

  // Digital inputs (io indices; coin/start/fire on IN1, active-low, folded in io.js). The trackball
  // (player movement) is ANALOG — X on IN0, Y on IN2 — fed via io.applyTrackball, not a bit here.
  inputs: {
    ports: { in0: 0, in1: 1, in2: 2 },
    actions: {
      coin: { port: 1, bit: 0x20 },
      start1: { port: 1, bit: 0x01 },
      start2: { port: 1, bit: 0x02 },
      fire: { port: 1, bit: 0x04 },
    },
    trackball: { xPort: 0, yPort: 2 },
    keys: { Space: "fire", Digit5: "coin", KeyC: "coin", Digit1: "start1", Digit2: "start2" },
  },

  audio: null, // POKEY PSG (§5), pending — no sound CPU/sample ROM; blocked on MAME reference

  // §4 clock-free: frame sync is a CPU-polled vblank (IN0 bit6) plus a 32V IRQ, not a vblank NMI. The main
  // loop 0x2015 is the vblank-poll PC / main-loop top; the idiomatic layer runs on runIdiomaticIrqGame (the
  // generator yields at that poll). idiomatic.nmiReturnPC stays OMITTED (an IRQ game, no vblank NMI) so the
  // DONE-time web-boot gate stays skipped until the §5 worker wires the coroutine engine.
  convergence: { pollPCs: [0x2015] },

  entropyPin: null,
};
