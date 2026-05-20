/// <reference types="vite/client" />

// Allow importing CSS files from npm packages (e.g. maplibre-gl/dist/maplibre-gl.css)
declare module "*.css" {
  const content: Record<string, string>
  export default content
}
