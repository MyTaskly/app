# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**MyTaskly** is an intelligent task management app combining React Native with AI-powered features. Built with Expo, TypeScript, and custom streaming LLM integration, it provides real-time task syncing, voice interaction, and offline support.

## Development Setup

### Prerequisites
- Node.js v18+
- Expo CLI: `npm install -g expo-cli`
- Android Studio or Xcode (for native builds)

### Environment Configuration
Create `.env` file in root:
```env
API_KEY=your_api_key_here
API_URL=your_backend_url_here
GOOGLE_WEB_CLIENT_ID=your_google_client_id
GOOGLE_ANDROID_CLIENT_ID=your_google_android_client_id
```

Place these files in root:
- `google-services.json` (Android)
- `GoogleService-Info.plist` (iOS, in ios folder)

## Common Commands

| Task | Command | Notes |
|------|---------|-------|
| Start development | `npm start` | Interactive menu to choose platform |
| Run on Android | `npm run android` | Requires Android Studio |
| Run on iOS | `npm run ios` | Requires macOS + Xcode |
| Run on web | `npm run web` | Quick preview in browser |
| Run linter | `npm run lint` | Uses expo lint |
| Run tests | `npm test` | Jest with expo preset |
| Run single test | `npm test -- [test-file-path]` | e.g., `npm test -- __tests__/utils.test.ts` |
| Generate docs | `npm run docs:generate` | TypeDoc generates API docs |
| View docs locally | `npm run docs:dev` | Runs docs in watch mode |
| Build docs | `npm run docs:build` | Production docs build |
| Reset project | `npm run reset-project` | Node script to clean build artifacts |

## Project Architecture

### Directory Structure
```
src/
├── components/          # Reusable UI components
│   └── Tutorial/        # Interactive onboarding tutorial system
├── navigation/          # Navigation structure
│   └── screens/         # Main app screens (Home, TaskList, AISettings, etc.)
├── services/            # Business logic and API integration
├── contexts/            # React Context providers for global state
├── hooks/               # Custom React hooks
├── utils/               # Helper functions (animations, audio, events)
└── constants/           # App configuration and constants
```

### Core Architecture Layers

#### 1. **Authentication & Authorization** (`src/services/authService.ts`)
- Token-based authentication with refresh mechanism
- AsyncStorage persistence for user session
- JWT bearer token management with auto-refresh
- Google Sign-In integration via `googleSignInService.ts`

#### 2. **Data Sync & Offline Support** (`src/services/SyncManager.ts`)
- Implements SyncQueue pattern for handling offline operations
- Exponential backoff retry logic (1s → 5s → 15s → 60s)
- Event-driven sync status updates via `eventEmitter.ts`
- Offline-first architecture with automatic sync on network recovery
- Integrates with `TaskCacheService` for local persistence

#### 3. **Task Management** (`src/services/taskService.ts`)
- CRUD operations with optimistic updates
- Lazy-loading pattern for cache/sync services
- Category filtering and task categorization
- Integration with task cache and sync manager
- Task interface with backward compatibility for `category_name`/`category_id`

#### 4. **Caching Strategy** (`src/services/TaskCacheService.ts`)
- Singleton pattern for global cache instance
- In-memory + AsyncStorage dual-layer caching
- Change tracking for sync operations
- Automatic cache invalidation on sync

#### 5. **AI Chat & Voice** (`src/services/textBotService.ts`, `src/services/voiceBotService.ts`)
- La chat testuale è implementata in **`src/navigation/screens/Home.tsx`** (non esiste una schermata BotChat separata)
- Server-Sent Events (SSE) streaming per risposte in tempo reale via `textBotService.ts`
- Il tipo di modello (`'base'` | `'advanced'`) è salvato in AsyncStorage con chiave `'ai_model_tier'`
- `AISettings.tsx` permette di selezionare il modello; `Home.tsx` lo rilegge via `useFocusEffect` a ogni focus
- WebSocket support for voice interactions via `VoiceBotWebSocket` class in `voiceBotService.ts`
- Message validation and formatting utilities in `textBotService.ts`
- Structured data extraction from AI responses

#### 6. **Notifications** (`src/services/notificationService.ts`, `taskNotificationService.ts`)
- Expo Notifications integration
- Task-based reminder system
- Push notification scheduling

#### 7. **State Management**
- **React Context API** for global state (Authentication, Language, Tutorial)
- **AsyncStorage** for persistent local state
- **Event Emitters** for cross-service communication via `eventEmitter.ts`
- Custom hooks (`useAuth`, `useVoiceChat`, `useTutorial`, etc.) for component-level state

#### 8. **API Integration** (`src/services/axiosInstance.ts`, `axiosInterceptor.ts`)
- Axios instance with interceptors for auth token injection
- Automatic request/response transformation
- Error handling and retry logic
- Default base URL: `https://taskly-production.up.railway.app`

#### 9. **Google Integration**
- **Google Sign-In** via `@react-native-google-signin/google-signin`
- **Google Calendar Sync** via `googleCalendarService.ts`
- **Web Browser OAuth flow** for mobile Google login

