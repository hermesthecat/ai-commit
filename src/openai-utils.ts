import OpenAI from 'openai';
import { ChatCompletionMessageParam } from 'openai/resources';
import { ConfigKeys, ConfigurationManager } from './config';

/**
 * Creates and returns an OpenAI configuration object.
 * @returns {Object} - The OpenAI configuration object.
 * @throws {Error} - Throws an error if the API key is missing or empty.
 */
function getOpenAIConfig() {
  const configManager = ConfigurationManager.getInstance();
  const apiKey = configManager.getConfig<string>(ConfigKeys.OPENAI_API_KEY);
  const baseURL = configManager.getConfig<string>(ConfigKeys.OPENAI_BASE_URL);
  const apiVersion = configManager.getConfig<string>(ConfigKeys.AZURE_API_VERSION);

  if (!apiKey) {
    throw new Error('The OPENAI_API_KEY environment variable is missing or empty.');
  }

  const config: {
    apiKey: string;
    baseURL?: string;
    defaultQuery?: { 'api-version': string };
    defaultHeaders?: { 'api-key': string };
  } = {
    apiKey
  };

  if (baseURL) {
    config.baseURL = baseURL;
    if (apiVersion) {
      config.defaultQuery = { 'api-version': apiVersion };
      config.defaultHeaders = { 'api-key': apiKey };
    }
  }

  return config;
}

/**
 * Creates and returns an OpenAI API instance.
 * @returns {OpenAI} - The OpenAI API instance.
 */
export function createOpenAIApi() {
  const config = getOpenAIConfig();
  return new OpenAI(config);
}

/**
 * Sends a chat completion request to the OpenAI API.
 * @param {Array<Object>} messages - The messages to send to the API.
 * @returns {Promise<string>} - A promise that resolves to the API response.
 */
export async function ChatGPTAPI(messages: ChatCompletionMessageParam[]) {
  const openai = createOpenAIApi();
  const configManager = ConfigurationManager.getInstance();
  const model = configManager.getConfig<string>(ConfigKeys.OPENAI_MODEL);
  const temperature = configManager.getConfig<number>(ConfigKeys.OPENAI_TEMPERATURE, 0.7);

  const completion = await openai.chat.completions.create({
    model,
    messages: messages as ChatCompletionMessageParam[],
    temperature
  });

  return completion.choices[0]!.message?.content;
}

/**
 * Generates multiple commit messages using OpenAI API with different strategies.
 * @param {ChatCompletionMessageParam[]} messages - The messages to send to the API
 * @param {number} count - Number of suggestions to generate
 * @param {string} strategy - Strategy for generating multiple suggestions
 * @returns {Promise<string[]>} Array of generated commit messages
 */
export async function generateMultipleCommitsWithOpenAI(
  messages: ChatCompletionMessageParam[], 
  count: number = 3, 
  strategy: 'temperature' | 'style' | 'single_request' = 'temperature'
): Promise<string[]> {
  const openai = createOpenAIApi();
  const configManager = ConfigurationManager.getInstance();
  const model = configManager.getConfig<string>(ConfigKeys.OPENAI_MODEL);

  try {
    if (strategy === 'single_request') {
      // Single request asking for multiple options
      const multiMessages = [...messages];
      const lastMessage = multiMessages[multiMessages.length - 1];
      
      multiMessages[multiMessages.length - 1] = {
        ...lastMessage,
        content: `${lastMessage.content}

Please generate ${count} different commit message options. Each should be on a separate line numbered 1, 2, 3, etc. Vary the style and approach:
1. A concise version (max 50 characters)
2. A detailed version (with scope and context)
${count > 2 ? '3. A technical version (focusing on implementation details)' : ''}`
      };

      const completion = await openai.chat.completions.create({
        model,
        messages: multiMessages,
        temperature: 0.7
      });

      const response = completion.choices[0]!.message?.content || '';
      
      // Parse numbered list response
      const lines = response.trim().split('\n');
      const commitMessages = lines
        .filter(line => /^\d+\./.test(line.trim()))
        .map(line => line.replace(/^\d+\.\s*/, '').trim())
        .slice(0, count);
      
      return commitMessages.length >= 2 ? commitMessages : [response.trim()];
      
    } else if (strategy === 'temperature') {
      // Multiple requests with different temperatures
      const temperatures = [0.3, 0.7, 0.9].slice(0, count);
      const requests = temperatures.map(temp => 
        openai.chat.completions.create({
          model,
          messages: messages,
          temperature: temp
        })
      );

      const responses = await Promise.all(requests);
      return responses.map(response => 
        response.choices[0]!.message?.content?.trim() || 'Error generating message'
      );
      
    } else if (strategy === 'style') {
      // Multiple requests with different styles
      const styles = [
        'Generate a concise commit message (max 50 characters)',
        'Generate a detailed commit message with scope and context',
        'Generate a technical commit message focusing on implementation details'
      ].slice(0, count);

      const requests = styles.map(styleInstruction => {
        const styledMessages = [...messages];
        // Add style instruction to system message or create new one
        const systemMessage = styledMessages.find(m => m.role === 'system');
        if (systemMessage) {
          systemMessage.content = `${systemMessage.content}\n\nAdditional instruction: ${styleInstruction}`;
        } else {
          styledMessages.unshift({
            role: 'system',
            content: styleInstruction
          });
        }
        
        return openai.chat.completions.create({
          model,
          messages: styledMessages,
          temperature: 0.7
        });
      });

      const responses = await Promise.all(requests);
      return responses.map(response => 
        response.choices[0]!.message?.content?.trim() || 'Error generating message'
      );
    }

    // Fallback to single generation
    const singleMessage = await ChatGPTAPI(messages);
    return [singleMessage || 'Error generating message'];

  } catch (error: any) {
    console.error('OpenAI Multiple Generation Error:', error);
    // Fallback to single generation on error
    try {
      const singleMessage = await ChatGPTAPI(messages);
      return [singleMessage || 'Error generating message'];
    } catch (fallbackError) {
      throw error; // Throw original error
    }
  }
}
