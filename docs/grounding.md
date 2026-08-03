# Grounding — playing the game to recover what it *means*

Translation and decompilation recover *correct, readable structure*. They do not tell you what the game
**is**: its objective, its win/lose conditions, which sprite is an enemy and which is decoration, what a
tile or a RAM cell *means* in play. Reading code has a hard ceiling here — those answers live in
behaviour, not in opcodes. **Grounding** is the step that gets them: drive the real ROM in MAME and
watch what happens.

It is the second face of the oracle. The [pixel gate](pixel-gate.md) uses MAME to ask *"is our JS
correct?"*; grounding uses the same emulator as a **probe** — *"what does the game do?"* — turning
`[guess]` claims into `[seen]` facts, one experiment at a time. It runs on the **real ROM in MAME** and
needs no JS build at all, which is why the behavioural half can, and should, run on day one.

## Two halves, different dependencies

- **Behavioural grounding** — the game as a *player* sees it: objective, cast, win/lose, controls,
  mechanics. Needs only MAME + a verified romset; in its purest form it is just *playing and taking
  notes*, zero reverse-engineering. **Front-load it at day zero**, before naming — otherwise names get
  chosen at partial understanding and need a costly late re-derivation (the name-revisit in
  [the decompiler pipeline](decompiler-pipeline.md)).
- **Structural grounding** — attaching that behaviour to specific addresses/routines ("*this* cell is
  the completion gate," "*this* routine kills the player"). This needs the memory map, so it **threads
  through the decompile** as the map fills in.

**Grounding GATES a load-bearing, code-undecidable pick — in-loop, not deferred.** When the decompile
is about to commit an identity that (a) downstream work will *trust* and (b) the code alone cannot
settle — laser vs terrain-scroll, enemy vs ship, which axis is X — fire the experiment *then* and let
the result set the name. Do **not** name it from code and "let grounding upgrade it later": that
deferral is exactly how The Pit committed *"no laser exists"* and named enemy-3 a *"ship,"* each
caught only by a later round after the wrong pick had propagated through the map. Resolve a
load-bearing `[guess]` *as it is generated*, before building on it. (Low-stakes or code-decidable
calls defer freely — this gate is for the picks everything downstream will lean on.)

**Meaning rides on the map.** Poke-assisted grounding needs to know *where* to poke, which is the
decompile's output. With no map yet, bootstrap pokes with **memory-diffing**: play, snapshot RAM around
an event, and find the byte that changed ("which cell decrements when I die?" → the lives counter,
discovered with zero decompilation).

## The experiment discipline

Every semantic claim is an **experiment**, not an assertion:

1. **Hypothesis** — e.g. "the on-screen tank is the timer that kills you."
2. **Reach the state** — play to it, or poke the known cells to jump there fast.
3. **Watch** — log the RAM cells + read annotated frames.
4. **A/B with a negative control** — the control is what makes it proof. To test "is X an enemy?", force
   X *active* and overlap it onto the player (death) **and** run the identical setup with X far away (no
   death); the difference is the finding. A same-cell pin on a *dormant* actor fires nothing — a missing
   control produced an inconclusive death test once.
5. **Prefer a natural run** — the strongest evidence is a claim captured **end-to-end in normal play,
   zero pokes**; pokes are an accelerator, not the goal.

Cross-check a frame reading against the **validated renderer's own computation** of the same sprite RAM —
an independent second "yes" that the pixels mean what you think.

## Naming an unknown address: theory → prediction → measurement

"Ground it before you name it" is impossible as stated — you cannot instrument a routine without
some idea of what to look at. Reading the code and forming a theory is unavoidable and fine. The
rule is what happens next: **the theory must yield a prediction about something observable, and
you check the prediction before the name goes in the file.** A theory that cannot state a
prediction is not ready to be a name, and the routine stays `loc_`.

This is the discipline that was missing when DK's `0x2C` cluster was named. "A routine walking a
byte table to a `0x7F` terminator is a string renderer" is a reasonable *first* theory. It also
makes a sharp prediction: text in this ROM goes to VRAM at `0x7400+`, because that is where
`drawStringVertical` and `renderBcdColumn` put it. The routine writes 4-byte sprite records into
`SPRITE_BUFFER` at 0x6900 and touches nothing at 0x7400+ at all. One measurement kills the theory,
and that measurement was available from the first day. Instead the
theory became the name, the name became the neighbouring files' framing by imitation, and it
spread through the cluster's routines, their equivalence gates, and the `ram.js` roles those gates
cite back. Retiring it is a multi-commit job long after the fact, and a `ram.js` section banner
still carries it.

**What you can measure before you have any theory at all.** None of this requires knowing what
the routine is, and all of it narrows the hypothesis space:

- **Does it execute, and where?** A read tap at the entry (`tools/reach_sweep.lua`), attributed to
  board / level / substate. Separates "runs constantly on 25m" from "never runs in attract".
- **What is its write-set?** Clone the machine at each dispatch, run the routine, diff RAM. The set
  of addresses a routine touches is a fingerprint, and it is theory-free — but read it against the
  board's memory map, because a bare region name misleads. The example above writes only 0x69xx,
  0x67xx and 0x62A8, every one inside WORK RAM (0x6000-0x6BFF); DK's sprite RAM is 0x7000-0x73FF and
  it never touches it. Under a naive "sprite RAM vs tilemap RAM vs work RAM" reading that says "not
  a renderer", and it is one: 0x6900 is the DMA shadow buffer the i8257 blits to sprite RAM. The
  write-set is the evidence; the memory map is what lets it mean anything.
- **Who calls it, and what does the caller do with the result?**
- **What changes on screen in the frames after it runs?**

Do these first and the theory you form afterwards is already constrained by evidence, rather than
being a guess that evidence must later be found to fit.

The cost asymmetry is what makes this worth the trouble. Idiomatic **code** has an oracle: a
routine is checked against the frozen translation mechanically and for free, on every PUSH
(`hooks/pre-push` runs the suite; the pre-commit hook does not). That cover is not total — DK's 387
equivalence gates against its 389 registry entries, each comparing game-visible RAM minus that
gate's own declared scratch exclusions rather than the whole address space — but it is
automatic. Idiomatic **prose** has none — "this arm can never emit `0x1B`" is checkable only by a
human or agent disassembling the ROM, per claim. DK's idiomatic layer is roughly **3 lines of
prose per line of code**. Producing the expensive-to-verify kind at the speed of the cheap kind is
how the repair backlog got made.

## Triage the backlog FIRST: sweep reachability before deciding anything is blocked

Before a naming pass decides which routines are "hard", **measure which ones the ROM actually
executes.** Install a one-byte read tap at each unnamed routine's entry address (a Z80 opcode fetch
is a read of the program space), drive the game through every board / level / difficulty you can
poke to, and count hits — attributing each to the game state live at the time. It is one MAME run
and it re-plans the whole pass.

