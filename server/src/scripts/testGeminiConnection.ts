import 'dotenv/config';
import { GoogleGenerativeAI } from '@google/generative-ai';

const prompt = 'Reply with exactly: GEMINI_CONNECTION_SUCCESS';
const expectedResponse = 'GEMINI_CONNECTION_SUCCESS';
const apiKey = process.env.GEMINI_API_KEY?.trim();
const modelName = process.env.GEMINI_MODEL?.trim() || 'gemini-3.6-flash';

type ErrorCategory =
  | 'AUTHENTICATION_OR_PERMISSION'
  | 'RATE_LIMIT'
  | 'MODEL_NOT_FOUND'
  | 'INVALID_REQUEST'
  | 'GEMINI_SERVER_ERROR'
  | 'NETWORK_OR_TIMEOUT'
  | 'API_ERROR';

function getHttpStatus(error: unknown): number | undefined {
  if (typeof error === 'object' && error !== null && 'status' in error) {
    const status = error.status;
    if (typeof status === 'number') return status;
  }

  if (error instanceof Error) {
    const match = error.message.match(/\[(\d{3})(?:\s+[^\]]*)?\]/);
    if (match) return Number(match[1]);
  }

  return undefined;
}

function getErrorCategory(error: unknown, status?: number): ErrorCategory {
  if (status === 401 || status === 403) return 'AUTHENTICATION_OR_PERMISSION';
  if (status === 429) return 'RATE_LIMIT';
  if (status === 404) return 'MODEL_NOT_FOUND';
  if (status !== undefined && status >= 400 && status < 500) return 'INVALID_REQUEST';
  if (status !== undefined && status >= 500) return 'GEMINI_SERVER_ERROR';

  if (
    typeof error === 'object' &&
    error !== null &&
    'cause' in error &&
    error.cause instanceof Error
  ) {
    const cause = error.cause;
    if (
      cause.name === 'AbortError' ||
      cause.name === 'TimeoutError' ||
      cause instanceof TypeError
    ) {
      return 'NETWORK_OR_TIMEOUT';
    }
  }

  if (
    error instanceof Error &&
    (error.name === 'AbortError' ||
      error.name === 'TimeoutError' ||
      error instanceof TypeError)
  ) {
    return 'NETWORK_OR_TIMEOUT';
  }

  return 'API_ERROR';
}

async function main(): Promise<void> {
  console.log(`Model: ${modelName}`);

  if (!apiKey) {
    console.error('API status: FAILURE (CONFIGURATION_ERROR: GEMINI_API_KEY is missing or blank)');
    process.exitCode = 1;
    return;
  }

  try {
    const client = new GoogleGenerativeAI(apiKey);
    const model = client.getGenerativeModel({ model: modelName });
    const result = await model.generateContent(prompt);
    const responseText = result.response.text().trim();

    console.log('API status: SUCCESS');
    console.log(`Returned test text: ${responseText || '(empty response)'}`);

    if (responseText !== expectedResponse) {
      console.error('Prompt check: FAILURE (response did not exactly match the requested text)');
      process.exitCode = 1;
      return;
    }

    console.log('Prompt check: SUCCESS');
  } catch (error) {
    const status = getHttpStatus(error);
    const category = getErrorCategory(error, status);
    const statusDescription = status === undefined ? '' : ` (HTTP ${status})`;
    console.error(`API status: FAILURE${statusDescription} (${category})`);
    process.exitCode = 1;
  }
}

void main();
