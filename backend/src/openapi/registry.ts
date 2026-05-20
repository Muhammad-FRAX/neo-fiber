import { OpenAPIRegistry, OpenApiGeneratorV31 } from '@asteasolutions/zod-to-openapi';

// Single shared registry — routes register their paths here
export const registry = new OpenAPIRegistry();

export function generateOpenApiDocument() {
  const generator = new OpenApiGeneratorV31(registry.definitions);
  return generator.generateDocument({
    openapi: '3.1.0',
    info: {
      title: 'Neo-Fiber API',
      version: '1.0.0',
      description:
        'Zain Sudan fiber-optics monitoring tool. Internal use only. Air-gapped — no CDN dependencies.',
    },
    servers: [{ url: '/api/v1', description: 'v1 REST API' }],
  });
}