Do this because the intuition is wrong. On Donkey Kong, with 105 routines still unnamed, the
standing assumption — written into the lead's own status reports — was that they stayed unnamed
because nothing grounded what they depict. The sweep refuted it in 150 emulated seconds:

- **84 of 105 executed.** One fired **9,548 times** in that single run and was still unnamed.
  Reaching a routine is NECESSARY to ground it, not sufficient — `loc_16d0` below executes freely
  and its blind confirmer still says keep the neutral name, because its effect is indistinguishable
  from its sibling's in every observed frame. But a routine nobody has ever run is blocked for a
  different reason than one nobody has looked at, and the sweep tells you which you have.
- **38 fired on exactly one board** — reachable by poking to that board, in a coherent context
  where the screen still means something. This is the bucket where poking pays. Read it as
  sweep-relative too: that run drove levels 1-2 and difficulty 0-4 only, so "one board" means one
  board *among the states it drove*.
- **21 were not reached at all** — and a second sweep driving what the first skipped (sustained
  difficulty 5, deliberate death, 2-player) reached **7 of those 21**, one of them 1464 times. The
  real residue was 14. The first sweep's not-reached list overstated dead code by 50%.

Three rules fall out:

1. **"Unnamed" is not "unreachable".** Sort the backlog by hit count before planning; the
   high-frequency entries already have observations AVAILABLE and should be attacked first;
   whether those observations settle anything is a separate question. The ones nobody can reach
   are a different problem entirely.
2. **A not-reached list is an UPPER BOUND on dead code, never a measurement of it.** It is a
   statement about the states *your sweep drove*, not about the ROM. The DK sweep never died
   deliberately, never collected every prize, never ran two-player, and only brushed each
   difficulty — and a difficulty-5 guard arm landed in the not-reached set purely because
   difficulty 5 was never REACHED at all (that sweep's contexts top out at 4; its driver's phase
   counter never got there in 150 seconds). Report it as "not reached by this sweep", and narrow it by
   driving more states rather than by concluding.
