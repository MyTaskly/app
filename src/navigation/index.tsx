import React, { useEffect, useState } from "react";
import {
  NavigationContainer,
  useNavigation,
  NavigationProp,
} from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { AppState, BackHandler, Linking } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { Ionicons } from "@expo/vector-icons";
import {
  initAnalytics,
  trackScreenView,
  trackSessionStart,
  trackSessionEnd,
  trackError,
} from "../services/analyticsService";
import WelcomeCarouselScreen from "./screens/WelcomeCarousel";
import LoginScreen from "./screens/Login";
import RegisterScreen from "./screens/Register";
import EmailVerificationScreen from "./screens/EmailVerification";
import VerificationSuccessScreen from "./screens/VerificationSuccess";
import HomeScreen from "./screens/Home";
import TaskListScreen from "./screens/TaskList";
import CategoriesScreen from "./screens/Categories";
import ProfileScreen from "./screens/Profile";
import NotesScreen from "./screens/Notes";
import SettingsScreen from "./screens/Settings";
import AccountSettingsScreen from "./screens/AccountSettings";
import ChangePasswordScreen from "./screens/ChangePassword";
import HelpScreen from "./screens/Help";
import AboutScreen from "./screens/About";
import LanguageScreen from "./screens/Language";
import VoiceSettingsScreen from "./screens/VoiceSettings";
import GoogleCalendarScreen from "./screens/GoogleCalendar";
import NotificationSettingsScreen from "./screens/NotificationSettings";
import MemorySettingsScreen from "./screens/MemorySettings";
import CalendarScreen from "./screens/Calendar";
import NotificationDebugScreen from "./screens/NotificationDebug";
import BugReportScreen from "./screens/BugReport";
//import StatisticsScreen from "./screens/Statistics";
import { NotFound as NotFoundScreen } from "./screens/NotFound";
import eventEmitter, { emitScreenChange, EVENTS } from "../utils/eventEmitter";
import { useNotifications } from "../services/notificationService";
import AppInitializer from "../services/AppInitializer";
import { syncAllData } from "../services/taskService";
import { handleGoogleLoginSuccess, handleGoogleLoginError } from "../services/googleSignInService";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { STORAGE_KEYS } from "../constants/authConstants";
import { TutorialProvider, useTutorialContext } from "../contexts/TutorialContext";
import { TutorialOnboarding } from "../components/Tutorial/exports";
import { LanguageProvider } from "../contexts/LanguageContext";
import "../services/i18n"; // Initialize i18n
import { useTranslation } from 'react-i18next';
import PermissionModal from "../components/UI/PermissionModal";

// Definizione del tipo per le route dello Stack principale
export type RootStackParamList = {
  WelcomeCarousel: undefined;
  Login: undefined;
  Register: undefined;
  EmailVerification: { email: string; username: string; password: string };
  VerificationSuccess: { email: string; username: string; password: string };
  HomeTabs: undefined; // Contiene il Tab Navigator
  Home20: undefined; // Nuova schermata Home2.0
  TaskList: { category_name: number | string };
  Profile: undefined;
  Settings: undefined;
  AccountSettings: undefined;
  ChangePassword: undefined;
  Help: undefined;
  About: undefined;
  Language: undefined;
  VoiceSettings: undefined;
  GoogleCalendar: undefined;
  NotificationDebug: undefined;
  BugReport: undefined;
  CalendarWidgetDemo: undefined;
  Statistics: undefined;
  Updates: undefined;
  NotFound: undefined;
  NotificationSettings: undefined;
  MemorySettings: undefined;
};

