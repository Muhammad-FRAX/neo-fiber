import { z } from '../lib/zod.js';

export const PaginationParamsSchema = z
  .object({
    page: z
      .string()
      .optional()
      .default('1')
      .transform((v) => Math.max(1, parseInt(v, 10)))
      .openapi({ example: '1', description: 'Page number (1-based)' }),
    limit: z
      .string()
      .optional()
      .default('50')
      .transform((v) => Math.min(200, Math.max(1, parseInt(v, 10))))
      .openapi({ example: '50', description: 'Items per page (max 200)' }),
  })
  .openapi('PaginationParams');

export const PaginationMetaSchema = z
  .object({
    page: z.number().int().openapi({ example: 1 }),
    limit: z.number().int().openapi({ example: 50 }),
    total: z.number().int().openapi({ example: 100 }),
  })
  .openapi('PaginationMeta');

export function paginatedResponse<T extends z.ZodTypeAny>(dataSchema: T) {
  return z.object({
    data: z.array(dataSchema),
    pagination: PaginationMetaSchema,
  });
}

export const ErrorResponseSchema = z
  .object({
    error: z.object({
      code: z.string().openapi({ example: 'NOT_FOUND' }),
      message: z.string().openapi({ example: 'Resource not found' }),
      details: z.unknown().optional(),
    }),
  })
  .openapi('ErrorResponse');
