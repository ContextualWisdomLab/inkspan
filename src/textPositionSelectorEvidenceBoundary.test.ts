import { Schema } from '@tiptap/pm/model';
import { TextSelection } from '@tiptap/pm/state';
import { describe, expect, it } from 'vitest';
import {
  TextPositionSelectorEvidenceError,
  createTextPositionSelector,
} from './textPositionSelectorEvidence.js';

const schema = new Schema({
  nodes: {
    doc: { content: 'paragraph+' },
    paragraph: { content: 'text*' },
    text: {},
  },
});

function documentWithText(text: string) {
  return schema.node('doc', undefined, [
    schema.node('paragraph', undefined, text ? [schema.text(text)] : []),
  ]);
}

function expectEvidenceError(
  callback: () => unknown,
  code: TextPositionSelectorEvidenceError['code'],
): TextPositionSelectorEvidenceError {
  try {
    callback();
  } catch (error) {
    expect(error).toBeInstanceOf(TextPositionSelectorEvidenceError);
    expect((error as TextPositionSelectorEvidenceError).code).toBe(code);
    return error as TextPositionSelectorEvidenceError;
  }
  throw new Error(`Expected TextPositionSelectorEvidenceError(${code})`);
}

describe('forward selector grapheme boundary', () => {
  it('rejects a structural position inside one combining grapheme', () => {
    const documentNode = documentWithText('e\u0301x');

    expectEvidenceError(
      () =>
        createTextPositionSelector(
          documentNode,
          TextSelection.create(documentNode, 2, 3),
        ),
      'grapheme_boundary',
    );
  });

  it('fails closed when the runtime grapheme segmenter is unavailable', () => {
    const documentNode = documentWithText('text');
    const original = Object.getOwnPropertyDescriptor(Intl, 'Segmenter');
    try {
      Object.defineProperty(Intl, 'Segmenter', {
        configurable: true,
        value: undefined,
      });
      const error = expectEvidenceError(
        () =>
          createTextPositionSelector(
            documentNode,
            TextSelection.create(documentNode, 1, 2),
          ),
        'segmenter_unavailable',
      );
      expect(error.message).not.toContain('undefined');
    } finally {
      if (original) Object.defineProperty(Intl, 'Segmenter', original);
    }
  });
});