// Definizione del tipo per le route dei Tab
export type TabParamList = {
  Home: undefined;
  Categories: undefined;
  Notes: undefined;
  Calendar: undefined;
  Statistics: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

// Tab Navigator per le schermate principali
function HomeTabs() {
  const { t } = useTranslation();

  return (
    <>
      <Tab.Navigator
        id={undefined}
        screenOptions={({ route }) => ({
          tabBarIcon: ({ focused, color, size }) => {
            let iconName: keyof typeof Ionicons.glyphMap;

            switch (route.name) {
              case "Home":
                iconName = focused ? "home" : "home-outline";
                break;
              case "Categories":
                iconName = focused ? "grid" : "grid-outline";
                break;
              case "Notes":
                iconName = focused ? "document-text" : "document-text-outline";
                break;
              case "Calendar":
                iconName = focused ? "calendar" : "calendar-outline";
                break;
              case "Statistics":
                iconName = focused ? "stats-chart" : "stats-chart-outline";
                break;
              default:
                iconName = "home-outline";
            }

            return <Ionicons name={iconName} size={size} color={color} />;
          },
          tabBarActiveTintColor: "#007AFF",
          tabBarInactiveTintColor: "gray",
          headerShown: false,
        })}
      >
        <Tab.Screen
          name="Home"
          component={HomeScreen}
          options={{ title: t('navigation.tabs.home') }}
        />
        {/* Categories tab disabled */}
        <Tab.Screen
          name="Categories"
          component={CategoriesScreen}
          options={{ title: t('navigation.tabs.categories') }}
        />
        <Tab.Screen
          name="Notes"
          component={NotesScreen}
          options={{ title: t('navigation.tabs.notes') }}
        />
        <Tab.Screen
          name="Calendar"
          component={CalendarScreen}
          options={{ title: t('navigation.tabs.calendar') }}
        />
        {/* <Tab.Screen
          name="Statistics"
          component={StatisticsScreen}
          options={{ title: t('navigation.tabs.statistics') }}
        /> */}
      </Tab.Navigator>
    </>
  );
}
// Componente interno che gestisce l'event emitter
function NavigationHandler() {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();

  useEffect(() => {
    const handleLogout = () => {
      navigation.navigate("Login");
    };

    const handleBackPress = () => {
      const currentRoute =
        navigation.getState()?.routes[navigation.getState()?.index || 0]?.name;

      // Se siamo sulla schermata di Login, chiudi l'app
      if (currentRoute === "Login") {
        BackHandler.exitApp();
        return true; // Previene il comportamento di default
      }

      return false; // Lascia che React Navigation gestisca il back button
    };

    // Listener per sincronizzazione automatica al cambio schermata
    const handleScreenChange = async ({ screenName, params }) => {
      console.log(`[NAVIGATION] 🔄 Cambio schermata rilevato: ${screenName}`);

      // Avvia sincronizzazione asincrona (non bloccante)
      syncAllData()
        .then(({ tasks, categories }) => {
          console.log(`[NAVIGATION] ✅ Sincronizzazione automatica completata per ${screenName}: ${tasks.length} task, ${categories.length} categorie`);
        })
        .catch((error) => {
          console.log(`[NAVIGATION] ⚠️ Sincronizzazione fallita per ${screenName}:`, error.message);
        });
    };

    eventEmitter.on("logoutSuccess", handleLogout);
    eventEmitter.on(EVENTS.SCREEN_CHANGE, handleScreenChange);
    const backHandler = BackHandler.addEventListener(
      "hardwareBackPress",
      handleBackPress
    );

    return () => {
      eventEmitter.off("logoutSuccess", handleLogout);
      eventEmitter.off(EVENTS.SCREEN_CHANGE, handleScreenChange);
      backHandler.remove();
    };
  }, [navigation]);

  // Monitora i cambi di stato della navigazione per emettere eventi
  useEffect(() => {
    const unsubscribe = navigation.addListener('state', (e) => {
      const state = e.data.state;
      if (state) {
        const currentRoute = state.routes[state.index];
        if (currentRoute) {
          console.log(`[NAVIGATION] 📱 Navigazione verso: ${currentRoute.name}`);
          emitScreenChange(currentRoute.name, currentRoute.params);
          // ── Analytics: traccia navigazione ──
          trackScreenView(currentRoute.name);
        }
      }
    });

    return unsubscribe;
  }, [navigation]);

  return null;
}

// Stack Navigator separato con controllo autenticazione
function AppStack() {
  const { t } = useTranslation();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [hasSeenWelcome, setHasSeenWelcome] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true); // Controlla lo stato di autenticazione all'avvio
  const { triggerPostLoginTutorial } = useTutorialContext();

  // 🔔 Inizializza il sistema di notifiche quando l'utente è autenticato
  const {
    notification,
    showNotificationPrompt,
    showBatteryPrompt,
    handleNotificationAccept,
    handleNotificationDismiss,
    handleBatteryAccept,
    handleBatteryDismiss,
  } = useNotifications();

  useEffect(() => {
    const checkAuthStatus = async () => {
      try {
        // Inizializza l'app prima di tutto
        const appInitializer = AppInitializer.getInstance();
        await appInitializer.initialize();

        // Importa la funzione di controllo e refresh automatico
        const { checkAndRefreshAuth } = await import("../services/authService");
        const authResult = await checkAndRefreshAuth();

        if (authResult.isAuthenticated) {
          console.log(authResult.message);
        } else {
          console.log(authResult.message);
        }

        setIsAuthenticated(authResult.isAuthenticated);

        // Check if user has seen welcome carousel
        const welcomeCompleted = await AsyncStorage.getItem(
          STORAGE_KEYS.WELCOME_CAROUSEL_COMPLETED
        );
        setHasSeenWelcome(welcomeCompleted === 'true');
      } catch (error) {
        console.error("Errore nel controllo autenticazione:", error);
        setIsAuthenticated(false);
        setHasSeenWelcome(false);
      } finally {
        setIsLoading(false);
      }
    };

    checkAuthStatus();
  }, []);

  // Handle deep links for Google login
  useEffect(() => {
    const handleDeepLink = async (url: string) => {
      console.log('🔗 Deep link received:', url);

      try {
        // Parse URL to check if it's a Google login callback
        const parsedUrl = new URL(url);

        if (parsedUrl.pathname.includes('/login/success')) {
          console.log('✅ Processing Google login success...');

          const result = await handleGoogleLoginSuccess(url);

          if (result.success) {
            // Reset suggested command for new user
            await AsyncStorage.setItem(STORAGE_KEYS.SUGGESTED_COMMAND_SHOWN, 'false');

            console.log('✅ Google login completed successfully');
            setIsAuthenticated(true);
            eventEmitter.emit("loginSuccess");
          } else {
            console.error('❌ Google login success processing failed:', result.message);
          }

        } else if (parsedUrl.pathname.includes('/login') && parsedUrl.searchParams.has('error')) {
          console.log('❌ Processing Google login error...');

          const result = handleGoogleLoginError(url);
          console.error('Google login error:', result.message);

        }
      } catch (error) {
        console.error('❌ Error processing deep link:', error);
      }
    };

    // Listen for deep links
    const linkingSubscription = Linking.addEventListener('url', ({ url }) => {
      handleDeepLink(url);
    });

    // Check if app was opened with a deep link
    Linking.getInitialURL().then((url) => {
      if (url) {
        handleDeepLink(url);
      }
    });

    return () => {
      linkingSubscription?.remove();
    };
  }, []);

  // Listener per eventi di login/logout
  useEffect(() => {
    const handleLoginSuccess = () => {
      setIsAuthenticated(true);
      triggerPostLoginTutorial();
    };

    const handleLogoutSuccess = () => {
      setIsAuthenticated(false);
    };

    eventEmitter.on("loginSuccess", handleLoginSuccess);
    eventEmitter.on("logoutSuccess", handleLogoutSuccess);

    return () => {
      eventEmitter.off("loginSuccess", handleLoginSuccess);
      eventEmitter.off("logoutSuccess", handleLogoutSuccess);
    };
  }, []);

  // Mostra un loading screen mentre controlla l'autenticazione
  if (isLoading) {
    return null; // O un componente di loading se preferisci
  }

  // Determine initial route based on authentication and welcome carousel status
  const getInitialRoute = () => {
    // TEMPORARY: Force Welcome Screen for testing

    if (isAuthenticated) return "HomeTabs";
    if (!hasSeenWelcome) return "WelcomeCarousel";
    return "Login";
  };

  const initialRoute = getInitialRoute();

  return (
    <>
      <NavigationHandler />
      <PermissionModal
        visible={showNotificationPrompt}
        icon="notifications-outline"
        title={t('notifications.enablePrompt.title')}
        message={t('notifications.enablePrompt.message')}
        primaryLabel={t('notifications.enablePrompt.enable')}
        secondaryLabel={t('notifications.enablePrompt.later')}
        onPrimary={handleNotificationAccept}
        onSecondary={handleNotificationDismiss}
      />
      <PermissionModal
        visible={showBatteryPrompt}
        icon="battery-half-outline"
        title={t('notifications.batteryPrompt.title')}
        message={t('notifications.batteryPrompt.message')}
        primaryLabel={t('notifications.batteryPrompt.openSettings')}
        secondaryLabel={t('notifications.batteryPrompt.skip')}
        badge={t('notifications.batteryPrompt.badge')}
        onPrimary={handleBatteryAccept}
        onSecondary={handleBatteryDismiss}
      />
      <Stack.Navigator id={undefined} initialRouteName={initialRoute}>
        <Stack.Screen
          name="WelcomeCarousel"
          component={WelcomeCarouselScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Login"
          component={LoginScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Register"
          component={RegisterScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="EmailVerification"
          component={EmailVerificationScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="VerificationSuccess"
          component={VerificationSuccessScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="HomeTabs"
          component={HomeTabs}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="TaskList"
          component={TaskListScreen}
          options={{ title: t('navigation.screens.taskList') }}
        />
        <Stack.Screen
          name="Profile"
          component={ProfileScreen}
          options={{ title: t('navigation.screens.profile') }}
        />
        <Stack.Screen
          name="Settings"
          component={SettingsScreen}
          options={{ title: t('navigation.screens.settings') }}
        />
        <Stack.Screen
          name="AccountSettings"
          component={AccountSettingsScreen}
          options={{ title: t('navigation.screens.accountSettings') }}
        />
        <Stack.Screen
          name="ChangePassword"
          component={ChangePasswordScreen}
          options={{ title: t('navigation.screens.changePassword') }}
        />
        <Stack.Screen
          name="Help"
          component={HelpScreen}
          options={{ title: t('navigation.screens.help') }}
        />
        <Stack.Screen
          name="About"
          component={AboutScreen}
          options={{ title: t('navigation.screens.about') }}
        />
        <Stack.Screen
          name="Language"
          component={LanguageScreen}
          options={{ title: t('navigation.screens.language') }}
        />
        <Stack.Screen
          name="VoiceSettings"
          component={VoiceSettingsScreen}
          options={{ title: t('navigation.screens.voiceSettings') }}
        />
        <Stack.Screen
          name="GoogleCalendar"
          component={GoogleCalendarScreen}
          options={{ title: t('navigation.screens.googleCalendar') }}
        />
        <Stack.Screen
          name="NotificationDebug"
          component={NotificationDebugScreen}
          options={{ title: t('navigation.screens.notificationDebug') }}
        />
        <Stack.Screen
          name="NotificationSettings"
          component={NotificationSettingsScreen}
          options={{ title: t('navigation.screens.notificationSettings') }}
        />
        <Stack.Screen
          name="BugReport"
          component={BugReportScreen}
          options={{ title: t('navigation.screens.bugReport') }}
        />
        <Stack.Screen
          name="MemorySettings"
          component={MemorySettingsScreen}
          options={{ title: t('navigation.screens.memorySettings') }}
        />
        <Stack.Screen name="NotFound" component={NotFoundScreen} />
      </Stack.Navigator>
    </>
  );
}

// Componente principale Navigation
export default function Navigation() {
  // ── Analytics: inizializza Vexo e traccia sessione ──
  useEffect(() => {
    initAnalytics().then(() => {
      trackSessionStart();
    });
  }, []);

  // ── Analytics: traccia sessione via AppState ──
  useEffect(() => {

    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        trackSessionStart();
      } else if (nextState === "background" || nextState === "inactive") {
        trackSessionEnd();
      }
    });

    return () => {
      trackSessionEnd();
      subscription.remove();
    };
  }, []);

  // ── Analytics: cattura errori JS non gestiti ──
  useEffect(() => {
    const originalHandler = ErrorUtils.getGlobalHandler();
    ErrorUtils.setGlobalHandler((error: Error, isFatal?: boolean) => {
      trackError(error?.message ?? "Unknown error", "global", isFatal ?? false);
      originalHandler(error, isFatal);
    });
    return () => {
      ErrorUtils.setGlobalHandler(originalHandler);
    };
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <LanguageProvider>
        <TutorialProvider>
          <NavigationContainer>
            <AppStack />
          </NavigationContainer>
          <TutorialOnboardingWrapper />
        </TutorialProvider>
      </LanguageProvider>
    </GestureHandlerRootView>
  );
}

// Wrapper that connects TutorialOnboarding to the TutorialContext
function TutorialOnboardingWrapper() {
  const { isTutorialVisible, closeTutorial, skipTutorial } = useTutorialContext();

  return (
    <TutorialOnboarding
      visible={isTutorialVisible}
      onComplete={closeTutorial}
      onSkip={skipTutorial}
    />
  );
}