3. **Corroborate a dead-code claim — and check the two methods answer the SAME question.** DK's
   `loc_16d0` appeared in the not-reached set, and a blind confirmer had independently derived
   *from code* that its one write is dead. That was written up in the pass-15 sweep report, and
   in an early draft of this section, as two unrelated methods agreeing. It was not: the
   confirmer's claim was that a WRITE is unobservable, the sweep's was that the ROUTINE never
   runs. A second sweep driving sustained difficulty 5, deliberate deaths and a 2-player game
   found `loc_16d0` executing **107 times**, so the sweep's half was wrong. This section then
   said "the confirmer's narrower claim may still hold" — and THAT was wrong too. Tracing it:
   ROM 0x2602 decrements 0x62A0 and, on zero, reloads 0x80 and calls 0x26DE, which is
   `bit 7,(hl) / jp z / ld (hl),2 / ret / ld (hl),0xFE / ret` — it writes +2 or −2 into 0x62A1,
   a direction reversal. The write is not inert either. BOTH halves of the "corroboration" were
   false, and the file the two of them were used to doubt had been right all along.
   Two results pointing the same direction are not corroboration unless they are answering the
   same question — and when a claim has been wrong twice, the next correction is the one to
   distrust most.

**Forcing PC to an entry is a different, weaker move.** Poking *state* makes the game dispatch the
routine itself, with the rest of the machine coherent, so the screen is still evidence. Forcing the
program counter runs the code in an incoherent machine: it yields the mechanism, which the code
already told you, and renders garbage, which grounds nothing. Reach for it only to confirm a
mechanism on a genuinely dead path — and note that a dead routine is still nameable, by its
mechanism, marked unreached.

## Rounds: persistence + a completeness critic

Run grounding in **rounds**, and keep going while each round still lands a *correction* (one game's first
three rounds each overturned something — the objective wasn't collect-all, the "enemies" were decor, a
"saucer" was a real enemy). Then spend the effort **once more** — a **completeness-critic** round that
asks "what's still unlooked-at?" — and stop only when it comes back dry.

State the **honest floor**: what is structurally *un*-observable and stays `[guess]` — e.g. a
sound-command→audio mapping with no audio oracle, or a RAM cell dormant on every reachable path. Naming
"we couldn't observe this" is a result, not a gap.

## The MAME observation rig

**Stand this rig up at day zero, alongside `gameplay.md`** — a verified romset, the per-frame RAM
dump, and the poke/input harness. It is the precondition for grounding *in-loop*: if the rig is a
late-phase setup, grounding slides to the end and stops gating the picks it should (§ the gate rule
above), and a whole session can be lost to a false "I can't ground yet." Build it before naming, not
after.

Agent-driven, headless, reproducible:

- Capture with `-video none -aviwrite` in the **displayed** orientation (rotation applied — *not*
  `-norotate`) so frames match what a player sees; extract frames with ffmpeg.
- A **per-frame Lua notifier** (`emu.add_machine_frame_notifier`) logs the RAM cells of interest each
  frame and can poke state / drive inputs. **Retain EVERY subscription token in a global — the notifier
  AND every `mem:install_write_tap` / `install_read_tap`.** A discarded token is silently
  garbage-collected mid-run and the tap/notifier stops firing, so the log flatlines partway through —
  which reads as *the game stalled or reset* when it is actually still running fine. Measured on The Pit
  (MAME 0.288): an **unheld** write-tap died at frame 184; the identical tap **held** in a global
  (`_G.__t = mem:install_write_tap(...)`) ran to completion (frame 529). Note which one bit: the
  notifier held globally tracked frame-for-frame all run — so when a trace goes dark, suspect an unheld
  **tap** token first, not the notifier. Cross-check any "it stopped" reading against a GC-immune
  signal: `manager.machine.screens:at(1):frame_number()` is a register read, not a subscription, and
  never lies.
- Reach cells with `mem = manager.machine.devices[":maincpu"].spaces["program"]; mem:read_u8 / write_u8`.

Gotchas that cost real time:

- Build a **properly-named, verified romset first** — a loose chip dump lacks the `.icNN` filenames
  `-verifyroms` needs.
- **Verify hardware/driver citations against the actual MAME source**, never a web summary — a wrong
  "fix" once pointed the board layer at a nonexistent driver file (the real one was confirmed via a `gh`
  code search on `mamedev/mame`).

## What grounding feeds

Grounding's `[seen]` facts flow into two places: the **names** (an earned name is a mechanism/role that
reached confidence — schedule an adversarial name-revisit once grounding is in) and the game's own
`mechanisms.md`, its [inside-out model](mechanisms.md). It also **extends the pixel gate** into deep
gameplay: the same pokes drive the engine to states attract mode never reaches, which can then be
pixel-validated too.

The worked example is **The Pit** (`games/thepit/mechanisms.md`): four grounding rounds took the whole
game from `[guess]` to `[seen]` — recovering the dig → collect → surface objective, refuting a decorative
"tank," and correcting names the code alone had gotten wrong.
