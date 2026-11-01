export function needsResponsesAPI(model: string): boolean {
    // gpt-5.2+ (including -codex and -luna suffixes), gpt-6+, o-series, goldeneye.
    // gpt-5-mini and older GPT models stay on /chat/completions.
    return /^(?:gpt-5\.(?:[2-9]|\d{2,})(?:-codex)?|gpt-(?:[6-9]|\d{2,})(?:\.\d+)?|o\d+|goldeneye)/i.test(model);
}
