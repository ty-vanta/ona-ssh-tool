# Gitpod SSH Tool

An interactive CLI tool for Gitpod environments, inspired by GitHub Codespaces `gh cs` functionality.

## Features

- Lists all your Gitpod environments interactively 
- Shows visual status indicator (🟢 running, ⚪ stopped)
- Automatically starts stopped environments before connecting
- Allows you to select an environment from the list
- **SSH**: Connect to environments via SSH
- **Code**: Open VS Code or Cursor directly into remote environments

## Prerequisites

- Node.js (v16 or higher recommended)
- Gitpod CLI installed and configured
- SSH access to Gitpod environments
- For the `code` command: VS Code or Cursor with Remote-SSH extension

## Installation

1. Install dependencies:

```bash
npm install
```

2. Make the script globally available (optional):

```bash
npm link
```

## Usage

### SSH into an environment (default)

```bash
gitpod-ssh ssh
# or simply (backwards compatible):
gitpod-ssh
```

### Open VS Code or Cursor into an environment

```bash
# Auto-detect editor (prefers Cursor if available)
gitpod-ssh code

# Explicitly choose editor
gitpod-ssh code --editor cursor
gitpod-ssh code --editor code

# Specify a custom remote path
gitpod-ssh code --path /workspace/my-project
```

### Command Options

#### `ssh`
SSH into a Gitpod environment interactively.

#### `code`
Open VS Code or Cursor to a Gitpod environment.

| Option | Description | Default |
|--------|-------------|---------|
| `-e, --editor <editor>` | Editor to use (`code` or `cursor`) | Auto-detect |
| `-p, --path <path>` | Remote workspace path | `/workspaces/obsidian` |

### Help

```bash
gitpod-ssh --help
gitpod-ssh code --help
```

## How It Works

### SSH Command
1. Runs `gitpod environment list` to fetch all your environments
2. Parses the output to extract environment information
3. Presents an interactive selection menu with status indicators
4. If the selected environment is stopped, automatically starts it
5. SSHs into the selected environment using: `ssh <environment-id>.gitpod.environment`

### Code Command
1. Fetches and displays environments (same as SSH)
2. Starts the environment if needed
3. Opens VS Code/Cursor with the Remote-SSH extension
4. Connects to: `ssh-remote+<environment-id>.gitpod.environment`

## Example Output

### SSH
```
Fetching Gitpod environments...

? Choose environment: (Use arrow keys)
❯ 🟢 Obsidian [main] (https://github.com/VantaInc/obsidian.git) - abc123

Connecting to: ssh abc123.gitpod.environment
```

### Code
```
Fetching Gitpod environments...

? Choose environment: 
  🟢 Obsidian [main] (https://github.com/VantaInc/obsidian.git) - abc123

Opening Cursor to abc123.gitpod.environment:/workspace...
Cursor is opening. You can close this terminal.
```

## Troubleshooting

### "Neither VS Code nor Cursor CLI found"

Ensure you have the CLI command installed:
- **VS Code**: Open VS Code, press `Cmd+Shift+P`, run "Shell Command: Install 'code' command in PATH"
- **Cursor**: Open Cursor, press `Cmd+Shift+P`, run "Shell Command: Install 'cursor' command in PATH"

### Remote-SSH not working

Ensure you have the Remote-SSH extension installed in VS Code/Cursor:
- VS Code: `ms-vscode-remote.remote-ssh`
- Cursor: Comes pre-installed
