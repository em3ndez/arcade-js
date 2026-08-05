-- SPDX-License-Identifier: GPL-3.0-only
--
-- PER-ROUTINE state capture: the oracle side of the unit-equivalence harness.
--
-- A unit test needs a PAIR of samples from the SAME invocation -- state and registers
-- on ENTRY and again as the `ret` is about to execute. One run taps the whole spec.
--
-- WHY CURPC IS THE WHOLE TRICK: a read tap fires on DATA reads too, and this ROM's
-- self-check sweeps the image during boot, so a naive tap captures the checksum's state
-- instead. CURPC is the instruction now executing, so CURPC == the tapped address holds
-- exactly for the opcode fetch there.
--
-- PAIRING, AND WHAT IT REJECTS. An armed window is checked when its exit fires. Three
-- ways it is refused, and they do NOT behave alike:
--   NMI inside the window  -- RAM moved for reasons the routine did not cause. DISARM.
--   SP differs from entry  -- the `ret` belongs to another caller of shared code this
--                             routine tail-jumped into. STAY ARMED; ours may come.
--   return address differs -- same depth, different call chain. STAY ARMED.
-- Re-entry while armed re-arms: the previous invocation's exit never fired for us. A
-- conditional `ret` is not one of the reasons -- ret_taken() decodes it against F.
--
-- The return-address check is what stops a foreign `ret` at a coincidentally equal SP
-- from closing a window. Note what it does NOT diagnose: a routine whose spec exit list
-- is short -- because the static extent walk cannot follow a pushed continuation -- stays
-- armed and shows a high ret_aborts with closed=0. That is a gap in the SPEC, not proof
-- the routine is uncapturable.
--
-- The entry sample is BUFFERED and written only when an exit closes cleanly, so
-- retrying costs no disk traffic. The counters in the exit metadata -- rearms,
-- nmi_aborts, sp_aborts, ret_aborts -- say how many tries it took and why.
--
-- Env:
--   UNIT_SPEC  one line per routine, "<entry> <exit>[,<exit>...]", bare 4-digit hex.
--              Several exits because a routine can have several `ret` sites.
--   UNIT_OUT   output directory: <entry>.entry.bin/.txt, <entry>.exit.bin/.txt, plus
--              attempts.txt and config.txt.
--   CONFIG_OUT optional override for the configuration file's path.

local cpu = manager.machine.devices[":maincpu"]
local sp = cpu.spaces["program"]

local spec_path = assert(os.getenv("UNIT_SPEC"), "UNIT_SPEC not set")
local out_dir = assert(os.getenv("UNIT_OUT"), "UNIT_OUT not set")

local ROM_END = 0x5FFF  -- a stack pointer at or below this is not in RAM

-- CONFIGURATION: every pair here is an oracle, so a stray dipswitch cfg is wrong in a
-- way nothing downstream can see.
do
  local cfgf = io.open(os.getenv("CONFIG_OUT") or (out_dir .. "/config.txt"), "w")
  if cfgf then
    cfgf:setvbuf("no")
    cfgf:write(string.format("dsw0=0x%02X\ndsw1=0x%02X\ncontrol_rom0000=0x%02X\n",
      sp:read_u8(0xC360), sp:read_u8(0xC200), sp:read_u8(0x0000)))
    for _, rn in ipairs({ "AF", "BC", "DE", "HL", "IX", "IY", "SP" }) do
      local ok, v = pcall(function() return cpu.state[rn].value end)
      if ok and v ~= nil then cfgf:write(string.format("reg_%s=0x%04X\n", rn, v)) end
    end
    cfgf:close()
  end
end

-- Mirrors hardware.json "stateRegions". 4608 bytes.
local REGIONS = {
  { 0xA000, 0xA3FF, "color" },
  { 0xA400, 0xA7FF, "video" },
  { 0xA800, 0xAFFF, "work" },
  { 0xB000, 0xB0FF, "sprite0" },
  { 0xB400, 0xB4FF, "sprite1" }
}

-- Every register a translated routine can observe or change. The shadow bank is in
-- because `ex af,af'` and `exx` are real instructions in this ROM.
local REGS = { "AF", "BC", "DE", "HL", "IX", "IY", "SP", "AF2", "BC2", "DE2", "HL2", "I", "R", "IFF1", "IFF2", "IM" }

