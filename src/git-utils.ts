import simpleGit from 'simple-git';
import * as vscode from 'vscode';

/**
 * Retrieves the staged changes from the Git repository.
 */
export async function getDiffStaged(
  repo: any
): Promise<{ diff: string; error?: string }> {
  try {
    const rootPath =
      repo?.rootUri?.fsPath || vscode.workspace.workspaceFolders?.[0].uri.fsPath;

    if (!rootPath) {
      throw new Error('No workspace folder found');
    }

    const git = simpleGit(rootPath);
    const diff = await git.diff(['--staged']);

    return {
      diff: diff || 'No changes staged.',
      error: null
    };
  } catch (error) {
    console.error('Error reading Git diff:', error);
    return { diff: '', error: error.message };
  }
}

/**
 * Retrieves the unstaged changes from the Git repository.
 */
export async function getDiffUnstaged(
  repo: any
): Promise<{ diff: string; error?: string }> {
  try {
    const rootPath =
      repo?.rootUri?.fsPath || vscode.workspace.workspaceFolders?.[0].uri.fsPath;

    if (!rootPath) {
      throw new Error('No workspace folder found');
    }

    const git = simpleGit(rootPath);
    const diff = await git.diff();

    return {
      diff: diff || 'No unstaged changes.',
      error: null
    };
  } catch (error) {
    console.error('Error reading Git unstaged diff:', error);
    return { diff: '', error: error.message };
  }
}

/**
 * Retrieves both staged and unstaged changes from the Git repository.
 */
export async function getDiffAll(
  repo: any
): Promise<{ diff: string; error?: string }> {
  try {
    const rootPath =
      repo?.rootUri?.fsPath || vscode.workspace.workspaceFolders?.[0].uri.fsPath;

    if (!rootPath) {
      throw new Error('No workspace folder found');
    }

    const git = simpleGit(rootPath);
    const [stagedDiff, unstagedDiff] = await Promise.all([
      git.diff(['--staged']),
      git.diff()
    ]);

    let combinedDiff = '';
    
    if (stagedDiff) {
      combinedDiff += '=== STAGED CHANGES ===\n' + stagedDiff;
    }
    
    if (unstagedDiff) {
      if (combinedDiff) {
        combinedDiff += '\n\n=== UNSTAGED CHANGES ===\n' + unstagedDiff;
      } else {
        combinedDiff = '=== UNSTAGED CHANGES ===\n' + unstagedDiff;
      }
    }

    if (!combinedDiff) {
      combinedDiff = 'No changes found.';
    }

    return {
      diff: combinedDiff,
      error: null
    };
  } catch (error) {
    console.error('Error reading Git all changes:', error);
    return { diff: '', error: error.message };
  }
}

/**
 * Gets diff based on the specified mode.
 */
export async function getDiffByMode(
  repo: any, 
  mode: 'staged' | 'unstaged' | 'all'
): Promise<{ diff: string; error?: string }> {
  switch (mode) {
    case 'staged':
      return getDiffStaged(repo);
    case 'unstaged':
      return getDiffUnstaged(repo);
    case 'all':
      return getDiffAll(repo);
    default:
      return getDiffStaged(repo);
  }
}
