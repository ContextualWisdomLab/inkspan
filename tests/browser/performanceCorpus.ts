/** Versioned synthetic corpus used by the initial large-document browser smoke. */
export const PERFORMANCE_CORPUS_VERSION = 'inkspan-large-document-v1' as const;

export interface PerformanceDocumentProfile {
  readonly id: 'small' | 'medium' | 'large';
  readonly value: string;
  readonly paragraphCount: number;
}

const PARAGRAPH_SEEDS = [
  'English heading and paragraph with a deterministic link.',
  '한국어 문장과 한글 조합 입력을 위한 합성 문단입니다.',
  '日本語の見出しと文章を含む決定的なテスト段落です。',
  '简体中文和繁體中文的混合段落用于编辑性能测试。',
  'Đoạn văn tiếng Việt có dấu và mixed Latin content.',
] as const;

function paragraph(index: number): string {
  const seed = PARAGRAPH_SEEDS[index % PARAGRAPH_SEEDS.length];
  return `### Section ${index + 1}\n\n${seed} Item ${index + 1}.`;
}

function profile(
  id: PerformanceDocumentProfile['id'],
  paragraphCount: number,
): PerformanceDocumentProfile {
  return Object.freeze({
    id,
    paragraphCount,
    value: Array.from({ length: paragraphCount }, (_, index) => paragraph(index)).join(
      '\n\n',
    ),
  });
}

/** Small-to-large profiles keep the first gate deterministic and content-safe. */
export const PERFORMANCE_DOCUMENT_PROFILES: readonly PerformanceDocumentProfile[] =
  Object.freeze([
    profile('small', 20),
    profile('medium', 100),
    profile('large', 300),
  ]);
