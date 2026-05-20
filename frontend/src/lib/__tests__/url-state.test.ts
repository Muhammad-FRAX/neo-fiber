/**
 * Tests for url-state parsers — verifies default values are correct.
 * T9 — §9 client state B2 shareable views.
 */

import { describe, expect, it } from "vitest"
import { mapViewportParsers, alarmFilterParsers, selectedSiteParsers } from "../url-state"

describe("mapViewportParsers defaults", () => {
  it("lat defaults to Sudan centre (~15°N)", () => {
    expect(mapViewportParsers.lat.defaultValue).toBeCloseTo(15.5, 1)
  })

  it("lng defaults to Sudan centre (~32°E)", () => {
    expect(mapViewportParsers.lng.defaultValue).toBeCloseTo(32.5, 1)
  })

  it("zoom defaults to 5", () => {
    expect(mapViewportParsers.zoom.defaultValue).toBe(5)
  })
})

describe("alarmFilterParsers defaults", () => {
  it("severity defaults to Critical", () => {
    expect(alarmFilterParsers.severity.defaultValue).toBe("Critical")
  })

  it("state defaults to empty string (no filter)", () => {
    expect(alarmFilterParsers.state.defaultValue).toBe("")
  })

  it("page defaults to 1", () => {
    expect(alarmFilterParsers.page.defaultValue).toBe(1)
  })
})

describe("selectedSiteParsers defaults", () => {
  it("site defaults to empty string (none selected)", () => {
    expect(selectedSiteParsers.site.defaultValue).toBe("")
  })
})
