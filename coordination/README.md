# Coordination Folder

This folder contains status files for multi-agent orchestration.

## Purpose

Multiple AI agents work in parallel on different parts of the Release 0.2.0 plan. They communicate progress and blockers through JSON files in this folder.

## Files

- `status.json` - Main coordination status (Coordinator Agent)
- `backend-status.json` - Backend development status
- `frontend-status.json` - Frontend development status
- `infra-status.json` - Infrastructure changes status
- `testing-status.json` - Testing and documentation status
- `blockers.json` - List of blockers between agents

## Status File Format

```json
{
  "agent": "agent_name",
  "status": "pending|in_progress|completed|blocked",
  "current_task": "task_id",
  "completed_tasks": ["task1", "task2"],
  "blocked_by": ["other_agent"],
  "provides_for": ["dependent_agent1", "dependent_agent2"],
  "last_update": "2026-01-14T10:30:00Z",
  "notes": "Current status notes"
}
```

## Agents

1. **Coordinator Agent** - Main orchestration (you are here)
2. **Backend Agent** - Rust backend, MQTT integration
3. **Frontend Agent** - React UI, MQTT Monitor
4. **Infrastructure Agent** - Scripts, installer, versioning
5. **Testing Agent** - Tests and documentation

## Workflow

1. Each agent updates their status file after completing tasks
2. Coordinator monitors all status files
3. Agents check dependencies before starting new tasks
4. Blockers are logged in blockers.json
5. Coordinator resolves conflicts and coordinates final release
