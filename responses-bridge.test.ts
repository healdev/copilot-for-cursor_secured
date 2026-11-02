import { describe, expect, test } from 'bun:test';

// We test the token-cap logic by importing the bridge and inspecting the
// outgoing request body it builds.  Because handleResponsesAPIBridge calls
// fetch(), we mock globalThis.fetch to capture the request.

import { handleResponsesAPIBridge } from './responses-bridge';

function captureFetch(): { calls: { url: string; body: any }[] } {
    const calls: { url: string; body: any }[] = [];
    const original = globalThis.fetch;
    globalThis.fetch = (async (input: any, init: any) => {
        const body = JSON.parse(init?.body ?? '{}');
        calls.push({ url: String(input), body });
        // Return a minimal successful non-streaming response
        return new Response(JSON.stringify({
            id: 'resp_test',
            object: 'response',
            output: [{ type: 'message', role: 'assistant', content: [{ type: 'output_text', text: 'hi' }] }],
            usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2 },
        }), { status: 200, headers: { 'content-type': 'application/json' } });
    }) as any;
    return { calls };
}

function makeDummyRequest(): Request {
    return new Request('http://localhost:4142/v1/chat/completions', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'authorization': 'Bearer test' },
        body: '{}',
    });
}

describe('responses-bridge token cap', () => {
    test('forwards max_tokens as max_output_tokens', async () => {
        const captured = captureFetch();
        await handleResponsesAPIBridge(
            { model: 'gpt-5.2', max_tokens: 123, messages: [{ role: 'user', content: 'hi' }] },
            makeDummyRequest(), 'chat-1', 'http://localhost:4141',
        );
        expect(captured.calls.length).toBe(1);
        expect(captured.calls[0].body.max_output_tokens).toBe(123);
    });

    test('forwards max_completion_tokens when max_tokens is absent (proxy-router rewrite)', async () => {
        const captured = captureFetch();
        await handleResponsesAPIBridge(
            { model: 'gpt-5.2', max_completion_tokens: 456, messages: [{ role: 'user', content: 'hi' }] },
            makeDummyRequest(), 'chat-2', 'http://localhost:4141',
        );
        expect(captured.calls.length).toBe(1);
        expect(captured.calls[0].body.max_output_tokens).toBe(456);
    });

    test('forwards max_output_tokens directly', async () => {
        const captured = captureFetch();
        await handleResponsesAPIBridge(
            { model: 'o3', max_output_tokens: 789, messages: [{ role: 'user', content: 'hi' }] },
            makeDummyRequest(), 'chat-3', 'http://localhost:4141',
        );
        expect(captured.calls.length).toBe(1);
        expect(captured.calls[0].body.max_output_tokens).toBe(789);
    });

    test('max_output_tokens takes precedence over max_completion_tokens and max_tokens', async () => {
        const captured = captureFetch();
        await handleResponsesAPIBridge(
            { model: 'gpt-5.2', max_output_tokens: 100, max_completion_tokens: 200, max_tokens: 300, messages: [{ role: 'user', content: 'hi' }] },
            makeDummyRequest(), 'chat-4', 'http://localhost:4141',
        );
        expect(captured.calls.length).toBe(1);
        expect(captured.calls[0].body.max_output_tokens).toBe(100);
    });

    test('enforces minimum of 16 tokens', async () => {
        const captured = captureFetch();
        await handleResponsesAPIBridge(
            { model: 'gpt-5.2', max_tokens: 5, messages: [{ role: 'user', content: 'hi' }] },
            makeDummyRequest(), 'chat-5', 'http://localhost:4141',
        );
        expect(captured.calls.length).toBe(1);
        expect(captured.calls[0].body.max_output_tokens).toBe(16);
    });

    test('rewrites function_call.id to fc_ and keeps call_id', async () => {
        const captured = captureFetch();
        await handleResponsesAPIBridge(
            {
                model: 'gpt-5.6-luna',
                messages: [
                    { role: 'user', content: 'hi' },
                    {
                        role: 'assistant',
                        content: '',
                        tool_calls: [{
                            id: 'call_oEPBEKYMxOpwlCLXHQaAaCVj',
                            type: 'function',
                            function: { name: 'Shell', arguments: '{}' },
                        }],
                    },
                    { role: 'tool', tool_call_id: 'call_oEPBEKYMxOpwlCLXHQaAaCVj', content: 'ok' },
                ],
            },
            makeDummyRequest(), 'chat-fc', 'http://localhost:4141',
        );
        const input = captured.calls[0].body.input;
        const call = input.find((item: any) => item.type === 'function_call');
        const output = input.find((item: any) => item.type === 'function_call_output');
        expect(call.id).toBe('fc_oEPBEKYMxOpwlCLXHQaAaCVj');
        expect(call.call_id).toBe('call_oEPBEKYMxOpwlCLXHQaAaCVj');
        expect(output.call_id).toBe('call_oEPBEKYMxOpwlCLXHQaAaCVj');
    });

    test('rewrites toolu_ function_call ids to fc_', async () => {
        const captured = captureFetch();
        await handleResponsesAPIBridge(
            {
                model: 'gpt-6.1-sol',
                messages: [{
                    role: 'assistant',
                    tool_calls: [{
                        id: 'toolu_019sVDXbqVX4qAUQ6FRzVEDe',
                        type: 'function',
                        function: { name: 'Shell', arguments: '{}' },
                    }],
                }],
            },
            makeDummyRequest(), 'chat-toolu', 'http://localhost:4141',
        );
        const call = captured.calls[0].body.input.find((item: any) => item.type === 'function_call');
        expect(call.id).toBe('fc_019sVDXbqVX4qAUQ6FRzVEDe');
        expect(call.call_id).toBe('toolu_019sVDXbqVX4qAUQ6FRzVEDe');
    });

    test('omits max_output_tokens when no token cap is provided', async () => {
        const captured = captureFetch();
        await handleResponsesAPIBridge(
            { model: 'gpt-5.2', messages: [{ role: 'user', content: 'hi' }] },
            makeDummyRequest(), 'chat-6', 'http://localhost:4141',
        );
        expect(captured.calls.length).toBe(1);
        expect(captured.calls[0].body.max_output_tokens).toBeUndefined();
    });
});
