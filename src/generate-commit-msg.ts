import * as fs from 'fs-extra';
import { ChatCompletionMessageParam } from 'openai/resources';
import * as vscode from 'vscode';
import { ConfigKeys, ConfigurationManager } from './config';
import { getDiffStaged, getDiffByMode } from './git-utils';
import { ChatGPTAPI } from './openai-utils';
import { getMainCommitPrompt } from './prompts';
import { ProgressHandler } from './utils';
import { GeminiAPI, generateMultipleCommitsWithGemini } from './gemini-utils';
import { generateCommitWithClaude, generateMultipleCommitsWithClaude } from './claude-utils';
import { generateMultipleCommitsWithOpenAI } from './openai-utils';

/**
 * Generates a chat completion prompt for the commit message based on the provided diff.
 *
 * @param {string} diff - The diff string representing changes to be committed.
 * @param {string} additionalContext - Additional context for the changes.
 * @returns {Promise<Array<{ role: string, content: string }>>} - A promise that resolves to an array of messages for the chat completion.
 */
const generateCommitMessageChatCompletionPrompt = async (
  diff: string,
  additionalContext?: string
) => {
  const INIT_MESSAGES_PROMPT = await getMainCommitPrompt();
  const chatContextAsCompletionRequest = [...INIT_MESSAGES_PROMPT];

  if (additionalContext) {
    chatContextAsCompletionRequest.push({
      role: 'user',
      content: `Additional context for the changes:\n${additionalContext}`
    });
  }

  chatContextAsCompletionRequest.push({
    role: 'user',
    content: diff
  });
  return chatContextAsCompletionRequest;
};

/**
 * Retrieves the repository associated with the provided argument.
 *
 * @param {any} arg - The input argument containing the root URI of the repository.
 * @returns {Promise<vscode.SourceControlRepository>} - A promise that resolves to the repository object.
 */
export async function getRepo(arg) {
  const gitApi = vscode.extensions.getExtension('vscode.git')?.exports.getAPI(1);
  if (!gitApi) {
    throw new Error('Git extension not found');
  }

  if (typeof arg === 'object' && arg.rootUri) {
    const resourceUri = arg.rootUri;
    const realResourcePath: string = fs.realpathSync(resourceUri!.fsPath);
    for (let i = 0; i < gitApi.repositories.length; i++) {
      const repo = gitApi.repositories[i];
      if (realResourcePath.startsWith(repo.rootUri.fsPath)) {
        return repo;
      }
    }
  }
  return gitApi.repositories[0];
}

/**
 * Generates a commit message based on the changes staged in the repository.
 *
 * @param {any} arg - The input argument containing the root URI of the repository.
 * @returns {Promise<void>} - A promise that resolves when the commit message has been generated and set in the SCM input box.
 */
