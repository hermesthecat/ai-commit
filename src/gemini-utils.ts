import { GoogleGenerativeAI } from "@google/generative-ai";
import { ConfigKeys, ConfigurationManager } from './config';

/**
 * Creates and returns a Gemini API configuration object.
 * @returns {Object} - The Gemini API configuration object.
 * @throws {Error} - Throws an error if the API key is missing or empty.
 */
function getGeminiConfig() {
  const configManager = ConfigurationManager.getInstance();
  const apiKey = configManager.getConfig<string>(ConfigKeys.GEMINI_API_KEY);

  if (!apiKey) {
    throw new Error('The GEMINI_API_KEY environment variable is missing or empty.');
  }

  const config: {
    apiKey: string;
  } = {
    apiKey
  };

  return config;
}

/**
 * Creates and returns a Gemini API instance.
 * @returns {GoogleGenerativeAI} - The Gemini API instance.
 */
export function createGeminiAPIClient() {
  const config = getGeminiConfig();
  return new GoogleGenerativeAI(config.apiKey);
}

/**
 * Sends a chat completion request to the Gemini API.
 * @param {any[]} messages - The messages to send to the API.
 * @returns {Promise<string>} - A promise that resolves to the API response.
 */
export async function GeminiAPI(messages: any[]) {
  try {
    const gemini = createGeminiAPIClient();
    const configManager = ConfigurationManager.getInstance();
    const modelName = configManager.getConfig<string>(ConfigKeys.GEMINI_MODEL);
    const temperature = configManager.getConfig<number>(ConfigKeys.GEMINI_TEMPERATURE, 0.7);

    const model = gemini.getGenerativeModel({ model: modelName });
    const chat = model.startChat({
      generationConfig: {
        temperature: temperature,
      },
    });

    const result = await chat.sendMessage(messages.map(msg => msg.content));
    const response = result.response;
    const text = response.text();

    return text;

  } catch (error) {
    console.error('Gemini API call failed:', error);
    throw error;
  }
}

/**
 * Generates multiple commit messages using Gemini API with different strategies.
 * @param {any[]} messages - The messages to send to the API
 * @param {number} count - Number of suggestions to generate
 * @param {string} strategy - Strategy for generating multiple suggestions
 * @returns {Promise<string[]>} Array of generated commit messages
 */
export async function generateMultipleCommitsWithGemini(
  messages: any[], 
  count: number = 3, 
  strategy: 'temperature' | 'style' | 'single_request' = 'temperature'
): Promise<string[]> {
  try {
    const gemini = createGeminiAPIClient();
    const configManager = ConfigurationManager.getInstance();
    const modelName = configManager.getConfig<string>(ConfigKeys.GEMINI_MODEL);

    if (strategy === 'single_request') {
      // Single request asking for multiple options
      const multiPrompt = `${messages.map(msg => msg.content).join('\n')}

Please generate ${count} different commit message options. Each should be on a separate line numbered 1, 2, 3, etc. Vary the style and approach:
1. A concise version (max 50 characters)
2. A detailed version (with scope and context)
${count > 2 ? '3. A technical version (focusing on implementation details)' : ''}`;

      const model = gemini.getGenerativeModel({ model: modelName });
      const chat = model.startChat({
        generationConfig: {
          temperature: 0.7,
        },
      });

      const result = await chat.sendMessage(multiPrompt);
      const response = result.response.text();
      
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
      const requests = temperatures.map(temp => {
        const model = gemini.getGenerativeModel({ model: modelName });
        const chat = model.startChat({
          generationConfig: {
            temperature: temp,
          },
        });
        return chat.sendMessage(messages.map(msg => msg.content).join('\n'));
      });

      const responses = await Promise.all(requests);
      return responses.map(response => 
        response.response.text().trim() || 'Error generating message'
      );
      
    } else if (strategy === 'style') {
      // Multiple requests with different styles
      const styles = [
        'Generate a concise commit message (max 50 characters)',
        'Generate a detailed commit message with scope and context',
        'Generate a technical commit message focusing on implementation details'
      ].slice(0, count);

      const requests = styles.map(styleInstruction => {
        const styledPrompt = `${messages.map(msg => msg.content).join('\n')}\n\nAdditional instruction: ${styleInstruction}`;
        
        const model = gemini.getGenerativeModel({ model: modelName });
        const chat = model.startChat({
          generationConfig: {
            temperature: 0.7,
          },
        });
        return chat.sendMessage(styledPrompt);
      });

      const responses = await Promise.all(requests);
      return responses.map(response => 
        response.response.text().trim() || 'Error generating message'
      );
    }

    // Fallback to single generation
    const singleMessage = await GeminiAPI(messages);
    return [singleMessage || 'Error generating message'];

  } catch (error: any) {
    console.error('Gemini Multiple Generation Error:', error);
    // Fallback to single generation on error
    try {
      const singleMessage = await GeminiAPI(messages);
      return [singleMessage || 'Error generating message'];
    } catch (fallbackError) {
      throw error; // Throw original error
    }
  }
}