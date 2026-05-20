import { z } from '../lib/zod.js';

export const AlternatePathSchema = z
  .object({
    id: z.number().int().openapi({ example: 3 }),
    device_id: z.number().int().openapi({ example: 5 }),
    alternate_link_ids: z
      .array(z.number().int())
      .openapi({ example: [7, 8], description: 'IDs of links that can serve as alternates' }),
    declared_by: z.number().int().nullable().openapi({ example: 1 }),
    declared_at: z.string().datetime().openapi({ example: '2026-05-18T10:00:00.000Z' }),
  })
  .openapi('AlternatePath');

export const CreateAlternatePathSchema = z
  .object({
    device_id: z.number().int().positive(),
    alternate_link_ids: z.array(z.number().int().positive()).min(1),
  })
  .openapi('CreateAlternatePath');

export const UpdateAlternatePathSchema = CreateAlternatePathSchema.partial().openapi(
  'UpdateAlternatePath',
);

export type AlternatePathRow = {
  id: number;
  device_id: number;
  alternate_link_ids: number[];
  declared_by: number | null;
  declared_at: Date;
};
