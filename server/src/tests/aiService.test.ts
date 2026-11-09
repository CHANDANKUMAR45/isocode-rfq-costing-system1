import { beforeEach, describe, expect, it, vi } from 'vitest';

const gemini = vi.hoisted(() => ({
  constructor: vi.fn(),
  getGenerativeModel: vi.fn(),
  generateContent: vi.fn(),
}));

vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: vi.fn().mockImplementation((apiKey: string) => {
    gemini.constructor(apiKey);
    return { getGenerativeModel: gemini.getGenerativeModel };
  }),
}));

import { extractRfqWithAi, extractWithHeuristics } from '../services/aiService.js';

function createGeminiResponse() {
  const field = (value: string | number | null) => ({ value, snippet: '', confidence: 0.9 });
  return {
    partName: field('Hydraulic lift arm'),
    partNumber: field('ARM-TEST-01'),
    material: field('40Cr4'),
    grossWeightKg: field(4.6),
    netWeightKg: field(3.95),
    annualVolume: field(24000),
    cycleTimeMin: field(11.5),
    drawingNumber: field('DWG-TEST-01'),
    revision: field('Rev-04'),
    suggestedOperations: [],
  };
}

describe('RFQ AI extraction provider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('GEMINI_API_KEY', 'unit-test-api-key');
    vi.stubEnv('GEMINI_MODEL', 'gemini-configured-test');
    vi.stubEnv('NODE_ENV', 'test');
    gemini.getGenerativeModel.mockReturnValue({ generateContent: gemini.generateContent });
    gemini.generateContent.mockResolvedValue({
      response: { text: () => JSON.stringify(createGeminiResponse()) },
    });
  });

  it('calls generateContent with the configured model and identifies the Gemini provider', async () => {
    const extracted = await extractRfqWithAi(
      'Part Name: Hydraulic lift arm\nAnnual Requirement: 24,000',
      'EMAIL',
    );

    expect(gemini.constructor).toHaveBeenCalledWith('unit-test-api-key');
    expect(gemini.getGenerativeModel).toHaveBeenCalledWith({
      model: 'gemini-configured-test',
      generationConfig: { responseMimeType: 'application/json' },
    });
    expect(gemini.generateContent).toHaveBeenCalledOnce();
    expect(gemini.generateContent.mock.calls[0][0]).toContain('Annual Requirement: 24,000');
    expect(extracted.provider).toBe('gemini');
    expect(extracted.isAiGenerated).toBe(true);
    expect(extracted.annualVolume.value).toBe(24000);
  });

  it('uses the Gemini default model when GEMINI_MODEL is unset', async () => {
    vi.stubEnv('GEMINI_MODEL', '');

    await extractRfqWithAi('Part Name: Hydraulic lift arm', 'EMAIL');

    expect(gemini.getGenerativeModel).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'gemini-3.6-flash' }),
    );
  });

  it('reports a categorized Gemini failure and falls back without logging RFQ text', async () => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.stubEnv('NODE_ENV', 'development');
    gemini.generateContent.mockRejectedValue(Object.assign(new Error('private response body'), { status: 429 }));
    const rfqText = 'Private Customer: Example Manufacturing\nPart Name: Hydraulic lift arm';

    try {
      const extracted = await extractRfqWithAi(rfqText, 'EMAIL');

      expect(extracted.provider).toBe('local_fallback');
      expect(extracted.geminiErrorCategory).toBe('RATE_LIMIT');
      expect(warning).toHaveBeenCalledWith('Gemini extraction failed; using local parser', {
        category: 'RATE_LIMIT',
        httpStatus: 429,
      });
      expect(JSON.stringify(warning.mock.calls)).not.toContain(rfqText);
      expect(JSON.stringify(warning.mock.calls)).not.toContain('private response body');
    } finally {
      warning.mockRestore();
    }
  });

  it('extracts component labels and annual requirement quantities in the local fallback', () => {
    const extracted = extractWithHeuristics(
      'COMPONENT: Hydraulic lift arm\nAnnual Requirement: 24,000 units',
      'DRAWING_TITLE_BLOCK',
    );

    expect(extracted.provider).toBe('local_fallback');
    expect(extracted.partName.value).toBe('Hydraulic lift arm');
    expect(extracted.annualVolume.value).toBe(24000);
  });

  it('converts abbreviated annual requirement quantities in the local fallback', () => {
    const extracted = extractWithHeuristics('Part Name: Shaft pinion\nAnnual Requirement: 24k', 'EMAIL');

    expect(extracted.annualVolume.value).toBe(24000);
  });
});