export async function generateCommitMsg(arg) {
  return ProgressHandler.withProgress('', async (progress) => {
    try {
      const configManager = ConfigurationManager.getInstance();
      const repo = await getRepo(arg);

      const aiProvider = configManager.getConfig<string>(ConfigKeys.AI_PROVIDER, 'openai');
      const diffMode = configManager.getConfig<string>(ConfigKeys.DIFF_MODE, 'staged') as 'staged' | 'unstaged' | 'all';
      const multipleSuggestions = configManager.getConfig<boolean>(ConfigKeys.MULTIPLE_SUGGESTIONS, false);
      const suggestionCount = configManager.getConfig<number>(ConfigKeys.SUGGESTION_COUNT, 3);
      const suggestionStrategy = configManager.getConfig<string>(ConfigKeys.SUGGESTION_STRATEGY, 'temperature') as 'temperature' | 'style' | 'single_request';

      // Get appropriate diff based on mode
      let progressMessage = 'Getting changes...';
      let noChangesMessage = 'No changes found';
      
      switch (diffMode) {
        case 'staged':
          progressMessage = 'Getting staged changes...';
          noChangesMessage = 'No changes staged for commit';
          break;
        case 'unstaged':
          progressMessage = 'Getting unstaged changes...';
          noChangesMessage = 'No unstaged changes found';
          break;
        case 'all':
          progressMessage = 'Getting all changes (staged + unstaged)...';
          noChangesMessage = 'No changes found';
          break;
      }

      progress.report({ message: progressMessage });
      const { diff, error } = await getDiffByMode(repo, diffMode);

      if (error) {
        throw new Error(`Failed to get ${diffMode} changes: ${error}`);
      }

      if (!diff || diff.includes('No changes') || diff.trim() === '') {
        throw new Error(noChangesMessage);
      }

      const scmInputBox = repo.inputBox;
      if (!scmInputBox) {
        throw new Error('Unable to find the SCM input box');
      }

      const additionalContext = scmInputBox.value.trim();

      progress.report({
        message: additionalContext
          ? `Analyzing ${diffMode} changes with additional context...`
          : `Analyzing ${diffMode} changes...`
      });
      const messages = await generateCommitMessageChatCompletionPrompt(
        diff,
        additionalContext
      );

      const generateMessage = multipleSuggestions 
        ? `Generating ${suggestionCount} commit message options for ${diffMode} changes...`
        : `Generating commit message for ${diffMode} changes...`;
      
      progress.report({
        message: additionalContext
          ? `${generateMessage} (with additional context)`
          : generateMessage
      });
      try {
        let commitMessage: string | undefined;

        if (multipleSuggestions) {
          // Generate multiple suggestions
          let commitSuggestions: string[] = [];

          if (aiProvider === 'gemini') {
            const geminiApiKey = configManager.getConfig<string>(ConfigKeys.GEMINI_API_KEY);
            if (!geminiApiKey) {
              throw new Error('Gemini API Key not configured');
            }
            commitSuggestions = await generateMultipleCommitsWithGemini(messages, suggestionCount, suggestionStrategy);
          } else if (aiProvider === 'claude') {
            const claudeApiKey = configManager.getConfig<string>(ConfigKeys.CLAUDE_API_KEY);
            if (!claudeApiKey) {
              throw new Error('Claude API Key not configured');
            }
            const systemPrompt = messages.map(m => m.content).join('\n');
            commitSuggestions = await generateMultipleCommitsWithClaude(systemPrompt, diff, suggestionCount, suggestionStrategy);
          } else {
            const openaiApiKey = configManager.getConfig<string>(ConfigKeys.OPENAI_API_KEY);
            if (!openaiApiKey) {
              throw new Error('OpenAI API Key not configured');
            }
            commitSuggestions = await generateMultipleCommitsWithOpenAI(messages as ChatCompletionMessageParam[], suggestionCount, suggestionStrategy);
          }

          // Show QuickPick for user selection
          if (commitSuggestions.length > 1) {
            progress.report({ message: 'Please select your preferred commit message...' });
            
            const quickPickItems = commitSuggestions.map((suggestion, index) => {
              const lines = suggestion.split('\n');
              const title = lines[0];
              const body = lines.slice(1).join('\n').trim();
              
              return {
                label: title,
                description: `Option ${index + 1}`,
                detail: body || undefined,
                commitMessage: suggestion
              };
            });

            const selected = await vscode.window.showQuickPick(quickPickItems, {
              placeHolder: `Choose your preferred commit message (${aiProvider} ${suggestionStrategy})`,
              matchOnDescription: true,
              matchOnDetail: true,
              ignoreFocusOut: false
            });

            if (selected) {
              commitMessage = selected.commitMessage;
            } else {
              // User cancelled selection, use first suggestion as fallback
              commitMessage = commitSuggestions[0];
            }
          } else {
            // Fallback to first suggestion if generation failed
            commitMessage = commitSuggestions[0] || 'Error: No commit messages generated';
          }
        } else {
          // Generate single suggestion (existing logic)
          if (aiProvider === 'gemini') {
            const geminiApiKey = configManager.getConfig<string>(ConfigKeys.GEMINI_API_KEY);
            if (!geminiApiKey) {
              throw new Error('Gemini API Key not configured');
            }
            commitMessage = await GeminiAPI(messages);
          } else if (aiProvider === 'claude') {
            const claudeApiKey = configManager.getConfig<string>(ConfigKeys.CLAUDE_API_KEY);
            if (!claudeApiKey) {
              throw new Error('Claude API Key not configured');
            }
            const systemPrompt = messages.map(m => m.content).join('\n');
            commitMessage = await generateCommitWithClaude(systemPrompt, diff);
          } else {
            const openaiApiKey = configManager.getConfig<string>(ConfigKeys.OPENAI_API_KEY);
            if (!openaiApiKey) {
              throw new Error('OpenAI API Key not configured');
            }
            commitMessage = await ChatGPTAPI(messages as ChatCompletionMessageParam[]);
          }
        }

        if (commitMessage) {
          scmInputBox.value = commitMessage;
        } else {
          throw new Error('Failed to generate commit message');
        }
      } catch (err) {
        let errorMessage = 'An unexpected error occurred';

        if (aiProvider === 'openai' && err.response?.status) {
          switch (err.response.status) {
            case 401:
              errorMessage = 'Invalid OpenAI API key or unauthorized access';
              break;
            case 429:
              errorMessage = 'Rate limit exceeded. Please try again later';
              break;
            case 500:
              errorMessage = 'OpenAI server error. Please try again later';
              break;
            case 503:
              errorMessage = 'OpenAI service is temporarily unavailable';
              break;
          }
        } else if (aiProvider === 'gemini') {
          errorMessage = `Gemini API error: ${err.message}`;
        } else if (aiProvider === 'claude') {
          errorMessage = `Claude API error: ${err.message}`;
        }

        throw new Error(errorMessage);
      }
    } catch (error) {
      throw error;
    }
  });
}
