/**
 * Extract fenced ```aligntrue blocks from literate markdown
 */

export interface FencedBlock {
  content: string;
  startLine: number;
  endLine: number;
  sectionTitle?: string;
  guidanceBefore?: string;
}

export interface ParseResult {
  blocks: FencedBlock[];
  errors: Array<{ line: number; message: string }>;
}

/**
 * Parse markdown and extract fenced ```aligntrue blocks with context
 */
export function parseMarkdown(markdown: string): ParseResult {
  const blocks: FencedBlock[] = []
  const errors: Array<{ line: number; message: string }> = []

  // Normalize line endings to \n
  const normalized = markdown.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const lines = normalized.split('\n')

  let currentSection: string | undefined
  let currentGuidance: string[] = []
  let inFence = false
  let fenceStartLine = 0
  let fenceContent: string[] = []
  let fenceLanguage = ''

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!
    const lineNum = i + 1

    // Detect markdown headers for section titles
    const headerMatch = line.match(/^(#{1,6})\s+(.+)$/)
    if (headerMatch && !inFence) {
      currentSection = headerMatch[2]!.trim()
      currentGuidance = []
      continue
    }

    // Detect fenced code block start
    const fenceStartMatch = line.match(/^```(\w*)/)
    if (fenceStartMatch && !inFence) {
      fenceLanguage = fenceStartMatch[1] || ''
      if (fenceLanguage === 'aligntrue') {
        inFence = true
        fenceStartLine = lineNum
        fenceContent = []
      }
      continue
    }

    // Detect fenced code block end
    if (line.match(/^```$/) && inFence) {
      inFence = false
      
      // Store the block with its context
      const guidanceText = currentGuidance.length > 0 
        ? currentGuidance.join('\n').trim() 
        : undefined
      
      blocks.push({
        content: fenceContent.join('\n'),
        startLine: fenceStartLine,
        endLine: lineNum,
        ...(currentSection !== undefined && { sectionTitle: currentSection }),
        ...(guidanceText !== undefined && { guidanceBefore: guidanceText }),
      })

      // Reset guidance for next block
      currentGuidance = []
      continue
    }

    // Collect fence content
    if (inFence) {
      fenceContent.push(line)
      continue
    }

    // Collect guidance prose (non-header, non-fence lines)
    if (!inFence && line.trim() !== '') {
      currentGuidance.push(line)
    }
  }

  // Check for unclosed fence
  if (inFence) {
    errors.push({
      line: fenceStartLine,
      message: `Unclosed fenced code block starting at line ${fenceStartLine}`,
    })
  }

  // Validate single block per section
  const sectionValidation = validateSingleBlockPerSection(blocks)
  if (!sectionValidation.valid) {
    errors.push(...sectionValidation.errors)
  }

  return { blocks, errors }
}

/**
 * Validate that each section has at most one aligntrue block
 */
export function validateSingleBlockPerSection(
  blocks: FencedBlock[]
): { valid: boolean; errors: Array<{ line: number; message: string }> } {
  const errors: Array<{ line: number; message: string }> = []
  const sectionCounts = new Map<string, number>()

  for (const block of blocks) {
    const section = block.sectionTitle || '(no section)'
    const count = sectionCounts.get(section) || 0
    sectionCounts.set(section, count + 1)
  }

  for (const [section, count] of sectionCounts.entries()) {
    if (count > 1) {
      const matchingBlocks = blocks.filter(
        (b) => (b.sectionTitle || '(no section)') === section
      )
      const firstBlock = matchingBlocks[0]
      if (firstBlock) {
        errors.push({
          line: firstBlock.startLine,
          message: `Section "${section}" contains ${count} aligntrue blocks. Only one block per section is allowed.`,
        })
      }
    }
  }

  return { valid: errors.length === 0, errors }
}

