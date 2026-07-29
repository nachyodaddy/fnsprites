# Fortnite Sprite Tracker (SpriteTrackr / fnsprites)

An interactive web application for tracking Fortnite Sprites (Chapter 7 Season 3 "Runners"), Extracted & Mastered crowns, Wishlists, Player Profiles, Trade Requests, and Rarity/Variant collections.

![Fortnite Sprite Tracker](https://raw.githubusercontent.com/nachyodaddy/fnsprites/main/index.html)

---

## ✨ Key Features

- **⚡ Real-Time Sprite Progress**: Track Extracted and Mastered crowns with dual-layer sync (Supabase Cloud DB + LocalStorage offline fallback).
- **👑 Buyback & Rarity Analytics**: Shows exact Sprite Dust buyback costs (updated per July 2026 pricing cut), drop rates, abilities, and variant bonuses (Gold, Gummy, Galaxy, Holofoil, Gem, Cube).
- **❤️ Wishlist & Custom Notes**: Bookmark your favorite sprites and attach private notes per sprite.
- **🔍 Fast Search & Filter System**: Instant search by name, filter by status (Extracted, Mastered, Untouched, Wishlist), rarity tier, and variant prefix.
- **🔮 Interactive Category Dividers & Bulk Actions**: Single-click **Extract All** or **Master All** per category group (Water, Earth, Fire, Duck, Ghost, Dream, Demon, Punk, King, Zero Point, Fishy, Striker, Aura, Boss, Grim, Air, Seven, Batman, Collabs).
- **⏳ Season Countdown**: Live ticking countdown timer to Season End (August 19, 2026).
- **👥 Social & Player Browsing**: View other players' extracted collections, heart their sprites, send trade requests, or manage user profiles.
- **👁️ Admin & Moderator POV Mode**: View and simulate user perspectives for testing.

---

## 🚀 Local Development Setup

### 1. Prerequisites
- Node.js (v18+) & npm installed on your machine.

### 2. Run Locally
```bash
# Install dependencies
npm install

# Start local Vite dev server
npm run dev
```
Open your browser at `http://localhost:3000` to view the app with hot reloading.

### 3. Production Build
```bash
# Build for production
npm run build

# Preview production build locally
npm run preview
```

---

## 🌐 Deploy to GitHub

This repository is configured for **GitHub Pages** deployment:
```bash
# Push changes to main branch
git add .
git commit -m "Update Sprite Trackr app build & features"
git push origin main
```

---

## 🛠️ Stack & Technologies

- **Frontend**: Vanilla JS (ES Modules) + Vite 5 + Glassmorphic Modern CSS
- **Backend / Database**: Supabase JS SDK (Auth, Profiles, Progress, Hearts, Requests)
- **Deployment**: GitHub Pages / Static Hosting

---

Developed for Fortnite Sprite Collectors by **Onze Interactive / nachyodaddy**.
