import {describe, it, expect, beforeEach, afterEach} from 'vitest'
import {promises as fs} from 'fs'
import {join} from 'path'
import {execSync} from 'child_process'
import {tmpdir} from 'os'

/**
 * Integration Tests: Golden Repository Workflows
 *
 * These tests validate end-to-end workflows using a fresh copy of the golden repo.
 * They ensure the <60 second setup claim is accurate and deterministic.
 */

const GOLDEN_REPO_SOURCE = join(__dirname, '../../../..', 'examples/golden-repo')
const CLI_PATH = join(__dirname, '../../dist/index.js')

let testDir: string

beforeEach(async () => {
  // Create fresh test directory
  testDir = join(tmpdir(), `aligntrue-test-${Date.now()}`)
  await fs.mkdir(testDir, {recursive: true})
})

afterEach(async () => {
  // Cleanup
  if (testDir) {
    await fs.rm(testDir, {recursive: true, force: true})
  }
})

describe('Golden Repository Workflows', () => {
  it('Fresh init workflow completes in <60 seconds', async () => {
    const startTime = Date.now()

    // Start with empty directory
    const projectDir = join(testDir, 'fresh-project')
    await fs.mkdir(projectDir, {recursive: true})

    // Copy golden repo files (simulates user setup)
    await fs.cp(GOLDEN_REPO_SOURCE, projectDir, {recursive: true})

    // Run sync
    execSync(`node ${CLI_PATH} sync`, {
      cwd: projectDir,
      stdio: 'pipe',
    })

    // Verify outputs
    const cursorExists = await fs
      .access(join(projectDir, '.cursor/rules/aligntrue.mdc'))
      .then(() => true)
      .catch(() => false)
    const agentsExists = await fs
      .access(join(projectDir, 'AGENTS.md'))
      .then(() => true)
      .catch(() => false)
    const mcpExists = await fs
      .access(join(projectDir, '.vscode/mcp.json'))
      .then(() => true)
      .catch(() => false)

    expect(cursorExists).toBe(true)
    expect(agentsExists).toBe(true)
    expect(mcpExists).toBe(true)

    const duration = Date.now() - startTime
    expect(duration).toBeLessThan(60000) // <60 seconds
  }, 60000)

  it('Edit → sync workflow updates outputs and content hash', async () => {
    // Setup: Copy golden repo
    const projectDir = join(testDir, 'edit-project')
    await fs.cp(GOLDEN_REPO_SOURCE, projectDir, {recursive: true})

    // Initial sync
    execSync(`node ${CLI_PATH} sync`, {cwd: projectDir, stdio: 'pipe'})

    // Read initial hash
    const initialCursor = await fs.readFile(join(projectDir, '.cursor/rules/aligntrue.mdc'), 'utf8')
    const initialHashMatch = initialCursor.match(/Content Hash: ([a-f0-9]{64})/)
    expect(initialHashMatch).toBeTruthy()
    const initialHash = initialHashMatch![1]

    // Edit rules: add new rule before closing fence
    const rulesPath = join(projectDir, '.aligntrue/rules.md')
    const rulesContent = await fs.readFile(rulesPath, 'utf8')
    const updatedRules = rulesContent.replace(
      /```\s*$/,
      `  - id: new-rule
    severity: info
    applies_to: ["**/*.ts"]
    guidance: New rule added
\`\`\``
    )
    await fs.writeFile(rulesPath, updatedRules)

    // Sync again
    execSync(`node ${CLI_PATH} sync`, {cwd: projectDir, stdio: 'pipe'})

    // Verify hash changed
    const updatedCursor = await fs.readFile(join(projectDir, '.cursor/rules/aligntrue.mdc'), 'utf8')
    const updatedHashMatch = updatedCursor.match(/Content Hash: ([a-f0-9]{64})/)
    expect(updatedHashMatch).toBeTruthy()
    const updatedHash = updatedHashMatch![1]

    expect(updatedHash).not.toBe(initialHash)
    expect(updatedCursor).toContain('new-rule')
  })

  it('Multi-exporter validation generates all 3 outputs with correct format', async () => {
    // Setup
    const projectDir = join(testDir, 'multi-exporter')
    await fs.cp(GOLDEN_REPO_SOURCE, projectDir, {recursive: true})

    // Sync
    execSync(`node ${CLI_PATH} sync`, {cwd: projectDir, stdio: 'pipe'})

    // Verify Cursor format
    const cursorContent = await fs.readFile(join(projectDir, '.cursor/rules/aligntrue.mdc'), 'utf8')
    expect(cursorContent).toContain('---')  // YAML frontmatter
    expect(cursorContent).toContain('##')  // Markdown headers
    expect(cursorContent).toContain('Content Hash:')

    // Verify AGENTS.md format
    const agentsContent = await fs.readFile(join(projectDir, 'AGENTS.md'), 'utf8')
    expect(agentsContent).toContain('# AGENTS.md')
    expect(agentsContent).toContain('## Rule:')
    expect(agentsContent).toContain('Severity:')

    // Verify MCP config format
    const mcpContent = await fs.readFile(join(projectDir, '.vscode/mcp.json'), 'utf8')
    const mcpJson = JSON.parse(mcpContent)
    expect(mcpJson.version).toBe('v1')  // MCP uses 'v1' format
    expect(mcpJson.generated_by).toBe('AlignTrue')
    expect(mcpJson.rules).toBeInstanceOf(Array)
    expect(mcpJson.rules.length).toBeGreaterThan(0)
    expect(mcpJson.content_hash).toMatch(/^[a-f0-9]{64}$/)
  })

  it('Conflict detection identifies manual edits with force overwrite', async () => {
    // Setup
    const projectDir = join(testDir, 'conflict-project')
    await fs.cp(GOLDEN_REPO_SOURCE, projectDir, {recursive: true})

    // Initial sync
    execSync(`node ${CLI_PATH} sync`, {cwd: projectDir, stdio: 'pipe'})

    // Manually edit Cursor output
    const cursorPath = join(projectDir, '.cursor/rules/aligntrue.mdc')
    const cursorContent = await fs.readFile(cursorPath, 'utf8')
    const modifiedCursor = cursorContent.replace('testing-require-tests', 'testing-require-tests-MODIFIED')
    await fs.writeFile(cursorPath, modifiedCursor)

    // Regular sync with --force should overwrite manual changes (IR→agent direction)
    execSync(`node ${CLI_PATH} sync --force`, {
      cwd: projectDir,
      stdio: 'pipe',
    })

    // Verify manual edit was overwritten
    const restoredCursor = await fs.readFile(cursorPath, 'utf8')
    expect(restoredCursor).toContain('testing-require-tests')
    expect(restoredCursor).not.toContain('testing-require-tests-MODIFIED')
  })

  it('Dry-run mode shows audit trail without writing files', async () => {
    // Setup
    const projectDir = join(testDir, 'dry-run-project')
    await fs.cp(GOLDEN_REPO_SOURCE, projectDir, {recursive: true})

    // Remove outputs if they exist
    await fs.rm(join(projectDir, '.cursor'), {recursive: true, force: true})
    await fs.rm(join(projectDir, '.vscode'), {recursive: true, force: true})
    await fs.rm(join(projectDir, 'AGENTS.md'), {force: true})

    // Dry-run sync
    const output = execSync(`node ${CLI_PATH} sync --dry-run`, {
      cwd: projectDir,
      stdio: 'pipe',
    }).toString()

    // Verify dry-run mode message
    expect(output).toContain('Preview complete')
    expect(output).toContain('Dry-run mode: no files written')
    expect(output).toContain('Audit trail:')

    // Verify files NOT created
    const cursorExists = await fs
      .access(join(projectDir, '.cursor/rules/aligntrue.mdc'))
      .then(() => true)
      .catch(() => false)

    expect(cursorExists).toBe(false)
  })
})

