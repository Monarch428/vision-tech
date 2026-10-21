# Vision Tech — Frontend

React 19 + Vite + TypeScript single-page app (MUI, Tailwind, React Router) for customers,
admins and the Super Admin (system owner) of the Vision Tech portal.

## Setup

```bash
cp .env.example .env    # VITE_API_BASE_URL must include /api
npm install
npm run dev             # http://localhost:5173
```

| Script | Purpose |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | Type-check and build to `dist/` |
| `npm run lint` | ESLint |

`VITE_*` values are baked into the build, so rebuild after changing them.

## Notes

- Sign-in stores the JWT in `localStorage`; `src/utils/auth.ts` logs out expired sessions and
  refreshes a token that is about to expire while the user is active.
- Password reset: `/forgot-password` emails a link to `/reset-password?token=…`.
- The sidebar shows menus by role, but access is enforced by the API; the UI is not a security boundary.
- When hosting as a static site, rewrite every path to `/index.html` (`public/_redirects` covers Netlify only).
