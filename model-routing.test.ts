import { describe, expect, test } from 'bun:test';
import { needsResponsesAPI, unproxiedModelMessage } from './model-routing';

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

describe('unproxiedModelMessage', () => {
    test('accepts prefixed proxy models', () => {
        for (const model of ['cus-gpt-6.1-sol', 'cus-claude-haiku-4-5']) {
            expect(unproxiedModelMessage(model, 'cus-')).toBeNull();
        }
    });

    test('rejects Cursor GPT and Grok models with toggle guidance', () => {
        for (const model of ['gpt-5.6', 'grok-4']) {
            const message = unproxiedModelMessage(model, 'cus-');
            expect(message).toContain(`"${model}"`);
            expect(message).toContain('Use OpenAI API Key');
        }
    });

    test('rejects a missing model', () => {
        expect(unproxiedModelMessage(undefined, 'cus-')).toContain('"(none)"');
    });
});