local function read_state()
  local parts = {}
  for _, r in ipairs(REGIONS) do
    for a = r[1], r[2] do
      parts[#parts + 1] = string.char(sp:read_u8(a))
    end
  end
  return table.concat(parts)
end

local function read_regs()
  local t = {}
  for _, rn in ipairs(REGS) do
    local ok, v = pcall(function() return cpu.state[rn].value end)
    if ok and v ~= nil then t[rn] = v & 0xFFFF end
  end
  return t
end

local function write_capture(base, state, regs, meta)
  local f = assert(io.open(out_dir .. "/" .. base .. ".bin", "wb"))
  f:setvbuf("no")
  f:write(state)
  f:close()
  local m = assert(io.open(out_dir .. "/" .. base .. ".txt", "w"))
  m:setvbuf("no")
  for _, line in ipairs(meta) do m:write(line .. "\n") end
  for _, rn in ipairs(REGS) do
    if regs[rn] then m:write(string.format("reg_%s=0x%04X\n", rn, regs[rn])) end
  end
  m:close()
end

-- Parse the spec into routines and an address -> work map.
local routines = {}  -- entry -> work record
local at = {}        -- address -> { entries, exits }

local function slot(addr)
  local s = at[addr]
  if not s then s = { entries = {}, exits = {} }; at[addr] = s end
  return s
end

-- Bind a fresh local rather than assigning to the for-loop control variable: Lua 5.5 made
-- those const, so `luac -p` on a 5.5 host rejects this file even though MAME 0.288 runs 5.4
-- and executes it fine. Anyone linting the repo with a current luac would read a working
-- instrument as broken.
for raw_line in io.lines(spec_path) do
  local line = raw_line:match("^%s*(.-)%s*$")
  if line ~= "" and line:sub(1, 1) ~= "#" then
    local ent, exits = line:match("^(%x+)%s+(%S+)$")
    if ent then
      local r = { entry = tonumber(ent, 16), state = 0,
                  rearms = 0, nmi_aborts = 0, sp_aborts = 0, exits = {} }
      routines[r.entry] = r
      table.insert(slot(r.entry).entries, r)
      for e in exits:gmatch("%x+") do
        local ea = tonumber(e, 16)
        -- An exit AT the entry address cannot be used: one tap address cannot be both
        -- "arm here" and "close here" in the same callback, so such a routine would
        -- arm forever and never close. Dropping it silently would be indistinguishable
        -- from "never executed", so it is recorded as an explicit exclusion.
        if ea ~= r.entry then
          r.exits[ea] = true
          table.insert(slot(ea).exits, r)
        else
          r.self_exit = true
        end
      end
    end
  end
end

-- NMI accounting: the vblank handler entered between a pair's halves moves RAM the
-- routine is not responsible for, so counting vector fetches lets the pair be rejected.
--
-- EVERY TAP OBJECT MUST BE HELD IN A GLOBAL. install_read_tap returns an object owning
-- the subscription; drop the reference and the collector takes it, the tap stops firing
-- SILENTLY, and MAME still exits 0 -- so the capture looks complete and is not.
_G.__unit_taps = {}

local nmi_count = 0
local NMI_VECTOR = 0x0066
_G.__unit_taps[#_G.__unit_taps + 1] =
sp:install_read_tap(NMI_VECTOR, NMI_VECTOR, "unit_nmi", function(offset, data, mask)
  if cpu.state["CURPC"].value == NMI_VECTOR then nmi_count = nmi_count + 1 end
  return data
end)

local function now_cycles()
  return manager.machine.time:as_double() * 3072000
end

-- Is the `ret` at the tapped address actually going to return? The tap fires during the
-- OPCODE FETCH, before the flags are consulted, so a conditional `ret cc` fetch does not
-- mean the routine is leaving. Excluding conditional rets would cost several
-- heavily-executed routines all their coverage, so decode the condition here instead.
--
-- `data` is the byte the tap reports; re-reading it through the same space would
-- re-enter the tap.
--
--   0xC9              ret            unconditional
--   0b11 ccc 000      ret cc         ccc = nz z nc c po pe p m
local CC_MASK = { 0x40, 0x40, 0x01, 0x01, 0x04, 0x04, 0x80, 0x80 }
local function ret_taken(op)
  if op == 0xC9 then return true end
  if (op & 0xC7) ~= 0xC0 then return false end -- not a ret at all: a stale spec entry
  local y = (op >> 3) & 7
  local set = (cpu.state["AF"].value & CC_MASK[y + 1]) ~= 0
  if y % 2 == 0 then return not set end -- nz nc po p
  return set
end

for addr, s in pairs(at) do
  _G.__unit_taps[#_G.__unit_taps + 1] =
  sp:install_read_tap(addr, addr, string.format("unit_%04X", addr), function(offset, data, mask)
    if cpu.state["CURPC"].value ~= addr then return data end -- a data read, not a fetch

    -- Exits first: a routine whose entry and exit taps land on the same address
    -- must close the pair it already has open before a new one is armed.
    for _, r in ipairs(s.exits) do
      if r.state == 1 and ret_taken(data) then
        local regs = read_regs()
        if nmi_count ~= r.nmi_at_entry then
          -- An NMI ran inside the window: DISARM and wait for a cleaner invocation
          -- rather than giving up on the routine.
          r.state = 0
          r.nmi_aborts = r.nmi_aborts + 1
        elseif regs.SP ~= r.entry_regs.SP then
          -- A `ret` at a different stack depth belongs to another caller of shared
          -- code this routine jumped into. STAY ARMED: ours may still be coming, and a
          -- routine can take thousands of rejections before its own exit comes round.
          r.sp_aborts = r.sp_aborts + 1
        elseif r.entry_ret ~= nil and sp:read_u16(regs.SP) ~= r.entry_ret then
          -- Same depth, DIFFERENT call chain. Pairing these halves would read
          -- downstream as a translation defect.  Reject.
          r.ret_aborts = (r.ret_aborts or 0) + 1
        else
          r.state = 2
          write_capture(string.format("%04X.entry", r.entry), r.entry_state, r.entry_regs, {
            string.format("entry_pc=0x%04X", r.entry),
            string.format("cycles=%.0f", r.entry_cycles),
          })
          write_capture(string.format("%04X.exit", r.entry), read_state(), regs, {
            string.format("exit_pc=0x%04X", addr),
            string.format("entry_pc=0x%04X", r.entry),
            string.format("cycles=%.0f", now_cycles()),
            string.format("rearms=%d", r.rearms),
            string.format("nmi_aborts=%d", r.nmi_aborts),
            string.format("sp_aborts=%d", r.sp_aborts),
            string.format("ret_aborts=%d", r.ret_aborts or 0),
          })
          r.entry_state = nil
        end
      end
    end

    for _, r in ipairs(s.entries) do
      if r.state == 0 or r.state == 1 then
        -- Re-entry while armed: the previous invocation's exit never fired for us --
        -- an unlisted exit, a mismatched SP, or recursion. NOT a conditional `ret`,
        -- which ret_taken() handles. The newest entry is the one whose exit fires next,
        -- and the buffered sample means re-arming costs nothing on disk.
        if r.state == 1 then r.rearms = r.rearms + 1 end
        r.state = 1
        r.arms = (r.arms or 0) + 1
        r.nmi_at_entry = nmi_count
        r.entry_cycles = now_cycles()
        r.entry_regs = read_regs()
        -- SP alone does not identify an invocation -- see the header.
        -- Reading through the TAPPED space re-enters the tap. At reset SP is 0x0000,
        -- which is itself a tapped entry, so this recursed and fabricated ~200 arms for
        -- a routine that ran once. Only a stack in RAM can hold a return address, so
        -- skip the read when SP is inside the ROM window.
        r.entry_ret = r.entry_regs.SP > ROM_END and sp:read_u16(r.entry_regs.SP) or nil
        r.entry_state = read_state()
      end
    end
    return data
  end)
end

-- ATTEMPT LOG, so "never ran" and "ran but never closed a clean window" stay
-- distinguishable -- otherwise the coverage account calls both "not reached".
--
-- Written periodically AND at shutdown: `emu.register_stop` does not exist in MAME
-- 0.288 but `emu.add_machine_stop_notifier` does, so the final file is complete. The
-- periodic write stays because an abnormal exit runs no hook at all.
--
-- self_exit: a listed exit equals the entry, which that tap cannot both arm and close,
-- so nonzero arms with closed=0 is expected there rather than a failure to run.
local function write_attempts()
  local f = io.open(out_dir .. "/attempts.txt", "w")
  if not f then return end
  f:setvbuf("no")
  for entry, r in pairs(routines) do
    f:write(string.format(
      "%04X arms=%d rearms=%d nmi_aborts=%d sp_aborts=%d ret_aborts=%d closed=%d self_exit=%d\n",
      entry, r.arms or 0, r.rearms, r.nmi_aborts, r.sp_aborts, r.ret_aborts or 0,
      r.state == 2 and 1 or 0, r.self_exit and 1 or 0))
  end
  f:close()
end

_G.__unit_frame = 0
_G.__unit_sub = emu.add_machine_frame_notifier(function()
  _G.__unit_frame = _G.__unit_frame + 1
  if _G.__unit_frame % 15 == 0 then write_attempts() end
end)
_G.__unit_stop = emu.add_machine_stop_notifier(write_attempts)
