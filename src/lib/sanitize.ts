// Input sanitization utilities to prevent prompt injection and XSS

/**
 * Remove potentially dangerous patterns from text that could be used
 * for prompt injection attacks against AI models
 */
export function sanitizeForAI(input: string): string {
  if (!input || typeof input !== "string") return "";

  let sanitized = input;

  // Remove common prompt injection patterns
  const injectionPatterns = [
    // Ignore previous instructions patterns
    /ignore\s+(all\s+)?(previous|prior|above)\s+(instructions?|prompts?|rules?)/gi,
    /disregard\s+(all\s+)?(previous|prior|above)\s+(instructions?|prompts?|rules?)/gi,
    /forget\s+(all\s+)?(previous|prior|above)\s+(instructions?|prompts?|rules?)/gi,
    // System prompt manipulation
    /\[?\s*system\s*\]?\s*:/gi,
    /\[?\s*assistant\s*\]?\s*:/gi,
    /\[?\s*user\s*\]?\s*:/gi,
    // Jailbreak attempts
    /do\s+anything\s+now/gi,
    /DAN\s+mode/gi,
    /jailbreak/gi,
    // Role manipulation
    /you\s+are\s+now\s+a/gi,
    /pretend\s+you\s+are/gi,
    /act\s+as\s+if\s+you/gi,
    /roleplay\s+as/gi,
    // AI honeypot traps — "add X as a skill" commands hidden in JDs
    /(?:add|include|list|mention)\s+(?:\w+\s+)*?(?:as\s+a\s+skill|to\s+(?:my\s+)?(?:resume|application)|as\s+(?:my\s+)?experience)/gi,
    /(?:candidate\s+should\s+(?:be\s+able\s+to\s+)?)?(?:mention|include|add)\s+(?:\w+\s+)*?(?:on\s+(?:their\s+)?resume|in\s+(?:their\s+)?(?:application|cover\s+letter))/gi,
    /(?:this\s+is\s+a\s+test|we\s+are\s+testing|hidden\s+requirement|honesty\s+(?:test|check)|check\s+if\s+(?:you\s+)?(?:read|notice|catch))/gi,
    /(?:only\s+(?:apply|candidates)\s+who\s+(?:mention|include|list|add)\s+\w+)/gi,
  ];

  for (const pattern of injectionPatterns) {
    sanitized = sanitized.replace(pattern, "[FILTERED]");
  }

  // Limit consecutive special characters that might be used for confusion
  sanitized = sanitized.replace(/([#*_~`]){5,}/g, "$1$1$1$1");

  // Remove null bytes and other control characters (except newlines and tabs)
  sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");

  return sanitized.trim();
}

/**
 * Sanitize LaTeX code - less aggressive since LaTeX needs special characters
 */
export function sanitizeLatex(input: string): string {
  if (!input || typeof input !== "string") return "";

  let sanitized = input;

  // Remove null bytes and dangerous control characters
  sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");

  // Block dangerous LaTeX commands that could execute system commands
  const dangerousCommands = [
    /\\immediate\\write18/g,
    /\\write18/g,
    /\\input\s*\|/g,
    /\\openin/g,
    /\\openout/g,
    /\\read/g,
    /\\catcode/g,
  ];

  for (const pattern of dangerousCommands) {
    sanitized = sanitized.replace(pattern, "% [BLOCKED COMMAND]");
  }

  return sanitized;
}

/**
 * Sanitize company name for safe display and storage
 */
export function sanitizeCompanyName(input: string): string {
  if (!input || typeof input !== "string") return "";

  return input
    .replace(/[<>]/g, "") // Remove HTML-like brackets
    .replace(/[\x00-\x1F\x7F]/g, "") // Remove control characters
    .trim()
    .slice(0, 200); // Limit length
}

/**
 * Sanitize URL input
 */
export function sanitizeUrl(input: string): string {
  if (!input || typeof input !== "string") return "";

  const trimmed = input.trim();

  // Only allow http and https protocols
  if (trimmed && !trimmed.match(/^https?:\/\//i)) {
    // If no protocol, assume https
    if (trimmed.match(/^[\w.-]+\.\w+/)) {
      return `https://${trimmed}`;
    }
    return "";
  }

  try {
    const url = new URL(trimmed);
    // Only allow http/https
    if (!["http:", "https:"].includes(url.protocol)) {
      return "";
    }
    return url.toString();
  } catch {
    return "";
  }
}

/**
 * Sanitize job description - moderate sanitization
 */
export function sanitizeJobDescription(input: string): string {
  if (!input || typeof input !== "string") return "";

  let sanitized = sanitizeForAI(input);

  // Limit length to prevent token abuse
  const MAX_LENGTH = 50000; // ~10k tokens roughly
  if (sanitized.length > MAX_LENGTH) {
    sanitized = sanitized.slice(0, MAX_LENGTH) + "\n[Content truncated due to length]";
  }

  return sanitized;
}

/**
 * Sanitize personal details
 */
export function sanitizePersonalDetails(input: string): string {
  if (!input || typeof input !== "string") return "";

  return input
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "") // Remove control characters
    .trim()
    .slice(0, 10000); // Limit length
}

/**
 * Validate that a string is not trying to escape or manipulate context
 */
export function isValidInput(input: string): boolean {
  if (!input || typeof input !== "string") return false;

  // Check for excessive repetition (potential DOS)
  if (/(.)\1{100,}/.test(input)) return false;

  // Check for suspicious unicode
  if (/[\u202A-\u202E\u2066-\u2069]/.test(input)) return false; // Bidirectional override chars

  return true;
}
