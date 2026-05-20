/**
 * URL state helpers using nuqs.
 * Map viewport + filter params live in the URL so directors can share views
 * via WhatsApp (paste URL → same map state).
 *
 * T9 — §9 client state (nuqs), B2 shareable views
 */

import {
  parseAsFloat,
  parseAsInteger,
  parseAsString,
  parseAsStringEnum,
  useQueryState,
  useQueryStates,
} from "nuqs"

// Map viewport
export const mapViewportParsers = {
  lat: parseAsFloat.withDefault(15.5),   // Sudan centre ~15°N
  lng: parseAsFloat.withDefault(32.5),   // Sudan centre ~32°E
  zoom: parseAsFloat.withDefault(5),
}

// Active alarm filters
export const alarmFilterParsers = {
  severity: parseAsStringEnum(["Critical", "Major", "Minor", "Info"] as const).withDefault(
    "Critical",
  ),
  state: parseAsString.withDefault(""),
  page: parseAsInteger.withDefault(1),
}

// Currently selected site (for deep-linking to a site modal)
export const selectedSiteParsers = {
  site: parseAsString.withDefault(""),
}

export function useMapViewport() {
  return useQueryStates(mapViewportParsers, { history: "replace" })
}

export function useAlarmFilters() {
  return useQueryStates(alarmFilterParsers)
}

export function useSelectedSite() {
  return useQueryState("site", parseAsString.withDefault(""))
}
