# 🎬 AniLog

**AniLog** is a cinematic anime discovery and tracking application designed for enthusiasts who want a beautiful, data-driven way to manage their watchlists. Built with a focus on aesthetics and performance, AniLog combines real-time data from Kitsu with AI-powered insights.

![AniLog Preview](https://kitsu.io/images/default_cover-22e5f56b17aeced6dc7f69c8d422a1ab.jpg)

## ✨ Features

- **Cinematic Discovery:** Explore trending, popular, and top-rated anime with a high-fidelity, dark-mode interface.
- **Personalized Tracking:** Manage your "Watching", "Plan to Watch", and "Completed" lists with ease.
- **Genre Galaxy:** Visualize your anime taste with an interactive D3.js-powered force-directed graph.
- **AI Insights:** Leverage Gemini AI to get deep dives into anime themes, "DNA" analysis, and smart recommendations.
- **Social Feed:** Stay updated with a real-time activity feed showing what the community is watching.
- **Detailed Stats:** Track your total watch time, episode counts, and genre preferences.

## 🛠️ Tech Stack

- **Frontend:** React 18, TypeScript, Vite
- **Styling:** Tailwind CSS, Framer Motion (Animations)
- **Database & Auth:** Firebase (Firestore & Authentication)
- **AI:** Google Gemini API (@google/genai)
- **Data Visualization:** D3.js
- **Icons:** Lucide React

## 🔒 Security & Deployment

### Firestore Security Rules
This project includes a `firestore.rules` file. For a secure deployment, ensure these rules are deployed to your Firebase Console to protect user data and restrict write access to document owners.

### Automated Deployment
This repository is configured with **GitHub Actions** for Continuous Deployment to **Google Cloud Run**. 
- Every push to the `main` branch triggers an automated build and deploy.
- Secrets are managed via GitHub Repository Secrets.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---
Built with ❤️ by [KshrugalJain](https://github.com/Kshrugal)
