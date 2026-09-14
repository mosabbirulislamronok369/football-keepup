# Football Keep-Up

A lightweight, storage-free, offline-first football keep-up game built with React + TypeScript + Vite.

## Run locally

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

The production files are generated in `dist/`.

## Cloudflare

Deploy the `dist` folder as a static site. No database, Supabase, R2, or server storage is required.

## Offline / PWA

The app includes a web manifest and service worker. For a production PWA, register `public/sw.js` from the app after deployment. If your host serves the built `sw.js` at `/sw.js`, registration can be added with:

```ts
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js')
}
```

## Controls

- Phone: tap the game
- PC: mouse click
- Keyboard: Space / Arrow Up
- Best score is stored only in localStorage on the current device/browser.

## Notes

This project intentionally has no leaderboard, account system, database, or cloud game storage.
