# Daniel Workman Portfolio

Personal portfolio site for Daniel Workman, built with Astro, Tailwind CSS, and the Cloudflare adapter. The site includes a homepage, project case studies, blog routes, profile data, and a contact form endpoint ready to run on Cloudflare.

## Tech Stack

- Astro 5
- Tailwind CSS 4
- Cloudflare Workers/Assets via `@astrojs/cloudflare`
- TypeScript
- pnpm

## Local Development

Use Node.js `22.12.0` or newer.

```sh
pnpm install
pnpm dev
```

Common commands:

```sh
pnpm build
pnpm preview
```

## Project Structure

- `src/pages/` - Astro routes, including home, projects, blog, and API routes.
- `src/data/` - Profile, project, and blog content stored as JSON.
- `src/layouts/` - Shared page layout.
- `src/styles/` - Global Tailwind styles.
- `public/` - Static images and favicon assets.
- `wrangler.jsonc` - Cloudflare deployment config.