#### 10. **Voice & Audio** (`src/utils/audioUtils.ts`)
- Custom Voice Activity Detection (VAD)
- Real-time audio streaming
- Microphone permissions handling via app.json

### Key Services Summary

| Service | Purpose | Key Methods |
|---------|---------|-------------|
| `taskService.ts` | Task CRUD operations | `getTasks()`, `addTask()`, `updateTask()`, `deleteTask()` |
| `SyncManager.ts` | Offline sync queue | `sync()`, `addToQueue()`, `getSyncStatus()` |
| `TaskCacheService.ts` | Local caching layer | `getCachedTasks()`, `updateCache()`, `clearCache()` |
| `botservice.ts` | AI chat & voice | `sendMessageToBot()`, `VoiceBotWebSocket` |
| `authService.ts` | Authentication | `getValidToken()`, `updateAuthData()`, `checkAndRefreshAuth()` |
| `googleSignInService.ts` | Google auth | `signInWithGoogle()`, `signOutFromGoogle()` |
| `googleCalendarService.ts` | Calendar sync | `syncCalendar()`, `getCalendarEvents()` |
| `notificationService.ts` | Push notifications | `scheduleTaskReminder()`, `cancelReminder()` |

## Important Development Patterns

### Singleton Services
Services like `SyncManager`, `TaskCacheService`, `StorageManager`, `NetworkService` use singleton pattern:
```typescript
static getInstance(): ClassName {
  if (!ClassName.instance) {
    ClassName.instance = new ClassName();
  }
  return ClassName.instance;
}
```

### Lazy Service Initialization
In `taskService.ts`, services are initialized lazily to avoid circular dependencies:
```typescript
let cacheService: TaskCacheService | null = null;
function getServices() {
  if (!cacheService) {
    cacheService = TaskCacheService.getInstance();
  }
  return { cacheService };
}
```

### Event-Driven Communication
Custom event emitter pattern (`src/utils/eventEmitter.ts`) for cross-module communication:
- `emitTaskAdded()`, `emitTaskUpdated()`, `emitTaskDeleted()`
- `emitTasksSynced()` for sync status updates
- Used for real-time UI updates without prop drilling

### Optimistic Updates
Task operations assume success immediately, with server confirmation afterward:
- `isOptimistic` flag in Task interface indicates pending operations
- Cache updates immediately, reverts on API failure
- Improves perceived performance in offline scenarios

## Expo-Specific Configuration

### Plugins (from app.json)
- `expo-av`: Audio/video support
- `expo-notifications`: Push notifications with adaptive icon
- `expo-splash-screen`: Custom splash with dark mode support
- `@react-native-google-signin/google-signin`: Google authentication
- `expo-dev-client`: Development client for custom native code
- `expo-router`: File-based routing (v5.1.7)

### Android Permissions (app.json)
```json
{
  "android.permission.RECORD_AUDIO": "For voice input",
  "android.permission.MODIFY_AUDIO_SETTINGS": "For audio control"
}
```

## Known Project Constraints

1. **Build Management**: Never run EAS builds autonomously. Always ask the user if EAS build is needed.
2. **Project Startup**: Do not start the project. The user runs it in a separate terminal.
3. **WSL Development**: For Linux/Mac-specific environments, use: `wsl -d Ubuntu`
4. **TypeScript Config**: Uses Expo's base config with `esModuleInterop: true` and `jsx: "react"`

## Testing Strategy

- Jest with expo preset (`jest-expo`)
- Unit tests for utilities and services
- Component tests for UI components
- Use `npm test` for watch mode, specify file path for single test

## Linting & Code Quality

- ESLint with Expo config (`eslint-config-expo`)
- Run `npm run lint` before committing
- TypeScript strict type checking enabled

## Documentation

Generated via TypeDoc with markdown plugin:
- Run `npm run docs:generate` to rebuild API docs
- Docs are output to the `docs/` directory
- Website version runs with `npm run docs:dev`

## Integration Points

### Backend API
- Base URL: `https://taskly-production.up.railway.app`
- Authentication: Bearer token in Authorization header
- Streaming responses: SSE for chat/text endpoints

### Google Services
- OAuth 2.0 for sign-in and calendar access
- URL scheme: `com.googleusercontent.apps.643213673162-7lk71d5c0ov3703qo5c8mrcfsqipdjlp` (iOS)

### Local Storage
- AsyncStorage for persistent data
- Keys defined in `src/constants/authConstants.ts`
- User data, tokens, and app state stored locally

## Common Troubleshooting

- **Token expired**: `checkAndRefreshAuth()` automatically handles refresh
- **Sync stuck**: Check `NetworkService` connection status via `SyncManager.getSyncStatus()`
- **Cache stale**: Manually trigger `SyncManager.sync()` or clear cache
- **Audio issues**: Check permissions in app.json and device settings
- **Google auth fails**: Verify `google-services.json` and iOS URL scheme are correctly configured
