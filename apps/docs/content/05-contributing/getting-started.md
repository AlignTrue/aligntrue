---
title: Contributing - Getting Started
description: Set up your development environment and learn the contribution workflow for AlignTrue.
---

# Getting started with contributing

This guide helps you set up your development environment and understand the contribution workflow.

## Prerequisites

- Node.js 20+
- pnpm 8+
- Git

## Setup

Clone the repository:

```bash
git clone https://github.com/AlignTrue/aligntrue.git
cd aligntrue
```

Install dependencies:

```bash
pnpm install
```

Build all packages:

```bash
pnpm build
```

## Development Workflow

Run tests:

```bash
pnpm test
```

Run CLI locally:

```bash
cd packages/cli
pnpm dev
```

## Contribution Guidelines

1. Fork the repository
2. Create a feature branch
3. Make your changes with tests
4. Run `pnpm lint` and `pnpm test`
5. Submit a pull request

See [CONTRIBUTING.md](https://github.com/AlignTrue/aligntrue/blob/main/CONTRIBUTING.md) for detailed guidelines.
