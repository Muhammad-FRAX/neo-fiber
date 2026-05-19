import { env } from './config/env.js';
import { logger } from './lib/logger.js';
import { createApp } from './app.js';

const app = createApp();

app.listen(env.PORT, () => {
  logger.info({ port: env.PORT, node_env: env.NODE_ENV }, 'Server started');
});
