import type { Meta, StoryObj } from '@storybook/react';

import { listEditorThemeTokens } from '../src/designTokens.js';
import '../src/styles.css';

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
        </div>
      </div>
    </div>
  ),
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
