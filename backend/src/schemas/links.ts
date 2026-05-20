import { z } from '../lib/zod.js';

export const LinkRankingSchema = z
  .enum(['MAIN', 'BACKUP', 'AUX'])
  .openapi({ example: 'MAIN' });

export const LinkSchema = z
  .object({
    id: z.number().int().openapi({ example: 7 }),
    link_id_external: z.string().nullable().openapi({ example: 'LINK-KRT-ATB-001' }),
    source_device_id: z.number().int().openapi({ example: 1 }),
    target_device_id: z.number().int().openapi({ example: 2 }),
    ranking: LinkRankingSchema,
    capacity_gbps: z.number().nullable().openapi({ example: 10.0 }),
  })
  .openapi('Link');

export const CreateLinkSchema = z
  .object({
    link_id_external: z.string().max(255).optional().nullable(),
    source_device_id: z.number().int().positive(),
    target_device_id: z.number().int().positive(),
    ranking: LinkRankingSchema,
    capacity_gbps: z.number().positive().optional().nullable(),
  })
  .openapi('CreateLink');

export const UpdateLinkSchema = CreateLinkSchema.partial().openapi('UpdateLink');

export type LinkRow = {
  id: number;
  link_id_external: string | null;
  source_device_id: number;
  target_device_id: number;
  ranking: 'MAIN' | 'BACKUP' | 'AUX';
  capacity_gbps: number | null;
};
