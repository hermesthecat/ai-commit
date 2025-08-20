# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AI Commit is a Visual Studio Code extension that generates conventional commit messages using AI providers (OpenAI, Gemini, DeepSeek). It analyzes git diffs from staged changes and creates standardized commit messages following the Conventional Commits specification with optional Gitmoji support.

## Development Commands

### Build & Development
- `npm run compile` - Compile TypeScript using Webpack
- `npm run build` - Production build with minification and source maps
- `npm run watch` - Watch mode for development
- `F5` in VS Code - Launch Extension Development Host for testing

### Quality Assurance
- `npm run lint` - ESLint TypeScript files in src/
- `npm run test` - Run extension tests
- `npm run pretest` - Run compile-tests, compile, and lint in sequence

### Distribution
- `npm run package` - Create .vsix package for distribution
- `npm run publish` - Publish to VS Code Marketplace

## Architecture Overview

### Core Components
- **`src/extension.ts`** - Extension activation entry point, initializes ConfigurationManager and CommandManager
- **`src/commands.ts`** - Command registration and error handling for VS Code commands
- **`src/config.ts`** - Singleton ConfigurationManager for settings under `ai-commit` namespace
- **`src/generate-commit-msg.ts`** - Main logic: gets git diff, constructs prompts, calls AI providers, populates SCM input

### AI Provider Integration
- **`src/openai-utils.ts`** - OpenAI API client and interaction logic
- **`src/gemini-utils.ts`** - Google Gemini API client and interaction logic
- Supports multiple providers via `AI_PROVIDER` setting (`openai` | `gemini`)

### Git Integration
- **`src/git-utils.ts`** - Uses `simple-git` library for staged diff retrieval
- **`src/utils.ts`** - Progress handling and user notifications during API calls

### Prompt System
- **`src/prompts.ts`** - Dynamic prompt construction with language support
- **`prompt/with_gitmoji.md`** - Default prompt template with Gitmoji support
- **`prompt/without_gitmoji.md`** - Alternative prompt without Gitmoji
- Custom prompts via `AI_COMMIT_SYSTEM_PROMPT` configuration

## Configuration Settings

Key settings in VS Code under `ai-commit` namespace:
- `AI_PROVIDER` - Provider selection (`openai` | `gemini`)
- `OPENAI_API_KEY` / `GEMINI_API_KEY` - API authentication
- `OPENAI_MODEL` - Model selection (default: `gpt-4o`)
- `GEMINI_MODEL` - Gemini model (default: `gemini-2.0-flash-001`)
- `AI_COMMIT_LANGUAGE` - 19 supported languages for commit messages
- `AI_COMMIT_SYSTEM_PROMPT` - Custom system prompt override
- Temperature settings for both providers (0-2 range)

## Extension Structure

### Commands
- `extension.ai-commit` - Main command triggered via SCM UI button
- `ai-commit.showAvailableModels` - Lists available OpenAI models

### Build System
- **Webpack** - Bundles TypeScript to single `dist/extension.js`
- **Target**: Node.js environment with vscode module exclusion
- **TypeScript**: ES2020 → CommonJS compilation

### Dependencies
- `simple-git` - Git operations
- `openai` - OpenAI API client
- `@google/generative-ai` - Gemini API client
- `fs-extra` - File system utilities

## Development Workflow

1. Clone repository and run `npm install`
2. Open in VS Code and press `F5` to launch development host
3. Test changes in the Extension Development Host window
4. Run `npm run lint` to check code quality
5. Use `npm run build` for production builds
6. Package with `npm run package` for distribution

## Testing

- Extension tests run via `npm run test`
- Requires compilation of tests with `npm run compile-tests`
- Test files expected in `out/test/` directory
- Node version requirement: >= 16