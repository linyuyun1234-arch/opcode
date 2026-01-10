# Opcode Development Roadmap & Todos

## ✅ Phase 1: SDK Foundation (Completed)

- [x] **SDK Setup**: Install `@anthropic-ai/claude-agent-sdk`.
- [x] **Architecture**: Move from `claude` CLI black-box to programmatic `run-agent.ts` sidecar.
- [x] **Streaming**: Implement JSONL streaming pipeline compatible with existing frontend.
- [x] **Integration**: Add `execute_sdk_agent` Rust command and `sdk:` model prefix support.
- [x] **Cleanup**: Remove deprecated UI panels (Right SplitPane) for cleaner experience.

## 🚧 Phase 2: Core Capabilities (Completed)

The goal is to make the Agent smarter and more aware of the project context.

- [x] **Custom Tools (MCP) Integration** (Completed)

  - [x] Implement `get_system_info` tool (System data).
  - [x] Implement `get_project_context` tool (File structure & config).
  - [x] **Permissions**: Enabled `bypassPermissions` to preventing UI blocking.

- [x] **Structured Output** (Completed)

  - [x] Implement `submit_completion` tool for structured summaries.
  - [x] Integrated into `run-agent.ts` workflow.

- [x] **Session Management** (Completed)
  - [x] Backend support (run-agent.ts + Rust command).
  - [x] Frontend integration (Updated API & Session Component).

## 🔭 Phase 3: Deep Integration (Future)

- [ ] **Editor Control**: Allow Agent to open/close tabs and highlight code in the IDE.
- [ ] **Bi-directional Sync**: When user edits file, Agent receives immediate updates.
- [ ] **Auto-Fix Loop**: Parse lint/build errors and auto-feed them back to Agent.

## 🎨 Phase 4: UX Polish

- [ ] **Settings UI**: Allow configuring Model (Sonnet/Opus) and Temperature via UI.
- [ ] **Permissions Dashboard**: UI to approve/deny Agent tool usage requests.
