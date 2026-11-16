# 🎬 AniLog

**AniLog** is a cinematic anime discovery and tracking application designed for enthusiasts who want a beautiful, data-driven way to manage their watchlists. It combines AniList-powered search and discovery with Firebase-backed personal tracking and social features.

https://anilog.app/

## ✨ Features

- **Cinematic Discovery:** Explore trending, popular, and top-rated anime with a high-fidelity, dark-mode interface.
- **Personalized Tracking:** Manage your "Watching", "Plan to Watch", and "Completed" lists with ease.
- **Guest Exploration:** Browse discovery, search, activity, and public profiles without creating an account.
- **Visual Novels:** Search VNDB and track visual novels alongside anime.
- **Social Feed:** Stay updated with a real-time activity feed showing what the community is watching.
- **Detailed Stats:** Track your total watch time, episode counts, and genre preferences.

## 🛠️ Tech Stack

- **Frontend:** React 18, TypeScript, Vite
- **Styling:** Tailwind CSS, Framer Motion (Animations)
- **Database & Auth:** Firebase (Firestore & Authentication)
- **Anime Data:** AniList GraphQL API, with backward-compatible Kitsu lookups for existing entries
- **Visual Novel Data:** VNDB Kana API
- **Icons:** Lucide React

## Local Development

Run `npm ci`, then `npm run dev`. Without Firebase environment variables,
Search, Discover, and Schedule remain available in read-only guest mode.
Account and community features require the Firebase values in `.env.example`.
Never commit a populated environment file.

`npm run check` runs lint, TypeScript checks, source regression checks,
mocked behavioral tests, the production build, and route smoke tests.
The behavioral tests do not read or modify production Firebase data.

## Deployment Troubleshooting

Cloud Run can report a healthy revision while requests fail because project
billing is disabled. Check the request's `textPayload` in Cloud Run Logs before
changing application code. Billing must be restored by the project owner in
Google Cloud; a source-code deployment cannot restore it.

Both deployment workflows now check the deployed routes before reporting success.
These HTTP checks verify that AniLog HTML is served, not authenticated database
operations or browser rendering. Preview never deploys Firestore rules.

## 🔒 Security & Deployment

### Firestore Security Rules
This project includes a `firestore.rules` file. For a secure deployment, ensure these rules are deployed to your Firebase Console to protect user data and restrict write access to document owners.

### Automated Deployment
This repository is configured with **GitHub Actions** for Continuous Deployment to **Google Cloud Run**. 
- Every push to the `main` branch triggers an automated build and deploy.
- Secrets are managed via GitHub Repository Secrets.

### Preview Deployment
- Pushes to the `preview` branch deploy to the separate `anilog-preview` Cloud Run service.
- Preview builds run the full quality gate but never deploy Firestore rules.
- The preview currently uses the production Firebase backend, so use a dedicated test account for mutations.
- Merge `preview` into `main` only after the preview has been reviewed and approved.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---
Built with ❤️ by [KshrugalJain](https://github.com/Kshrugal)
