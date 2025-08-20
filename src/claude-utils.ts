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

/**
 * Generates multiple commit messages using Claude API with different strategies.
 * @param {string} prompt - The system prompt for commit message generation
 * @param {string} diff - The git diff to analyze
 * @param {number} count - Number of suggestions to generate
 * @param {string} strategy - Strategy for generating multiple suggestions
 * @returns {Promise<string[]>} Array of generated commit messages
 */
export async function generateMultipleCommitsWithClaude(
  prompt: string, 
  diff: string, 
  count: number = 3, 
  strategy: 'temperature' | 'style' | 'single_request' = 'temperature'
): Promise<string[]> {
  const claude = createClaudeClient();
  const configManager = ConfigurationManager.getInstance();
  
  const model = configManager.getConfig<string>('CLAUDE_MODEL', 'claude-3-5-sonnet-20241022');
  const maxTokens = configManager.getConfig<number>('CLAUDE_MAX_TOKENS', 1024);

  try {
    if (strategy === 'single_request') {
      // Single request asking for multiple options
      const multiPrompt = `${prompt}

Please generate ${count} different commit message options for the following changes. Each should be on a separate line numbered 1, 2, 3, etc. Vary the style and approach:
1. A concise version (max 50 characters)
2. A detailed version (with scope and context)
3. ${count > 2 ? 'A technical version (focusing on implementation details)' : ''}

Git diff:
${diff}`;

      const response = await claude.messages.create({
        model: model,
        max_tokens: maxTokens,
        temperature: 0.7,
        system: 'You are a helpful assistant that generates conventional commit messages.',
        messages: [{ role: 'user', content: multiPrompt }]
      });

      const content = response.content[0];
      if (content.type === 'text') {
        // Parse numbered list response
        const lines = content.text.trim().split('\n');
        const commitMessages = lines
          .filter(line => /^\d+\./.test(line.trim()))
          .map(line => line.replace(/^\d+\.\s*/, '').trim())
          .slice(0, count);
        
        return commitMessages.length >= 2 ? commitMessages : [content.text.trim()];
      }
    } else if (strategy === 'temperature') {
      // Multiple requests with different temperatures
      const temperatures = [0.3, 0.7, 0.9].slice(0, count);
      const requests = temperatures.map(temp => 
        claude.messages.create({
          model: model,
          max_tokens: maxTokens,
          temperature: temp,
          system: prompt,
          messages: [{ role: 'user', content: `Please analyze the following git diff and generate a commit message:\n\n${diff}` }]
        })
      );

      const responses = await Promise.all(requests);
      return responses.map(response => {
        const content = response.content[0];
        return content.type === 'text' ? content.text.trim() : 'Error generating message';
      });
    } else if (strategy === 'style') {
      // Multiple requests with different styles
      const styles = [
        'Generate a concise commit message (max 50 characters)',
        'Generate a detailed commit message with scope and context',
        'Generate a technical commit message focusing on implementation details'
      ].slice(0, count);

      const requests = styles.map(stylePrompt => 
        claude.messages.create({
          model: model,
          max_tokens: maxTokens,
          temperature: 0.7,
          system: `${prompt}\n\nAdditional instruction: ${stylePrompt}`,
          messages: [{ role: 'user', content: `Please analyze the following git diff and generate a commit message:\n\n${diff}` }]
        })
      );

      const responses = await Promise.all(requests);
      return responses.map(response => {
        const content = response.content[0];
        return content.type === 'text' ? content.text.trim() : 'Error generating message';
      });
    }

    // Fallback to single generation
    const singleMessage = await generateCommitWithClaude(prompt, diff);
    return [singleMessage];

  } catch (error: any) {
    console.error('Claude Multiple Generation Error:', error);
    // Fallback to single generation on error
    try {
      const singleMessage = await generateCommitWithClaude(prompt, diff);
      return [singleMessage];
    } catch (fallbackError) {
      throw error; // Throw original error
    }
  }
}