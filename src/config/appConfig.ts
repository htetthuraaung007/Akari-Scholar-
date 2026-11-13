/**
 * Open-Source Adaptability & Application Configuration
 * Decoupled endpoints, CORS proxies, model mappings, and quota limits.
 */

export const APP_CONFIG = {
  CORS_PROXIES: [
    'https://corsproxy.io/?',
    'https://api.allorigins.win/raw?url=',
  ],
  ACADEMIC_APIS: {
    CROSSREF: 'https://api.crossref.org/works/',
    UNPAYWALL: 'https://api.unpaywall.org/v2/',
    SEMANTIC_SCHOLAR: 'https://api.semanticscholar.org/graph/v1/paper/',
  },
  MODELS: {
    DEFAULT_FAST: 'gemini-3.1-flash-lite',
    DEFAULT_STANDARD: 'gemini-4-hydrogen',
    DEFAULT_REASONING: 'gemini-4-hydrogen',
  },
  MAX_SOURCE_INPUTS: 5,
  MAX_INPUT_WORDS_PRUNED: 5000,
  UNPAYWALL_EMAIL: 'scholar@uopeople.internal',
};
