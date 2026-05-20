import { z } from '../lib/zod.js';

export const SiteSchema = z
  .object({
    id: z.number().int().openapi({ example: 1 }),
    site_id_external: z.string().nullable().openapi({ example: 'SDN-KRT-001' }),
    name: z.string().openapi({ example: 'Khartoum North #5' }),
    region: z.string().nullable().openapi({ example: 'Khartoum' }),
    state: z.string().nullable().openapi({ example: 'Khartoum State' }),
    lat: z.number().nullable().openapi({ example: 15.5007 }),
    lng: z.number().nullable().openapi({ example: 32.5599 }),
    is_root: z.boolean().openapi({ example: false, description: 'BFS anchor for reachability' }),
  })
  .openapi('Site');

export const CreateSiteSchema = z
  .object({
    site_id_external: z.string().max(255).optional().nullable(),
    name: z.string().min(1).max(255).openapi({ example: 'Khartoum North #5' }),
    region: z.string().max(255).optional().nullable(),
    state: z.string().max(255).optional().nullable(),
    lat: z.number().min(-90).max(90).optional().nullable(),
    lng: z.number().min(-180).max(180).optional().nullable(),
    is_root: z.boolean().default(false),
  })
  .openapi('CreateSite');

export const UpdateSiteSchema = CreateSiteSchema.partial().openapi('UpdateSite');

export const SiteWithDevicesSchema = SiteSchema.extend({
  devices: z.array(
    z.object({
      id: z.number().int(),
      device_id_external: z.string().nullable(),
      name: z.string(),
      type: z.string().nullable(),
      vendor: z.string().nullable(),
    }),
  ),
}).openapi('SiteWithDevices');

export type SiteRow = {
  id: number;
  site_id_external: string | null;
  name: string;
  region: string | null;
  state: string | null;
  lat: number | null;
  lng: number | null;
  is_root: boolean;
};
