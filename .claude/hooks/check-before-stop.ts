// Stop hook: before Claude ends its turn with uncommitted changes, run the same
// checks as `bun run check` and hand any failures back (exit code 2) so they get
// fixed instead of reported as done.
import { $ } from "bun"

const input: unknown = await Bun.stdin.json()
// Already continuing because of this hook: let Claude stop rather than loop.
if (
  typeof input === "object" &&
  input !== null &&
  "stop_hook_active" in input &&
  input.stop_hook_active === true
) {
  process.exit(0)
}

const root = process.env.CLAUDE_PROJECT_DIR ?? process.cwd()
const changed = (await $`git status --porcelain`.cwd(root).quiet().text()).trim()
if (!changed) process.exit(0)

const problems: string[] = []

const format = await $`bunx prettier --check .`.cwd(root).quiet().nothrow()
if (format.exitCode !== 0) {
  const files = format.stderr
    .toString()
    .split("\n")
    .filter((line) => line.startsWith("[warn] ") && !line.includes("Code style issues"))
  problems.push(`Unformatted files (run \`bun run format\`):\n${files.join("\n")}`)
}

const lint = await $`bunx oxlint -f unix --report-unused-disable-directives-severity=error`
  .cwd(root)
  .quiet()
  .nothrow()
if (lint.exitCode !== 0) {
  const errors = lint.stdout
    .toString()
    .split("\n")
    .filter((line) => line.includes("[Error/"))
  problems.push(`Oxlint errors:\n${errors.join("\n")}`)
}

const types = await $`bunx tsc --noEmit`.cwd(root).quiet().nothrow()
if (types.exitCode !== 0) problems.push(`Type errors:\n${types.stdout.toString().trim()}`)

if (problems.length) {
  console.error(`\`bun run check\` fails — fix before finishing:\n\n${problems.join("\n\n")}`)
  process.exit(2)
}
