import { ValidationPipe, BadRequestException, ArgumentMetadata } from '@nestjs/common';
import { UpdateHighlightsDto } from './test.dto';

/**
 * Validates the `source` field added to HighlightDto for the question/explanation
 * highlight-scoping fix. The pipe is configured IDENTICALLY to production
 * (main.ts / worker.ts): whitelist + forbidNonWhitelisted + transform. This is
 * the real request-validation path for PATCH /tests/:id/highlights.
 */
describe('UpdateHighlightsDto — highlight `source` scoping field', () => {
  const pipe = new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    transformOptions: { enableImplicitConversion: true },
  });

  const meta: ArgumentMetadata = {
    type: 'body',
    metatype: UpdateHighlightsDto,
    data: '',
  };

  // Minimal valid highlight; override fields per-case.
  const hl = (over: Record<string, unknown> = {}) => ({
    text: 'sodium',
    startIndex: 0,
    endIndex: 0,
    color: 'yellow',
    ...over,
  });
  const body = (highlights: unknown[]) => ({ questionId: 123, highlights });

  const transform = (payload: unknown) =>
    pipe.transform(payload, meta) as Promise<UpdateHighlightsDto>;

  it('accepts source="question" and keeps it after validation', async () => {
    const out = await transform(body([hl({ source: 'question' })]));
    expect(out.highlights[0].source).toBe('question');
  });

  it('accepts source="explanation" and keeps it after validation', async () => {
    const out = await transform(body([hl({ source: 'explanation' })]));
    expect(out.highlights[0].source).toBe('explanation');
  });

  it('PRESERVES source through whitelist (would be silently stripped if the DTO lacked the field)', async () => {
    const out = await transform(body([hl({ source: 'explanation' })]));
    // This is the core guarantee: the field survives whitelist:true, so it
    // actually reaches the json column and round-trips on reload.
    expect(out.highlights[0]).toHaveProperty('source', 'explanation');
  });

  it('accepts a highlight with NO source (legacy rows / cached old bundles)', async () => {
    const out = await transform(body([hl()]));
    expect(out.highlights[0].source).toBeUndefined();
    expect(out.highlights[0].text).toBe('sodium');
    expect(out.highlights[0].color).toBe('yellow');
  });

  it('REJECTS an invalid source enum value (@IsIn guard)', async () => {
    await expect(transform(body([hl({ source: 'banana' })]))).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('REJECTS an unknown extra TOP-LEVEL field (forbidNonWhitelisted)', async () => {
    await expect(
      transform({ ...body([hl({ source: 'question' })]), evil: 1 }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('REJECTS an unknown extra field on a nested highlight (forbidNonWhitelisted, nested)', async () => {
    // This is WHY `source` had to be added to the DTO rather than just sent:
    // an undeclared nested field is rejected, not silently dropped.
    await expect(
      transform(body([hl({ source: 'question', notDeclared: 'x' })])),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('still enforces required highlight fields (missing color)', async () => {
    const missingColor = { text: 'x', startIndex: 0, endIndex: 0, source: 'question' };
    await expect(transform(body([missingColor]))).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('still accepts the optional questionHtml / explanationHtml snapshots', async () => {
    const out = await transform({
      ...body([hl({ source: 'question' })]),
      questionHtml: '<p>x</p>',
      explanationHtml: '<p>y</p>',
    });
    expect(out.questionHtml).toBe('<p>x</p>');
    expect(out.explanationHtml).toBe('<p>y</p>');
  });

  it('accepts a mixed array: a question highlight and an explanation highlight with the same text', async () => {
    const out = await transform(
      body([
        hl({ text: 'sodium', color: 'yellow', source: 'question' }),
        hl({ text: 'sodium', color: 'green', source: 'explanation' }),
      ]),
    );
    expect(out.highlights).toHaveLength(2);
    expect(out.highlights[0].source).toBe('question');
    expect(out.highlights[1].source).toBe('explanation');
  });
});
