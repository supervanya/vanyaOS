// PostToolUse hook (Edit|Write|MultiEdit): formats and lints the file Claude
// just changed, so problems surface on the spot instead of at commit time.
// Exit code 2 sends stderr back to Claude as feedback.
import { $ } from "bun"
import path from "node:path"

const input: unknown = await Bun.stdin.json()
const root = process.env.CLAUDE_PROJECT_DIR ?? process.cwd()
const file = filePathOf(input)
if (!file || !path.resolve(file).startsWith(root + path.sep)) process.exit(0)
const rel = path.relative(root, path.resolve(file))

const problems: string[] = []

const format = await $`bunx prettier --write --ignore-unknown ${rel}`.cwd(root).quiet().nothrow()
if (format.exitCode !== 0)
  problems.push(`Prettier couldn't format ${rel}:\n${format.stderr.toString()}`)

if (/\.[cm]?[jt]sx?$/.test(rel)) {
  const lint = await $`bunx oxlint --fix -f unix ${rel}`.cwd(root).quiet().nothrow()
  // Warnings are tracked in issues; only errors need fixing now.
  const errors = lint.stdout
    .toString()
    .split("\n")
    .filter((line) => line.includes("[Error/"))
  if (errors.length) problems.push(`Oxlint errors in ${rel}:\n${errors.join("\n")}`)
}

if (problems.length) {
  console.error(problems.join("\n\n"))
  process.exit(2)
}

function filePathOf(hookInput: unknown): string | undefined {
  if (typeof hookInput !== "object" || hookInput === null || !("tool_input" in hookInput))
    return undefined
  const toolInput = hookInput.tool_input
  if (typeof toolInput !== "object" || toolInput === null || !("file_path" in toolInput))
    return undefined
  return typeof toolInput.file_path === "string" ? toolInput.file_path : undefined
}
