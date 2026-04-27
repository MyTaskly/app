import React from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  AppState,
  Image,
  Animated,
  ScrollView,
} from "react-native";
import { FontAwesome } from "@expo/vector-icons";
import * as authService from "../../services/authService";
import { useNavigation, NavigationProp } from "@react-navigation/native";
import { RootStackParamList } from "../../types";
import eventEmitter from "../../utils/eventEmitter";
import { initiateGoogleLogin } from "../../services/googleSignInService";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { STORAGE_KEYS } from "../../constants/authConstants";
import { NotificationSnackbar } from "../../components/UI/NotificationSnackbar";
import { useTranslation } from "react-i18next";
import {
  trackLoginSuccess,
  trackLoginFailed,
  identifyUser,
} from "../../services/analyticsService";
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

const { width, height } = Dimensions.get("window");

// Singolo blob animato – semplice, solo scala
const Blob = ({
  size,
  top,
  left,
  right,
  bottom,
  opacity,
  delay = 0,
}: {
  size: number;
  opacity: number;
  delay?: number;
  top?: number;
  left?: number;
  right?: number;
  bottom?: number;
}) => {
  const anim = React.useRef(new Animated.Value(1)).current;

  React.useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(anim, { toValue: 1.1, duration: 4000, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 1,   duration: 4000, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: "absolute",
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: "#000000",
        opacity,
        top,
        left,
        right,
        bottom,
        transform: [{ scale: anim }],
      }}
    />
  );
};

