import { z } from '../lib/zod.js';

export const AlarmSchema = z
  .object({
    log_serial_number: z
      .string()
      .openapi({ example: '123456789', description: 'DWH Log_Serial_Number (bigint as string)' }),
    alarm_name: z.string().nullable().openapi({ example: 'R_LOS' }),
    alarm_severity: z.string().nullable().openapi({ example: 'Critical' }),
    alarm_source: z.string().nullable(),
    status: z.enum(['Clear', 'Not Clear']).openapi({ example: 'Not Clear' }),
    occurrence_time: z.string().datetime().openapi({ example: '2026-05-18T14:32:17.000Z' }),
    clearance_time: z.string().datetime().nullable().openapi({ example: null }),
    down_time: z.string().nullable().openapi({ example: '01:23:45' }),
    location_information: z.string().nullable(),
    fiberlink_site_id: z.string().nullable(),
    fiberlink_site_name: z.string().nullable(),
    site_a_id: z.string().nullable(),
    state: z.string().nullable().openapi({ example: 'Khartoum' }),
    zone: z.string().nullable(),
    vendor: z.string().nullable(),
    source_ne: z.string().nullable(),
    sink_ne: z.string().nullable(),
    is_acked: z.boolean().openapi({ description: 'Whether this alarm has been acknowledged in app DB' }),
  })
  .openapi('Alarm');

export const AlarmFilterParamsSchema = z
  .object({
    severity: z.string().optional().openapi({ example: 'Critical' }),
    status: z.enum(['Clear', 'Not Clear']).optional(),
    state: z.string().optional().openapi({ example: 'Khartoum' }),
    alarm_name: z.string().optional(),
    from: z
      .string()
      .optional()
      .openapi({ example: '2026-05-01T00:00:00Z', description: 'ISO 8601 start time filter' }),
    to: z
      .string()
      .optional()
      .openapi({ example: '2026-05-31T23:59:59Z', description: 'ISO 8601 end time filter' }),
    sort: z
      .enum(['-occurrence_time', 'occurrence_time', '-clearance_time', 'clearance_time'])
      .optional()
      .default('-occurrence_time'),
  })
  .openapi('AlarmFilterParams');
