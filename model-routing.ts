export function needsResponsesAPI(model: string): boolean {
    // gpt-5.2+ (including -codex and -luna suffixes), gpt-6+, o-series, goldeneye.
    // gpt-5-mini and older GPT models stay on /chat/completions.
    return /^(?:gpt-5\.(?:[2-9]|\d{2,})(?:-codex)?|gpt-(?:[6-9]|\d{2,})(?:\.\d+)?|o\d+|goldeneye)/i.test(model);
}

// Cursor's "Use OpenAI API Key" toggle sends every model not starting with claude-/gemini-
// to the override base URL, including Cursor's own GPT/Grok models. Copilot cannot serve
// those, so reject them with an actionable message instead of an opaque upstream 400.
export function unproxiedModelMessage(model: unknown, prefix: string): string | null {
    if (typeof model === 'string' && model.startsWith(prefix)) return null;
    const name = typeof model === 'string' && model ? model : '(none)';
    return `Model "${name}" is not a Copilot proxy model (no "${prefix}" prefix). `
        + `Cursor sent it here because "Use OpenAI API Key" is on. `
        + `Turn that toggle off in Cursor Settings → Models to use Cursor's own model, or pick a ${prefix}* model.`;
}
