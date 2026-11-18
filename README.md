# AniLog

I made AniLog to keep my anime and visual novels in one place. It's a spot to track what I'm watching or reading, see how much time I've spent on a series, and share my favorites with friends.

Try it at [anilog.app](https://anilog.app). You can browse as a guest or sign in to save your library and customize your profile.

## Run it locally

```sh
npm ci
npm run dev
```

Guest browsing works without Firebase. For sign-in and saved libraries, copy `.env.example` to `.env` and fill in your Firebase config. Keep `.env` out of Git.

Run `npm run check` before pushing. `preview` deploys to the test site, and `main` deploys to anilog.app. Both share the same Firebase backend, so use a test account when trying changes that save data.

Built with React, TypeScript, and Firebase. Media data comes from AniList and VNDB.

[MIT License](LICENSE)
