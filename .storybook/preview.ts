import type { Preview } from '@storybook/react';

import '../src/styles.css';

const preview: Preview = {
  parameters: {
    controls: { disable: true },
  },
};

export default preview;