const LoginScreen = () => {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const { t } = useTranslation();

  const [username, setUsername] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [loginSuccess, setLoginSuccess] = React.useState(false);
  const [failedAttempts, setFailedAttempts] = React.useState(0);
  const [isBlocked, setIsBlocked] = React.useState(false);
  const [showBlockMessage, setShowBlockMessage] = React.useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = React.useState(false);
  const [notification, setNotification] = React.useState({
    isVisible: false,
    message: "",
    isSuccess: true,
    onFinish: () => {},
  });

  React.useEffect(() => {
    if (loginSuccess) {
      const timer = setTimeout(() => {
        navigation.reset({
          index: 0,
          routes: [{ name: "HomeTabs" }],
        });
        setLoginSuccess(false);
      }, 3500);
      return () => clearTimeout(timer);
    }
  }, [loginSuccess, navigation]);

  const containsSpecialChars = (text: string) => {
    const specialCharsRegex = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]+/;
    return specialCharsRegex.test(text);
  };

  const handleUsernameChange = (text: string) => {
    const trimmedText = text.trim();
    if (containsSpecialChars(trimmedText)) {
      showNotification(t("errors.validation"), false);
      return;
    }
    setUsername(trimmedText);
  };

  const handlePasswordChange = (text: string) => {
    setPassword(text.trim());
  };

  const showNotification = React.useCallback(
    (message: string, isSuccess: boolean) => {
      setNotification({ isVisible: false, message: "", isSuccess: true, onFinish: () => {} });
      setTimeout(() => {
        setNotification({
          isVisible: true,
          message,
          isSuccess,
          onFinish: () =>
            setNotification({ isVisible: false, message: "", isSuccess: true, onFinish: () => {} }),
        });
      }, 100);
    },
    []
  );

  async function handleGoogleSignIn() {
    try {
      setIsGoogleLoading(true);
      const result = await initiateGoogleLogin();
      if (result.success) {
        await AsyncStorage.setItem(STORAGE_KEYS.SUGGESTED_COMMAND_SHOWN, "false");
        setLoginSuccess(true);
        eventEmitter.emit("loginSuccess");
        trackLoginSuccess("google");
        showNotification(t("auth.messages.loginSuccess"), true);
      } else {
        trackLoginFailed("google", result.message ?? "initiation_failed");
        showNotification(result.message || "Errore durante l'avvio del login con Google.", false);
      }
    } catch (error: any) {
      trackLoginFailed("google", error?.message ?? "exception");
      showNotification("Errore durante l'avvio del login con Google. Riprova più tardi.", false);
    } finally {
      setIsGoogleLoading(false);
    }
  }

  async function handleLogin() {
    try {
      if (containsSpecialChars(username)) {
        showNotification("Lo username non può contenere caratteri speciali", false);
        return;
      }
      const login_data = await authService.login(username, password);
      if (login_data.success) {
        await AsyncStorage.setItem(STORAGE_KEYS.SUGGESTED_COMMAND_SHOWN, "false");
        setLoginSuccess(true);
        eventEmitter.emit("loginSuccess");
        trackLoginSuccess("email");
        showNotification(t("auth.messages.loginSuccess"), true);
      } else if (login_data.requiresEmailVerification) {
        showNotification(
          login_data.message || "Email non verificata. Verifica la tua email prima di effettuare il login.",
          false
        );
        setTimeout(() => {
          navigation.navigate("EmailVerification", {
            email: login_data.email || "",
            username: login_data.username || username,
            password,
          });
        }, 2000);
      } else {
        handleFailedLogin();
        let errorMessage = "Username o password errati.";
        if (login_data.error?.response) {
          const status = login_data.error.response.status;
          const detail = login_data.error.response.data?.detail;
          if (status === 401) {
            errorMessage =
              detail === "Invalid username or password"
                ? "Credenziali non valide. Verifica username e password o prova ad accedere con Google se hai usato l'autenticazione OAuth."
                : "Credenziali non valide.";
          } else if (status === 403) {
            errorMessage =
              detail === "Email not verified"
                ? "Email non verificata. Controlla la tua casella di posta per il link di verifica."
                : "Accesso negato. Verifica il tuo account.";
          } else {
            errorMessage = login_data.message || "Errore durante il login.";
          }
        } else {
          errorMessage = login_data.message || "Username o password errati.";
        }
        showNotification(errorMessage, false);
      }
    } catch (error) {
      let errorMessage = "Errore durante il login. Riprova più tardi.";
      if (error instanceof Error && (error as any).response) {
        const status = (error as any).response.status;
        const detail = (error as any).response.data?.detail;
        if (status === 401) {
          errorMessage =
            detail === "Invalid username or password"
              ? "Credenziali non valide. Verifica username e password o prova ad accedere con Google se hai usato l'autenticazione OAuth."
              : "Credenziali non valide.";
        } else if (status === 403) {
          errorMessage =
            detail === "Email not verified"
              ? "Email non verificata. Controlla la tua casella di posta per il link di verifica."
              : "Accesso negato. Verifica il tuo account.";
        }
      }
      handleFailedLogin();
      showNotification(errorMessage, false);
    }
  }

  const handleFailedLogin = () => {
    const newAttempts = failedAttempts + 1;
    setFailedAttempts(newAttempts);
    trackLoginFailed("email");
    if (newAttempts >= 3) {
      setShowBlockMessage(true);
      setTimeout(() => {
        setIsBlocked(true);
        AppState.addEventListener("change", () => {});
      }, 5000);
    }
  };

  const togglePasswordVisibility = () => setShowPassword(!showPassword);

  if (isBlocked) {
    return (
      <View style={styles.blockedContainer}>
        <Text style={styles.blockedText}>App bloccata per troppi tentativi di login.</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />

      {/* Blob di sfondo – fuori dal layout, posizione assoluta */}
      <Blob size={340} opacity={0.13} delay={0}    top={-120} left={-130} />
      <Blob size={260} opacity={0.10} delay={1000} top={-60}  right={-100} />
      <Blob size={220} opacity={0.12} delay={500}  bottom={60} left={-90} />
      <Blob size={300} opacity={0.09} delay={1500} bottom={-80} right={-110} />

      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
          {/* Logo */}
          <Image
            source={require("../../../assets/icons/adaptive-icon.png")}
            style={styles.logo}
          />

          {/* Inputs */}
          <View style={styles.inputRow}>
            <FontAwesome name="user" size={17} color="#999" style={styles.icon} />
            <TextInput
              value={username}
              onChangeText={handleUsernameChange}
              placeholder={t("auth.login.username")}
              placeholderTextColor="#BBBBBB"
              style={styles.input}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={styles.inputRow}>
            <FontAwesome name="lock" size={17} color="#999" style={styles.icon} />
            <TextInput
              value={password}
              onChangeText={handlePasswordChange}
              placeholder={t("auth.login.password")}
              placeholderTextColor="#BBBBBB"
              style={styles.input}
              secureTextEntry={!showPassword}
            />
            <TouchableOpacity onPress={togglePasswordVisibility} style={styles.eyeBtn}>
              <FontAwesome
                name={showPassword ? "eye" : "eye-slash"}
                size={17}
                color="#BBBBBB"
              />
            </TouchableOpacity>
          </View>

          {/* Login */}
          <TouchableOpacity style={styles.loginBtn} onPress={handleLogin} activeOpacity={0.85}>
            <Text style={styles.loginBtnText}>{t("auth.login.loginNow")}</Text>
          </TouchableOpacity>

          {/* Divider */}
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerLabel}>o</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Google */}
          <TouchableOpacity
            style={[styles.googleBtn, isGoogleLoading && styles.disabled]}
            onPress={handleGoogleSignIn}
            disabled={isGoogleLoading}
            activeOpacity={0.85}
          >
            <View style={styles.googleBadge}>
              <Text style={styles.googleBadgeText}>{isGoogleLoading ? "…" : "G"}</Text>
            </View>
            <Text style={styles.googleBtnText}>
              {isGoogleLoading ? t("auth.login.signingIn") : t("auth.login.continueWithGoogle")}
            </Text>
          </TouchableOpacity>

          {/* Sign up */}
          <View style={styles.signUpRow}>
            <Text style={styles.signUpLabel}>{t("auth.login.notMember")} </Text>
            <TouchableOpacity onPress={() => navigation.navigate("Register")} activeOpacity={0.7}>
              <Text style={styles.signUpLink}>{t("auth.login.createAccount")}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>

      <NotificationSnackbar
        isVisible={showBlockMessage || notification.isVisible}
        message={
          showBlockMessage
            ? "Troppi tentativi falliti. L'app si bloccherà tra 5 secondi."
            : notification.message
        }
        isSuccess={showBlockMessage ? false : notification.isSuccess}
        onFinish={showBlockMessage ? () => {} : notification.onFinish}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ffffff",
    overflow: "hidden",
  },
  scroll: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: width * 0.07,
    paddingVertical: 48,
  },

  // Logo
  logo: {
    width: 96,
    height: 96,
    borderRadius: 24,
    resizeMode: "contain",
    marginBottom: 48,
  },

  // Inputs
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    borderBottomWidth: 1,
    borderBottomColor: "#E8E8E8",
    marginBottom: 24,
    paddingBottom: 10,
  },
  icon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: "#111111",
    fontFamily: "System",
    paddingVertical: 6,
    minHeight: 36,
  },
  eyeBtn: {
    padding: 4,
  },

  // Login button
  loginBtn: {
    width: "100%",
    backgroundColor: "#000000",
    paddingVertical: 17,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 8,
    marginBottom: 28,
  },
  loginBtnText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
    letterSpacing: 0.3,
    fontFamily: "System",
  },

  // Divider
  divider: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    marginBottom: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#EEEEEE",
  },
  dividerLabel: {
    marginHorizontal: 14,
    color: "#CCCCCC",
    fontSize: 13,
    fontFamily: "System",
  },

  // Google button
  googleBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    paddingVertical: 15,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E8E8E8",
    marginBottom: 40,
  },
  googleBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#4285F4",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  googleBadgeText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "bold",
  },
  googleBtnText: {
    color: "#111111",
    fontSize: 15,
    fontWeight: "500",
    fontFamily: "System",
  },
  disabled: {
    opacity: 0.45,
  },

  // Sign up
  signUpRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  signUpLabel: {
    color: "#AAAAAA",
    fontSize: 14,
    fontFamily: "System",
  },
  signUpLink: {
    color: "#000000",
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "System",
  },

  // Blocked
  blockedContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#ff0000",
  },
  blockedText: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "bold",
    textAlign: "center",
  },
});

export default LoginScreen;
