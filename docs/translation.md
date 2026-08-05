# 3. Translation to "assembly-JavaScript"

Each ROM routine becomes a JavaScript function that operates on a machine object `m` and mirrors
the original Z80 instruction sequence **one instruction at a time**. We call the result
*assembly-JavaScript*: it is JavaScript, but its shape is the assembly's. These functions are the
frozen oracle — `translated/` — that everything downstream is measured against.

## What a translated routine looks like

A routine reads and writes the CPU registers (`m.regs`), memory (`m.mem`), and hardware (`m.io`),
and calls `m.step(addr, tstates)` at each instruction to advance the program counter to that
address and charge the instruction's T-states. A fragment that loads a byte, tests it, and branches
translates to the equivalent register/flag operations plus the `m.step(...)` calls that account for
exactly the cycles the Z80 spent.

**`addr` is the NEXT instruction, not the one being charged** — `m.step` sets PC to where execution
lands. Get this backwards and correct code reads as broken: a loop whose accumulator is loaded
outside the body looks like it reloads every iteration, because the back-edge's `m.step` names the
first instruction *inside* the loop rather than the load. Two reviewers hit that same shape in one
night. It is settled without reading a single disassembly line, from `machine.js`'s own
`ret(cycles = 10) { this.step(this.pop16(), cycles); }`: the argument is the popped return address,
so it can only be the new PC. Prefer that proof — it is immune to the transcription being wrong,
which is what you are there to check.

Faithfulness is the whole point:

- **T-states are charged, not ignored.** The cycle budget per frame is fixed by the hardware, and
  the video output depends on *when* within the frame each write lands. A translation that gets the
  logic right but the timing wrong fails the pixel gate. `stepcheck` audits that every `m.step`
  target lands on a real instruction boundary; `stepaudit` audits the CHARGE against a table of its
  own, walking a recorded step trace. A cycle error that moves no memory is invisible to the state
  and pixel diffs, so it needs its own check — and it needs a check whose timing model is not the
  one under test, or it cannot fail visibly.
- **Flags are exact,** including the awkward ones (`DAA`/BCD, half-carry, parity/overflow, the
  signed vs unsigned distinctions). Each flag helper is pinned against the reference CPU across all
  cases before use.
