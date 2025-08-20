import Anthropic from '@anthropic-ai/sdk';
import { ConfigurationManager } from './config';

/**
 * Creates and configures an Anthropic Claude API client.
 * @returns {Anthropic} Configured Claude API client
 */
export function createClaudeClient(): Anthropic {
  const configManager = ConfigurationManager.getInstance();
  const apiKey = configManager.getConfig<string>('CLAUDE_API_KEY');
  
  if (!apiKey) {
    throw new Error('Claude API key is not configured. Please set CLAUDE_API_KEY in extension settings.');
  }

  return new Anthropic({
    apiKey: apiKey,
  });
}

/**
 * Generates a commit message using Claude API.
 * @param {string} prompt - The system prompt for commit message generation
 * @param {string} diff - The git diff to analyze
 * @returns {Promise<string>} Generated commit message
 */
export async function generateCommitWithClaude(prompt: string, diff: string): Promise<string> {
  const claude = createClaudeClient();
  const configManager = ConfigurationManager.getInstance();
  
  const model = configManager.getConfig<string>('CLAUDE_MODEL', 'claude-3-5-sonnet-20241022');
  const temperature = configManager.getConfig<number>('CLAUDE_TEMPERATURE', 0.7);
  const maxTokens = configManager.getConfig<number>('CLAUDE_MAX_TOKENS', 1024);

  try {
    const response = await claude.messages.create({
      model: model,
      max_tokens: maxTokens,
      temperature: temperature,
      system: prompt,
      messages: [
        {
          role: 'user',
          content: `Please analyze the following git diff and generate a commit message:\n\n${diff}`
        }
      ]
    });

    // Extract text content from Claude's response
    const content = response.content[0];
    if (content.type === 'text') {
      return content.text.trim();
    } else {
      throw new Error('Unexpected response format from Claude API');
    }

  } catch (error: any) {
    console.error('Claude API Error:', error);
    
    // Handle specific Claude API errors
    if (error?.status === 401) {
      throw new Error('Claude API authentication failed. Please check your API key.');
    } else if (error?.status === 429) {
      throw new Error('Claude API rate limit exceeded. Please try again later.');
    } else if (error?.status === 400) {
      throw new Error('Claude API request was malformed. Please check your configuration.');
    } else if (error?.status >= 500) {
      throw new Error('Claude API server error. Please try again later.');
    } else if (error?.code === 'ENOTFOUND' || error?.code === 'ECONNREFUSED') {
      throw new Error('Network error. Please check your internet connection.');
    } else {
      throw new Error(`Claude API error: ${error?.message || 'Unknown error'}`);
    }
  }
}

/**
 * Gets the list of available Claude models.
 * Note: This is a static list as Claude API doesn't provide a models endpoint.
 * @returns {string[]} List of available Claude models
 */
export function getAvailableClaudeModels(): string[] {
  return [
    'claude-3-5-sonnet-20241022',
    'claude-3-5-haiku-20241022', 
    'claude-3-opus-20240229',
    'claude-3-sonnet-20240229',
    'claude-3-haiku-20240307'
  ];
}

/**
 * Validates if the provided model is supported.
 * @param {string} model - Model name to validate
 * @returns {boolean} True if model is supported
 */
export function isValidClaudeModel(model: string): boolean {
  return getAvailableClaudeModels().includes(model);
}