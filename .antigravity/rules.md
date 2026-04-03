# Synkra AIOS Development Rules for AntiGravity

You are working with Synkra AIOS, an AI-Orchestrated System for Full Stack Development.

## Core Development Rules

### Agent Integration
- Recognize AIOS agent activations: @dev, @qa, @architect, @pm, @po, @sm, @analyst
- Agent commands use * prefix: *help, *create-story, *task, *exit
- Follow agent-specific workflows and patterns

### Story-Driven Development
1. **Always work from a story file** in docs/stories/
2. **Update story checkboxes** as you complete tasks: [ ] â†’ [x]
3. **Maintain the File List** section with all created/modified files
4. **Follow acceptance criteria** exactly as written

### Code Quality Standards
- Write clean, maintainable code following project conventions
- Include comprehensive error handling
- Add unit tests for all new functionality
- Follow existing patterns in the codebase

### Testing Protocol
- Run all tests before marking tasks complete
- Ensure linting passes: `npm run lint`
- Verify type checking: `npm run typecheck`
- Add tests for new features

### Design System Governance (Mandatory)
- **All new UI work must follow** `docs/DESIGN_SYSTEM.md`
- **Do not introduce new visual patterns ad hoc**; reuse existing tokens/components first
- If a required pattern does not exist, define it in the Design System first and only then apply it in pages
- Keep design tokens and shadow scale aligned with `src/index.css` and `tailwind.config.ts`
- Typography default is `Public Sans` (UI) and `IBM Plex Mono` (data/codes); avoid ad hoc font stacks
- Sidebar source of truth is `src/components/Layout.tsx` and must preserve expandable domain blocks
- Every async data block must include proper loading state using `Skeleton`
- For data pages, prefer `SectionPanel`, `DataTablePanel` and `TableSkeletonRows` before creating custom wrappers
- All tables must support sorting on their primary columns by default
- When a table includes validations, statuses or severities, provide direct filters for these alert states whenever that improves auditing
- Dashboard chart cards must follow the `ChartPanel` pattern (`src/components/design-system/ChartPanel.tsx`)
- The **Funil de ExecuÃ§Ã£o** chart is intentionally excluded for now and should not be redesigned in this stage

## AIOS Framework Structure

```
aios-core/
â”œâ”€â”€ agents/       # Agent persona definitions
â”œâ”€â”€ tasks/        # Executable task workflows
â”œâ”€â”€ workflows/    # Multi-step workflows
â”œâ”€â”€ templates/    # Document templates
â””â”€â”€ checklists/   # Validation checklists

docs/
â”œâ”€â”€ stories/      # Development stories
â”œâ”€â”€ prd/          # Sharded PRD sections
â””â”€â”€ architecture/ # Sharded architecture
```

## Development Workflow

1. **Read the story** - Understand requirements fully
2. **Implement sequentially** - Follow task order
3. **Test thoroughly** - Validate each step
4. **Update story** - Mark completed items
5. **Document changes** - Update File List

## Best Practices

### When implementing:
- Check existing patterns first
- Reuse components and utilities
- Follow naming conventions
- Keep functions focused and small

### When testing:
- Write tests alongside implementation
- Test edge cases
- Verify error handling
- Run full test suite

### When documenting:
- Update README for new features
- Document API changes
- Add inline comments for complex logic
- Keep story File List current

## Git & GitHub

- Use conventional commits: `feat:`, `fix:`, `docs:`, etc.
- Reference story ID in commits: `feat: implement IDE detection [Story 2.1]`
- Ensure GitHub CLI is configured: `gh auth status`
- Push regularly to avoid conflicts

## Common Patterns

### Error Handling
```javascript
try {
  // Operation
} catch (error) {
  console.error(`Error in ${operation}:`, error);
  throw new Error(`Failed to ${operation}: ${error.message}`);
}
```

### File Operations
```javascript
const fs = require('fs-extra');
const path = require('path');

// Always use absolute paths
const filePath = path.join(__dirname, 'relative/path');
```

### Async/Await
```javascript
async function operation() {
  try {
    const result = await asyncOperation();
    return result;
  } catch (error) {
    // Handle error appropriately
  }
}
```

---
*Synkra AIOS AntiGravity Configuration v1.0*
