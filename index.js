#!/usr/bin/env node

import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import inquirer from 'inquirer';
import { Command } from 'commander';

const execAsync = promisify(exec);

// Constants
const SSH_HOST_SUFFIX = 'gitpod.environment';
const DEFAULT_WORKSPACE_PATH = '/workspaces/obsidian';

/**
 * @typedef {Object} GitpodEnvironment
 * @property {string} id
 * @property {string} repository
 * @property {string} branch
 * @property {string} classId
 * @property {string} phase
 * @property {string} repoName
 * @property {string} displayName
 */

/**
 * Parse the output from `gitpod environment list` command
 * @param {string} output - The raw output from gitpod environment list
 * @returns {GitpodEnvironment[]} Array of parsed environment objects
 */
function parseGitpodEnvironments(output) {
  const lines = output.trim().split('\n');
  
  // Skip the header line
  const envLines = lines.slice(1).filter(line => line.trim());
  
  return envLines.map(line => {
    // Split by whitespace, handling multiple spaces
    const parts = line.trim().split(/\s+/);
    
    if (parts.length < 5) {
      return null;
    }
    
    // The format is: ID REPOSITORY BRANCH CLASS PHASE
    const id = parts[0];
    const repository = parts[1];
    const branch = parts[2];
    const classId = parts[3];
    const phase = parts[4];
    
    // Extract repo name from URL for display
    const repoMatch = repository.match(/\/([^\/]+)\.git$/);
    const repoName = repoMatch ? repoMatch[1] : repository;
    
    return {
      id,
      repository,
      branch,
      classId,
      phase,
      repoName,
      // Create a display name similar to GitHub Codespaces format
      displayName: `${repoName} [${branch}]`
    };
  }).filter(Boolean);
}

/**
 * Fetch list of Gitpod environments
 * @returns {Promise<GitpodEnvironment[]>} Array of environment objects
 */
async function getGitpodEnvironments() {
  try {
    const { stdout, stderr } = await execAsync('gitpod environment list');
    
    if (stderr && !stdout) {
      throw new Error(`Error running gitpod command: ${stderr}`);
    }
    
    return parseGitpodEnvironments(stdout);
  } catch (error) {
    if (error.code === 'ENOENT' || error.message.includes('command not found')) {
      throw new Error('gitpod CLI not found. Please install it first.');
    }
    throw error;
  }
}

/**
 * Start a Gitpod environment and wait for it to be running
 * @param {string} environmentId - The ID of the Gitpod environment
 * @returns {Promise<void>}
 */
async function startEnvironment(environmentId) {
  console.log(`\nStarting environment ${environmentId}...`);
  
  try {
    const { stdout, stderr } = await execAsync(`gitpod environment start ${environmentId}`);
    
    if (stderr && stderr.includes('error')) {
      throw new Error(`Failed to start environment: ${stderr}`);
    }
    
    console.log('Environment started successfully!\n');
  } catch (error) {
    throw new Error(`Failed to start environment: ${error.message}`);
  }
}

/**
 * Get SSH host string for an environment
 * @param {string} environmentId - The environment ID
 * @returns {string} The SSH host string
 */
function getSshHost(environmentId) {
  return `${environmentId}.${SSH_HOST_SUFFIX}`;
}

/**
 * Prompt user to select an environment
 * @param {GitpodEnvironment[]} environments - List of environments
 * @returns {Promise<GitpodEnvironment>} The selected environment
 */
async function promptForEnvironment(environments) {
  const choices = environments.map(env => {
    const statusEmoji = env.phase.toLowerCase() === 'running' ? '🟢' : '⚪';
    return {
      name: `${statusEmoji} ${env.displayName} (${env.repository}) - ${env.id}`,
      value: env.id,
      short: env.repoName,
      phase: env.phase
    };
  });
  
  const answers = await inquirer.prompt([
    {
      type: 'list',
      name: 'environmentId',
      message: 'Choose environment:',
      choices: choices,
      pageSize: 10
    }
  ]);
  
  return environments.find(env => env.id === answers.environmentId);
}

/**
 * Ensure environment is running, starting it if necessary
 * @param {GitpodEnvironment} environment - The environment
 * @returns {Promise<void>}
 */
async function ensureEnvironmentRunning(environment) {
  if (environment.phase.toLowerCase() !== 'running') {
    await startEnvironment(environment.id);
  }
}

/**
 * SSH into a Gitpod environment
 * @param {string} environmentId - The ID of the Gitpod environment
 */
