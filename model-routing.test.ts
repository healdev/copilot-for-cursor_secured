import { describe, expect, test } from 'bun:test';
import { needsResponsesAPI } from './model-routing';

describe('needsResponsesAPI', () => {
    test('routes current Copilot GPT responses models', () => {
        for (const model of ['gpt-5.6-luna', 'gpt-5.3-codex', 'gpt-6.1-sol', 'gpt-6-astra', 'gpt-6-luna', 'gpt-6-sol']) {
            expect(needsResponsesAPI(model)).toBe(true);
        }
    });

    test('leaves chat-completions models alone', () => {
        for (const model of ['gpt-5-mini', 'gpt-4o', 'claude-haiku-4-5', 'claude-sonnet-5']) {
            expect(needsResponsesAPI(model)).toBe(false);
        }
    });
});
