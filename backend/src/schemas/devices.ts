import { z } from '../lib/zod.js';

export const DeviceSchema = z
  .object({
    id: z.number().int().openapi({ example: 42 }),
    device_id_external: z.string().nullable().openapi({ example: 'NE-KRT-01' }),
    site_id: z.number().int().openapi({ example: 1 }),
    name: z.string().openapi({ example: 'Core Router A' }),
    type: z.string().nullable().openapi({ example: 'ROADM' }),
    vendor: z.string().nullable().openapi({ example: 'Huawei' }),
  })
  .openapi('Device');

export const CreateDeviceSchema = z
  .object({
    device_id_external: z.string().max(255).optional().nullable(),
    site_id: z.number().int().positive(),
    name: z.string().min(1).max(255),
    type: z.string().max(100).optional().nullable(),
    vendor: z.string().max(100).optional().nullable(),
  })
  .openapi('CreateDevice');

export const UpdateDeviceSchema = CreateDeviceSchema.partial().openapi('UpdateDevice');

export type DeviceRow = {
  id: number;
  device_id_external: string | null;
  site_id: number;
  name: string;
  type: string | null;
  vendor: string | null;
};
