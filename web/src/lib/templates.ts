// Starter templates for new documents. The Product Spec ships with the Task State
// block so a fresh spec is an agent execution surface immediately.
export type Template = { id: string; name: string; emoji: string; description: string; body: (title: string) => string };

export const TEMPLATES: Template[] = [
  {
    id: 'blank',
    name: 'Blank',
    emoji: '📄',
    description: 'An empty document.',
    body: (t) => `# ${t}\n\n`,
  },
  {
    id: 'spec',
    name: 'Product Spec',
    emoji: '🧭',
    description: 'Spec with a live Task State block for human + agent work.',
    body: (t) => `# ${t}

<!-- easymd:task -->
## 📍 Task State
- **Goal:** —
- **Decisions:** —
- **Open questions:** —
- **Failed approaches:** —
- **Last validated:** —
- **Next action:** —
<!-- /easymd:task -->

## Context
What problem are we solving and why now?

## Requirements
- …

## Acceptance criteria
- [ ] …

## Out of scope
- …
`,
  },
  {
    id: 'meeting',
    name: 'Meeting Notes',
    emoji: '🗓️',
    description: 'Agenda, decisions, and action items.',
    body: (t) => `# ${t}

**Date:** \n**Attendees:**

## Agenda
- …

## Notes
- …

## Decisions
- …

## Action items
- [ ] …
`,
  },
  {
    id: 'rfc',
    name: 'Decision / RFC',
    emoji: '⚖️',
    description: 'Propose a decision with context and trade-offs.',
    body: (t) => `# ${t}

**Status:** Draft

## Context
…

## Decision
…

## Consequences
- …

## Alternatives considered
- …
`,
  },
];
