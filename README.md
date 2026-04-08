# 2D MetaVerse (EchoGrid)

Welcome to **EchoGrid**, a spatial 2D MetaVerse built with React Native (Expo) and a custom Node.js WebSocket backend!

![EchoGrid Environment](./assets/office_map.png)

## What is this app?

EchoGrid is an interactive virtual office and social space where users can walk around, chat, and play mini-games together in real-time. It features proximity-based interactions, meaning you only interact with players who are close to you on the map!

### Key Features
- **Real-Time Multiplayer:** Instant movement updates and avatar syncing powered by a custom Node.js WebSocket server.
- **Proximity Voice & Text Chat:** Move close to other users to hear them talk via [LiveKit](https://livekit.io/) integration, or use the nearby text chat.
- **Interactive Mini-games:** Challenge nearby coworkers to Math quizzes and Memory games!
- **Customizable Avatars:** Choose from multiple unique characters.
- **Cross-Platform:** Built with Expo, ready for iOS, Android, and Web.

---

## 🚀 Getting Started

To run this project locally, you need to start both the Node.js WebSocket server and the Expo frontend app.

### 1. Start the Backend Server
The server tracks player positions, handles chat, and manages game logic.

```bash
cd server
npm install
node index.js
```

> **Note on Voice Chat:** For proximity voice chat to work, generate free API keys from [LiveKit Cloud](https://cloud.livekit.io/) and place them in `server/.env`. Make sure to copy `server/.env.sample` to `server/.env`.

### 2. Start the Frontend App
The frontend is a React Native app managed by Expo.

```bash
# Open a new terminal in the project root
npm install
npx expo start
```

Once started, you can:
- **Scan the QR Code** with the *Expo Go* app on your physical device.
- Press **`i`** to open the iOS Simulator.
- Press **`a`** to open the Android Emulator.

*(If you are testing on a physical device, update the `SERVER_URL` in `app/game.tsx` to point to your computer's local Wi-Fi IP address instead of `localhost`.)*

---

## 🛠️ Built With
- **Frontend**: React Native, Expo Router, Reanimated
- **Backend**: Node.js, `ws` (WebSockets)
- **Voice**: [LiveKit](https://livekit.io/) SDKs
- **Styling**: Vanilla CSS-in-JS (StyleSheet)
