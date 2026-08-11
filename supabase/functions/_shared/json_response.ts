const JSON_CONTROL_ESCAPES: Record<number, string> = {
  0x08: "\\b",
  0x09: "\\t",
  0x0a: "\\n",
  0x0c: "\\f",
  0x0d: "\\r",
};

function escapeJsonControlCharacter(character: string) {
  const code = character.charCodeAt(0);
  return JSON_CONTROL_ESCAPES[code] ?? `\\u${code.toString(16).padStart(4, "0")}`;
}

/**
 * Gemini sometimes emits literal line breaks or tabs inside JSON string values
 * even when the prompt asks for escaped sequences. Repair only those control
 * characters, preserving the rest of the JSON for the native parser to validate.
 */
export function repairJsonControlCharacters(value: string) {
  let inString = false;
  let escaped = false;
  let result = "";

  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    const code = value.charCodeAt(index);

    if (!inString) {
      result += character;
      if (character === '"') inString = true;
      continue;
    }

    if (escaped) {
      if (code <= 0x1f) {
        // Preserve a literal backslash followed by a control character.
        result += `\\${escapeJsonControlCharacter(character)}`;
      } else {
        result += character;
      }
      escaped = false;
      continue;
    }

    if (character === "\\") {
      result += character;
      escaped = true;
      continue;
    }

    if (character === '"') {
      result += character;
      inString = false;
      continue;
    }

    result += code <= 0x1f ? escapeJsonControlCharacter(character) : character;
  }

  return result;
}

function parseCandidate(value: string) {
  try {
    return JSON.parse(value);
  } catch (error) {
    const repaired = repairJsonControlCharacters(value);
    if (repaired === value) throw error;
    return JSON.parse(repaired);
  }
}

export function parseJsonResponse(value: string) {
  const withoutFence = value
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  try {
    return parseCandidate(withoutFence);
  } catch (error) {
    const start = withoutFence.indexOf("{");
    const end = withoutFence.lastIndexOf("}");
    if (start < 0 || end <= start) {
      throw new Error("A resposta da IA não é um JSON válido.");
    }

    try {
      return parseCandidate(withoutFence.slice(start, end + 1));
    } catch {
      throw error;
    }
  }
}
