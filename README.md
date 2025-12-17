# Gitpod SSH Tool

An interactive SSH tool for Gitpod environments, inspired by GitHub Codespaces `gh cs ssh` functionality.

## Features

- Lists all your Gitpod environments interactively 
- Shows visual status indicator (🟢 running, ⚪ stopped)
- Automatically starts stopped environments before connecting
- Allows you to select an environment from the list
- Automatically SSHs into the selected environment

## Prerequisites

- Node.js (v16 or higher recommended)
- Gitpod CLI installed and configured
- SSH access to Gitpod environments

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

### Local execution:

```bash
npm start
```

or directly:

```bash
node index.js
```

### After running `npm link`:

```bash
gitpod-ssh
```

## How It Works

1. Runs `gitpod environment list` to fetch all your environments (running and stopped)
2. Parses the output to extract environment information
3. Presents an interactive selection menu with status indicators
4. If the selected environment is stopped, automatically starts it
5. SSHs into the selected environment using the format: `ssh <environment-id>.gitpod.environment`

## Example Output

```
Fetching Gitpod environments...

? Choose environment: (Use arrow keys)
❯ Obsidian [main] (https://github.com/VantaInc/obsidian.git) - <id>

Connecting to: ssh <id>.gitpod.environment
```