function sshIntoGitpod(environmentId) {
  const sshHost = getSshHost(environmentId);
  
  console.log(`Connecting to: ssh ${sshHost}\n`);
  
  // Use spawn with stdio inheritance to allow interactive SSH session
  const sshProcess = spawn('ssh', [sshHost], {
    stdio: 'inherit'
  });
  
  sshProcess.on('error', (error) => {
    console.error(`Error executing SSH: ${error.message}`);
    process.exit(1);
  });
  
  sshProcess.on('exit', (code) => {
    process.exit(code || 0);
  });
}

/**
 * Check if an editor command is available
 * @param {string} command - The command to check
 * @returns {Promise<boolean>}
 */
async function isCommandAvailable(command) {
  try {
    await execAsync(`which ${command}`);
    return true;
  } catch {
    return false;
  }
}

/**
 * Detect which editor the user has available
 * @returns {Promise<'cursor' | 'code' | null>}
 */
async function detectEditor() {
  // Prefer Cursor if available
  if (await isCommandAvailable('cursor')) {
    return 'cursor';
  }
  if (await isCommandAvailable('code')) {
    return 'code';
  }
  return null;
}

/**
 * Open VS Code or Cursor to a remote environment
 * @param {string} environmentId - The environment ID
 * @param {Object} options - Options
 * @param {string} [options.editor] - Editor to use ('code' or 'cursor')
 * @param {string} [options.workspacePath] - Remote workspace path
 */
async function openInEditor(environmentId, options = {}) {
  const sshHost = getSshHost(environmentId);
  
  // Determine which editor to use
  let editorCommand = options.editor;
  
  if (!editorCommand) {
    editorCommand = await detectEditor();
    if (!editorCommand) {
      throw new Error(
        'Neither VS Code nor Cursor CLI found. Please install one of them:\n' +
        '  - VS Code: Install and run "Shell Command: Install \'code\' command in PATH"\n' +
        '  - Cursor: Install and run "Shell Command: Install \'cursor\' command in PATH"'
      );
    }
  }
  
  // Verify the requested editor is available
  if (!(await isCommandAvailable(editorCommand))) {
    throw new Error(
      `${editorCommand} command not found. Please ensure it's installed and in your PATH.\n` +
      `Run "Shell Command: Install '${editorCommand}' command in PATH" from the command palette.`
    );
  }
  
  const workspacePath = options.workspacePath || DEFAULT_WORKSPACE_PATH;
  const editorDisplayName = editorCommand === 'cursor' ? 'Cursor' : 'VS Code';
  
  console.log(`Opening ${editorDisplayName} to ${sshHost}:${workspacePath}...`);
  
  // Use the --remote flag with ssh-remote+ prefix
  // Format: editor --remote ssh-remote+<host> <path>
  const remoteArg = `ssh-remote+${sshHost}`;
  
  try {
    // Spawn the editor process detached so it doesn't block the terminal
    const editorProcess = spawn(editorCommand, ['--remote', remoteArg, workspacePath], {
      detached: true,
      stdio: 'ignore'
    });
    
    editorProcess.unref();
    
    console.log(`${editorDisplayName} is opening. You can close this terminal.`);
  } catch (error) {
    throw new Error(`Failed to open ${editorDisplayName}: ${error.message}`);
  }
}

/**
 * Handle the SSH command
 */
async function handleSshCommand() {
  try {
    console.log('Fetching Gitpod environments...\n');
    
    const environments = await getGitpodEnvironments();
    
    if (environments.length === 0) {
      console.log('No Gitpod environments found.');
      process.exit(0);
    }
    
    const selectedEnv = await promptForEnvironment(environments);
    await ensureEnvironmentRunning(selectedEnv);
    sshIntoGitpod(selectedEnv.id);
    
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

/**
 * Handle the code command
 * @param {Object} options - Command options
 */
async function handleCodeCommand(options) {
  try {
    console.log('Fetching Gitpod environments...\n');
    
    const environments = await getGitpodEnvironments();
    
    if (environments.length === 0) {
      console.log('No Gitpod environments found.');
      process.exit(0);
    }
    
    const selectedEnv = await promptForEnvironment(environments);
    await ensureEnvironmentRunning(selectedEnv);
    
    await openInEditor(selectedEnv.id, {
      editor: options.editor,
      workspacePath: options.path
    });
    
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

// CLI Setup
const program = new Command();

program
  .name('gitpod-ssh')
  .description('Interactive tool for connecting to Gitpod environments')
  .version('1.1.0');

program
  .command('ssh')
  .description('SSH into a Gitpod environment')
  .action(handleSshCommand);

program
  .command('code')
  .description('Open VS Code or Cursor to a Gitpod environment')
  .option('-e, --editor <editor>', 'Editor to use (code or cursor)')
  .option('-p, --path <path>', 'Remote workspace path', DEFAULT_WORKSPACE_PATH)
  .action(handleCodeCommand);

// Default to SSH if no command is provided (maintain backwards compatibility)
program
  .action(handleSshCommand);

program.parse();