# LearnVerse LearnVerse — Android App

React Native mobile app implementing the subject-first learning workflow.

## Prerequisites

- Node.js 18+
- Android Studio (latest stable)
- JDK 17+ (you have JDK 21 ✓)
- Android SDK API 26+ (you have 36.1 ✓)
- An Android emulator or physical device

## Setup

```bash
# 1. From this directory, install dependencies
npm install

# 2. Start the backend API (in a separate terminal, from project root)
npx tsx packages/services/api/src/server.ts

# 3. Start Metro bundler
npx react-native start

# 4. In another terminal, build and run on Android
npx react-native run-android
```

## Running in Android Studio

1. Open Android Studio
2. Select **Open an Existing Project**
3. Navigate to: `packages/platform-mobile/rn-app/android/`
4. Wait for Gradle sync to complete
5. Make sure Metro bundler is running (`npx react-native start` in terminal)
6. Select your emulator or connected device
7. Click **Run** (▶) or press `Shift+F10`

## App Flow

1. **Subject Selection** — Choose which subject to study (or enroll in a new one)
2. **Chapter Selection** — Pick an existing chapter or create a new one
3. **Learning** — Active learning screen (upload content, practice, revise)

## API Connection

- The app connects to `http://10.0.2.2:3000` on the Android emulator (maps to host's localhost:3000)
- Make sure the backend API server is running before launching the app
- Use `x-learner-id` header for identification (hardcoded to `mobile-learner-1` in dev)

## Troubleshooting

- **Metro can't find packages**: Run `npm run build` from the project root first
- **Network errors**: Ensure the backend server is running at localhost:3000
- **Gradle sync fails**: Check `ANDROID_HOME` is set: `export ANDROID_HOME=~/Library/Android/sdk`
- **Build errors**: Try `cd android && ./gradlew clean` then rebuild