- **Control flow is modelled honestly.** Tail-jumps that discard the current return address are
  modelled as returns to the caller's caller; the `rst`-dispatch tables become switch/dispatch on
  the same state byte; "caller-skip" idioms (a subroutine that pops its own return to skip the
  caller's remainder) are modelled as an early return the caller checks. Getting these wrong changes
  *which* frame resumes where, so they are translated as the ROM actually behaves.

## Why translation converges

Because the JavaScript runs the ROM's real logic, correctness is a property you can *drive toward*
rather than *guess at*: wherever the translation diverges from the reference emulator, the diff
points at the exact routine that ran on the diverging frame, and you fix that routine. Coverage grows
monotonically — a routine, once translated and gated, stays correct. Contrast reimplementation from
observation, where an unobserved case is simply absent and nothing tells you it's missing.

## Assembly-JavaScript is the oracle, not the destination

Assembly-JavaScript is deliberately *not* idiomatic JavaScript — it trades readability for a provable
correspondence to the ROM, and it is the frozen reference the rest of the pipeline validates against.
Rewriting each routine as ordinary, higher-level JavaScript is a separate stage: the rewrite lives in
`games/<id>/idiomatic/` and stands only once it passes the gate that proves it equivalent to its
translated counterpart. See [the decompiler pipeline](decompiler-pipeline.md).

The conventions below keep the two layers cleanly separable. Apply them at translation time, as each
routine is written — they are behaviour-neutral, so they cost nothing up front and mean `translated/`
never needs a retrofit.

### Convention: export every translated routine

**Every top-level routine in `translated/` is `export`ed — no exceptions, from the first line of a
new game.** The idiomatic rewrite reuses the oracle's own implementation of any callee it has not
rewritten yet, so each routine has exactly one implementation and there is never a copy to drift out
of sync. You cannot predict which routines a future rewrite will call, so exporting them all up front
is the only way to avoid discovering a missing export mid-rewrite and being tempted to paste a
verbatim copy elsewhere (which reintroduces the drift the whole design avoids). `export function foo`
runs identically to `function foo`, so it costs nothing.

### Convention: make every call `m.call(0xADDR)`, not a direct function call

A translated `call 0xNNNN` is written **`m.call(0x00nn, …args)`**, never a direct `sub_00nn(m)`.
`m.call` looks the address up in the routine registry (`games/<id>/routines.js`), which maps every
ROM address to its routine, and invokes it. The `m.push16(ret)` and the `m.step(target, cycles)`
that model the CALL's stack push and cycle cost still sit at the call site next to it; only the
*invocation* goes through `m.call`. (Extra args are forwarded for a routine the translation
parameterises; the return value is forwarded for the `rst` caller-skip idiom,
`if (!m.call(0x0008)) return;`.)

The single registry seam is what makes any routine **isolable**. Because every transfer of control
passes through it, the test harness can override one address to capture its real entry states and
replay a candidate rewrite against the oracle at exactly that point (see
[integration testing](integration-testing.md) and
[the decompiler pipeline](decompiler-pipeline.md)) — a leaf subroutine exactly like a dispatch
target. Without the seam, a routine reached only by a direct call could never be intercepted, because
its caller holds a fixed reference. The registry is the patch table over the address space; `m.call`
is the one seam every transfer of control passes through, exactly like a real `CALL` fetching whatever
code lives at the target.

The address is parsed from the routine's name (`loc_0874` → `0x0874`), so exporting every routine
(above) is what lets `routines.js` build the table by itself. Names of the exact shape `loc_hhhh`
are ROM addresses. Helper splits the translator introduces (`loc_25f2_body`, `loc_18c6_wrap`) do
**not** match that bare shape, so they are left out automatically and stay direct-called inside their
parent. A fragment that matches the shape yet must **not** claim its address is excluded explicitly
(the `NON_CANONICAL` set in `routines.js`).

### Convention: every routine is named `loc_<addr>`

At the translation layer, **every** routine is named `loc_` + its 4-hex ROM start address —
uniformly, with **no exceptions of any kind**. Not `sub_` (even though the disassembler labels
subroutines that way); not `entry_` (the hardware vectors are `loc_0000` for reset and `loc_0066`
for the NMI, never `entry_0000`/`entry_0066`); not `handler_`, `branch_`, `arm_`, `tail_`,
`dispatch…`, `boot…`; and never an English or camel-case name. The routine's role belongs in its
**comments**, never in its name. Earned English names are promoted only later, at the idiomatic
layer, and even then always keep the address as an anchor — see
[the decompiler pipeline](decompiler-pipeline.md).

The rule is verifiable, and every batch is checked before commit — this must print nothing:

```sh
ls games/<game>/translated/*.js games/<game>/translated/test/*.js \
  | xargs -n1 basename | grep -vE '^loc_[0-9a-f]{4}(_[a-z]+)?(\.test)?\.js$'
```

Donkey Kong, the first game translated, predates this rule and carries a legacy
`sub_`/`entry_`/`handler_`/`arm_`/`tail_` prefix zoo (which is why the address parser keys off the
`_hhhh` suffix regardless of prefix). That mix is history, not a pattern to copy: new games are
uniform `loc_<addr>` from the first routine.

### Convention: one file per routine

Each routine is its own file exporting that one function, which keeps the routine and its equivalence
test in an obvious one-to-one correspondence and — because two rewrites never touch the same file —
lets many run in parallel without collision. The idiomatic rewrite of a routine mirrors the same
one-file-per-routine shape in [`idiomatic/`](decompiler-pipeline.md).

### Convention: an externally-entered address is a routine boundary — never inline across it

A `loc_<addr>` reached by a `call`, `jp`, or `jr` **from a different routine** is a routine boundary,
and the bytes from there onward are that routine's — they must live in exactly ONE file. A routine's
body therefore runs from its entry to the first of: its `ret`/tail-jump, **or** the next label some
other routine enters; at that boundary it stops and **delegates** (`return m.call(0xBOUNDARY)` for a
fall-through or jump into it), it does not inline the target's code.

The failure mode this prevents: routine A flows through address X and inlines it, while routine B
does `jp X`. If X is not its own registered routine, `m.call(X)` (B's jump) has nowhere to resolve;
if you "fix" that by translating X *as well*, X's bytes now exist twice — once standalone, once
inside A — and the two copies drift the moment either is edited. Both are wrong. The right shape is:
X is its own routine (the sole implementation), and A is trimmed to end at X-1 and delegate into it.
This is the same move as a shared tail entered by many callers (they all delegate to the one
registered routine) — a mid-routine jump target is just that with the "many callers" being one of
them the fall-through.

The tracer labels every jump/call target, so the boundary always already has a `loc_<addr>` — the
split is "translate that label + trim the parent to delegate," never a hand-carve. The whole-machine
gate ([the integration-testing doc](integration-testing.md)) finds the load-bearing ones for you: an unregistered
`m.call` at boot is exactly an externally-entered address that got inlined instead of split.

## Partitioning a lift across agents: a routine is a RANGE, not a filename

Fanning the translated layer out across parallel agents needs a work list, and the obvious ways
to build one are wrong in two directions.

**Do not derive routine extents by slicing the listing.** A slicer that walks from an entry until
it "looks finished" gets it wrong both ways at once. Ways it went wrong on Time Pilot: the `ret`
terminator never fired, because the listing pads the mnemonic with spaces and the guard tested
for `"ret "`, so slices ran past a routine's end into the next one and into data tables that
decode as plausible nonsense; a hard line cap silently truncated the largest routines, stopping
one mid-pattern with no terminator; other slices were cut SHORT at a branch, handing an agent a
routine where both arms left the slice so it could not terminate as given; and the batch set did
not close over the call graph, so routines called by assigned routines were in no batch at all.

Walk control flow from the entry the way the tracer does, and stop only at a real terminator.

**Do not compute "missing" by comparing executed addresses against FILENAMES.** This is the more
expensive mistake because it looks right. An address MAME executes as a transfer target is not a
missing routine just because no `loc_<addr>.js` exists: most are INTERIOR — a loop back-edge, a
branch join, a shared tail — already transcribed inside the file that owns the surrounding range.
Dispatching those to agents finds nothing to do.

Subtract against COVERAGE, not names, and be careful which artifact you use:

- The **tracer's** own output (`out/coverage.json`, `out/unreached.txt`) is the reachability
  record, and it is what "still to lift" means.
- The `m.step` targets inside each existing file say exactly which addresses that file
  transcribes. This survives the no-prose rule below, because those are trailing comments on
  code rather than a header listing.
- **Do NOT use the unit-equivalence extents** (`out/units/extents.json`). Those follow tail jumps
  transitively, so an entry that tail-jumps into shared code reports an extent covering most of
  the ROM. Subtracting against them marks nearly everything covered — the same false negative,
  arrived at from the other side.

Then filter: an interior branch target is not an entry point. The test is whether anything
reaches it from OUTSIDE its own routine, which a scan of the ROM for every `call`, `jp cc`, `jr`,
`djnz` and raw little-endian word referencing the address settles in one pass.

**A second entry into one routine is real, and is not this.** Where the ROM genuinely has two
entries sharing a body — each with its own prologue before common code — the interior address
DOES need registering, because a caller entering later must not re-run the earlier prologue. Time
Pilot has several (`0x562A`, `0x4984`, `0x3B77`). Registering it is only half the fix: the
earlier entry must then DELEGATE into it (`m.call`) rather than transcribe the shared body too,
or the same ROM bytes exist in two files and the copies drift.

## Commit the lift in small batches, WHILE the next batch is being written

Do not let a translation pass accumulate into one commit. The costs are specific:

- **Review degrades.** A reviewer cannot read hundreds of files, so it samples. Defects a
  small-batch review catches cheaply survive a large one.
- **Every round re-reviews everything.** A defect anywhere means another pass over the whole
  mountain, almost all of it re-verifying files that were already fine.
- **Prose goes stale inside the pass.** A header written early describes helpers and conventions
  that the same pass later changes. A batch committed the day it is written cannot rot this way.
- **Nothing is recoverable until the end.** An uncommitted pass is a single point of failure and
  reads as a stall.

**The rule: commit roughly twenty routines at a time, and commit a finished batch while the next
is being lifted.** Ordering is almost free — a translated routine depends on the ROM and the
machine contract, not on its siblings. The exception is a file that imports a sibling directly
(a shared tail split out as a helper); keep such a pair in one batch.

Regenerate the registry after the batches land, not per batch: `node tools/gen-registry.mjs
<game>` rebuilds `translated/_registry.generated.js` from whatever is on disk, and the registry
imports every routine, so it cannot be committed ahead of them. Until it is regenerated, an
unregistered `m.call` is a loud, local failure — `emit.js` reports the first one as a boot gap —
so a partial registry is a normal intermediate state rather than a broken one.

## The translated layer carries NO explanatory prose

A translated file gets an SPDX line, a ONE-LINE identity (`loc_<addr>` and its ROM range,
optionally with a terse role), and the per-instruction trailing comments naming the address and
mnemonic each `m.step` just executed. Nothing else. No paragraphs on what the routine means, why
the stack balances, or what the ROM author was doing.

**Why, given the explanations are often true and sometimes interesting.** This layer is an
ORACLE. Its correctness is established mechanically — the listing byte-checked against the ROM,
every `m.step` target and T-state audited, the whole thing state-diffed against MAME frame by
frame. Explanatory prose adds nothing to that and cannot be checked by any of it, while it rots:
a header written early in a pass describes conventions the same pass later changes, and nothing
detects the drift. The failure mode to picture is a header that has been rewritten to DOCUMENT a
bug rather than fix it, which reads as understanding and is the opposite.

The per-instruction trailing comments are not prose and stay: they ARE the transcription, they
are mechanically checkable against the ROM, and they are what makes a wrong `m.step` findable.

**A trailing comment may append a short clause after `--`, and the test is whether the clause is
CHECKABLE.** `-- the state byte`, `-- DE = the 16-bit X`, `-- -0x0180` all name what the bytes
ARE, and a reviewer can confirm or refute each from the ROM. What is forbidden is a clause
asserting a MECHANISM the bytes do not show. The failure to picture: three sites in one batch
said an arm was "reached only on checksum failure", copied from the one neighbouring site where
that was true; at the other two the guard was reading back a tile and its colour attribute out of
video RAM, and there was no summation anywhere in the chain. Name what is compared, and stop.

**Understanding belongs downstream.** Decompilation and the understanding pass are where a
routine gets explained, in the idiomatic layer — where R21 then restricts a comment to describing
its own file. Per-address facts that must outlive a pass go in the `ROUTINES` registry in that
game's `idiomatic/names.js`, which the lift predates: during a lift there is nowhere durable to
put an explanation, which is another reason not to write one. Not `mechanisms.md` either, which
is rewritten from scratch every understanding pass.
