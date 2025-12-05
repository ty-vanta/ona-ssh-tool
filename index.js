#!/usr/bin/env node

import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import inquirer from 'inquirer';

const execAsync = promisify(exec);

/**
 * Parse the output from `gitpod environment list` command
 * @param {string} output - The raw output from gitpod environment list
 * @returns {Array} Array of parsed environment objects
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
    
    // Only include running environments
    if (phase.toLowerCase() !== 'running') {
      return null;
    }
    
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
 * @returns {Promise<Array>} Array of environment objects
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
 * SSH into a Gitpod environment
 * @param {string} environmentId - The ID of the Gitpod environment
 */
function sshIntoGitpod(environmentId) {
  const sshCommand = `ssh ${environmentId}.gitpod.environment`;
  
  console.log(`\nConnecting to: ${sshCommand}\n`);
  
  // Use spawn with stdio inheritance to allow interactive SSH session
  const sshProcess = spawn('ssh', [`${environmentId}.gitpod.environment`], {
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
 * Main function
 */
async function main() {
  try {
    console.log('Fetching Gitpod environments...\n');
    
    const environments = await getGitpodEnvironments();
    
    if (environments.length === 0) {
      console.log('No running Gitpod environments found.');
      process.exit(0);
    }
    
    // Create choices for inquirer
    const choices = environments.map(env => ({
      name: `${env.displayName} (${env.repository}) - ${env.id}`,
      value: env.id,
      short: env.repoName
    }));
    
    // Prompt user to select an environment
    const answers = await inquirer.prompt([
      {
        type: 'list',
        name: 'environmentId',
        message: 'Choose environment:',
        choices: choices,
        pageSize: 10
      }
    ]);
    
    // SSH into the selected environment
    sshIntoGitpod(answers.environmentId);
    
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

main();

