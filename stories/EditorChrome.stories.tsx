import { useEffect, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Editor } from '@tiptap/react';

import { Toolbar } from '../src/components/Toolbar.js';
import { listEditorThemeTokens } from '../src/designTokens.js';
import { buildExtensions } from '../src/extensions/kit.js';
import '../src/styles.css';

function LiveToolbarPreview() {
  const [editor, setEditor] = useState<Editor | null>(null);

  useEffect(() => {
    const instance = new Editor({
      extensions: buildExtensions({ image: { maxDimension: 0 } }),
      content:
        '<p>Override tokens on .cwl-editor after checking WCAG 2.2 contrast.</p>',
    });
    setEditor(instance);
    return () => {
      instance.destroy();
    };
  }, []);

  if (!editor) {
    return <p>Preparing the shipped toolbar.</p>;
  }

  return (
    <div className="cwl-editor" style={{ width: 640 }}>
      <Toolbar editor={editor} image={{ maxDimension: 0 }} />
      <div className="cwl-editor__surface">
        <div className="cwl-editor__content">
          This story mounts the shipped Toolbar. Override `--cwl-*` on
          `.cwl-editor`. It does not mount CwlEditor.
        </div>
      </div>
    </div>
  );
}

const meta = {
  title: 'Editor Chrome',
  parameters: {
    layout: 'centered',
  },
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const ToolbarButtonStates: Story = {
  name: 'Toolbar Button States',
  render: () => (
    <div className="cwl-editor" style={{ width: 320 }}>
      <div className="cwl-toolbar" role="toolbar" aria-label="Formatting">
        <div className="cwl-tb-group">
          <button type="button" className="cwl-tb-btn">
            B
          </button>
          <button type="button" className="cwl-tb-btn is-active" aria-pressed="true">
            I
          </button>
          <button type="button" className="cwl-tb-btn" autoFocus aria-label="Focus-visible sample">
            F
          </button>
          <button type="button" className="cwl-tb-btn" disabled>
            U
          </button>
        </div>
      </div>
      <div className="cwl-collaboration-status">Idle</div>
      <div className="cwl-editor__surface">
        <div className="cwl-editor__content">
          Preview the same `.cwl-*` classes buyers ship, including
          `:focus-visible`. Forced-colors restyles that outline to CanvasText
          and does not assign `--cwl-*`. This is a class-level chrome sample,
          not a mounted Toolbar or CwlEditor.
        </div>
      </div>
    </div>
  ),
};

export const LiveToolbar: Story = {
  name: 'Live Toolbar',
  render: () => <LiveToolbarPreview />,
};

export const ThemeTokens: Story = {
  name: 'Theme Tokens',
  render: () => (
    <div className="cwl-editor" style={{ padding: 16, width: 360 }}>
      <p>Override these tokens on .cwl-editor after checking WCAG 2.2 contrast.</p>
      <ul>
        {listEditorThemeTokens().map((token) => (
          <li key={token.name}>
            <code>{token.cssCustomProperty}</code>
            {token.role === 'color' ? (
              <span
                aria-hidden="true"
                style={{
                  display: 'inline-block',
                  width: 16,
                  height: 16,
                  marginLeft: 8,
                  background: token.lightValue,
                  border: '1px solid var(--cwl-border)',
                }}
              />
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  ),
};
