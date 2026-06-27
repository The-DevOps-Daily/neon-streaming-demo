import { defineConfig } from '@neondatabase/config/v1';

export default defineConfig({
  preview: {
    aiGateway: true,
    functions: {
      stream: {
        name: 'streaming demo',
        source: 'src/index.ts',
      },
    },
  },
});
