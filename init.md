# Repository Guidelines Contributor Guide

  ## Summary

  Create a new root-level AGENTS.md titled “Repository Guidelines”. The document will be 200-400 words, Markdown-formatted, and specific to this Vite/React RetailMind repository.

  ## Key Changes

  - Add AGENTS.md at the repository root.
  - Cover these sections:
      - Project Structure & Module Organization
      - Build, Test, and Development Commands
      - Coding Style & Naming Conventions
      - Testing Guidelines
      - Commit & Pull Request Guidelines
      - Agent-Specific Instructions
  - Reference actual repo paths:
      - src/ for React source
      - src/components/ for dashboard components
      - src/assets/ and public/ for static assets
      - backend/data/, backend/model/, and backend/modelling/ for datasets, model artifact, and notebooks
      - docs/ and backend/docs/ for documentation
  - List actual npm commands:
      - npm run dev
      - npm run build
      - npm run lint
      - npm run preview
  - Note that no test script currently exists; contributors should add tests alongside new behavior before introducing a test command.
  - Document observed commit style from history: short imperative/lowercase summaries such as add docs and add: model + code.
  - Include agent guidance to use rtk before shell commands, matching the existing repository instruction.

  ## Test Plan

  - Verify the generated file is valid Markdown.
  - Confirm word count stays within 200-400 words.
  - Confirm all commands and paths match the current repository.
  - Confirm no unrelated files are modified.

  ## Assumptions

  - The guide should be a contributor-facing document, not only an automation instruction file.
  - Since there is no existing test framework, testing guidance will describe the current gap and expected future convention rather than inventing a command.
