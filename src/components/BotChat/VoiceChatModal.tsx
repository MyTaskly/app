import React, { useRef, useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Animated,
  Dimensions,
  StatusBar,
  Alert,
  Platform,
  ScrollView,
} from "react-native";
import Svg, { Path, Defs, RadialGradient, Stop } from "react-native-svg";
import { Ionicons } from "@expo/vector-icons";
import { useVoiceChat, ActiveTool } from '../../hooks/useVoiceChat';


export interface VoiceChatModalProps {
  visible: boolean;
  onClose: () => void;
  isRecording?: boolean;
}

const { height, width } = Dimensions.get("window");
const BLOB_SIZE = Math.min(width, height) * 0.62;
const CENTER = BLOB_SIZE / 2;
const BASE_RADIUS = BLOB_SIZE * 0.32;
const NUM_POINTS = 12;

// Fase e frequenza fissa per ogni punto — non cambiano mai
const POINT_PHASES = Array.from({ length: NUM_POINTS }, (_, i) => (i / NUM_POINTS) * Math.PI * 2);
const POINT_FREQS  = Array.from({ length: NUM_POINTS }, (_, i) => 0.55 + i * 0.12);
const POINT_FREQS2 = Array.from({ length: NUM_POINTS }, (_, i) => 0.31 + i * 0.09);

/** Costruisce un path SVG organico da offset radiali con curve catmull-rom → cubic bezier */
function buildBlobPath(center: number, baseRadius: number, offsets: number[]): string {
  const n = offsets.length;
  const angleStep = (Math.PI * 2) / n;
  const tension = 0.38;

  const pts = offsets.map((off, i) => {
    const angle = i * angleStep - Math.PI / 2;
    const r = baseRadius + off;
    return { x: center + r * Math.cos(angle), y: center + r * Math.sin(angle) };
  });

  let d = `M ${pts[0].x} ${pts[0].y} `;
  for (let i = 0; i < n; i++) {
    const prev  = pts[(i - 1 + n) % n];
    const curr  = pts[i];
    const next  = pts[(i + 1) % n];
    const next2 = pts[(i + 2) % n];
    const cp1x = curr.x + (next.x - prev.x) * tension;
    const cp1y = curr.y + (next.y - prev.y) * tension;
    const cp2x = next.x - (next2.x - curr.x) * tension;
    const cp2y = next.y - (next2.y - curr.y) * tension;
    d += `C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${next.x} ${next.y} `;
  }
  return d + "Z";
}

/** Easing cubico in-out per transizioni morbide */
function easeInOut(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/** Parametri target per ogni stato */
function getTargetParams(state: string, isProcessing: boolean, isSpeaking: boolean, isRecording: boolean) {
  if (state === 'error')       return { amplitude: BASE_RADIUS * 0.06, freqMult: 0.5,  glowOpacity: 0.15 };
  if (isSpeaking)              return { amplitude: BASE_RADIUS * 0.26, freqMult: 2.2,  glowOpacity: 0.60 };
  if (isProcessing)            return { amplitude: BASE_RADIUS * 0.20, freqMult: 1.8,  glowOpacity: 0.45 };
  if (isRecording)             return { amplitude: BASE_RADIUS * 0.14, freqMult: 1.3,  glowOpacity: 0.30 };
  if (state === 'connecting' ||
      state === 'authenticating' ||
      state === 'setting_up')  return { amplitude: BASE_RADIUS * 0.09, freqMult: 0.9,  glowOpacity: 0.20 };
  // ready / idle
  return                              { amplitude: BASE_RADIUS * 0.045, freqMult: 0.55, glowOpacity: 0.10 };
}

// Componente blob SVG animato
interface AnimatedBlobProps {
  state: string;
  isProcessing: boolean;
  isSpeaking: boolean;
  isRecording: boolean;
}

const TRANSITION_DURATION = 1.2; // secondi per interpolare tra due stati

const AnimatedBlob: React.FC<AnimatedBlobProps> = ({ state, isProcessing, isSpeaking, isRecording }) => {
  const [blobPath, setBlobPath] = useState(() =>
    buildBlobPath(CENTER, BASE_RADIUS, Array(NUM_POINTS).fill(0))
  );

  // ── Ref per il loop RAF — nessun restart al cambio stato ──
  const frameRef      = useRef<number | null>(null);
  const startTimeRef  = useRef<number | null>(null);

  // Parametri "correnti" interpolati (cambiano ogni frame)
  const currentAmplRef   = useRef(BASE_RADIUS * 0.045);
  const currentFreqRef   = useRef(0.55);
  const currentGlowRef   = useRef(0.10);

  // Parametri target (aggiornati al cambio stato senza fermare il loop)
  const targetParamsRef  = useRef(getTargetParams(state, isProcessing, isSpeaking, isRecording));
  const transStartRef    = useRef<number | null>(null);  // ms in cui è iniziata la transizione
  const transFromRef     = useRef({ amplitude: currentAmplRef.current, freqMult: currentFreqRef.current, glowOpacity: currentGlowRef.current });

  // Animated.Value per glow (non-native-driver), aggiornato dal loop
  const glowValue = useRef(new Animated.Value(0.10)).current;

  // Aggiorna target senza interrompere il loop
  useEffect(() => {
    const newTarget = getTargetParams(state, isProcessing, isSpeaking, isRecording);
    targetParamsRef.current = newTarget;
    // Salva il "da" come valori correnti al momento del cambio
    transFromRef.current = {
      amplitude:   currentAmplRef.current,
      freqMult:    currentFreqRef.current,
      glowOpacity: currentGlowRef.current,
    };
    transStartRef.current = null; // verrà impostato al prossimo frame
  }, [state, isProcessing, isSpeaking, isRecording]);

  // Loop RAF unico, avviato una sola volta al mount
  useEffect(() => {
    const animate = (timestamp: number) => {
      if (!startTimeRef.current) startTimeRef.current = timestamp;
      const elapsed = (timestamp - startTimeRef.current) / 1000; // secondi

      // Inizializza il timer di transizione al primo frame dopo un cambio stato
      if (transStartRef.current === null) {
        transStartRef.current = timestamp;
        transFromRef.current = {
          amplitude:   currentAmplRef.current,
          freqMult:    currentFreqRef.current,
          glowOpacity: currentGlowRef.current,
        };
      }

      // Progresso transizione [0, 1]
      const transElapsed = (timestamp - transStartRef.current) / 1000;
      const rawT  = Math.min(transElapsed / TRANSITION_DURATION, 1);
      const t     = easeInOut(rawT);

      const from   = transFromRef.current;
      const target = targetParamsRef.current;

      // Interpola dolcemente
      currentAmplRef.current  = from.amplitude   + (target.amplitude   - from.amplitude)   * t;
      currentFreqRef.current  = from.freqMult     + (target.freqMult    - from.freqMult)    * t;
      currentGlowRef.current  = from.glowOpacity  + (target.glowOpacity - from.glowOpacity) * t;

      // Aggiorna glow (Animated.Value non-native)
      glowValue.setValue(currentGlowRef.current);

      // Calcola offset perimetro con parametri interpolati
      const offsets = POINT_PHASES.map((phase, i) => {
        const f1 = POINT_FREQS[i]  * currentFreqRef.current;
        const f2 = POINT_FREQS2[i] * currentFreqRef.current;
        return (
          currentAmplRef.current * Math.sin(elapsed * f1 + phase) +
          currentAmplRef.current * 0.42 * Math.sin(elapsed * f2 + phase * 0.75)
        );
      });

      setBlobPath(buildBlobPath(CENTER, BASE_RADIUS, offsets));
      frameRef.current = requestAnimationFrame(animate);
    };

    frameRef.current = requestAnimationFrame(animate);
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, []); // dipendenze vuote: il loop non si resetta mai

  // Colori statici per stato (non animati — cambiano insieme al testo)
  const getColors = () => {
    if (state === 'error')  return { inner: "#FF453A", outer: "#FF6B6B", glow: "#FF453A" };
    if (isSpeaking)         return { inner: "#000000", outer: "#2C2C2E", glow: "#1C1C1E" };
    if (isProcessing)       return { inner: "#1C1C1E", outer: "#3A3A3C", glow: "#444444" };
    if (isRecording)        return { inner: "#000000", outer: "#2C2C2E", glow: "#333333" };
    return { inner: "#1C1C1E", outer: "#3A3A3C", glow: "#888888" };
  };
  const colors = getColors();

  return (
    <View style={[styles.blobContainer, { width: BLOB_SIZE, height: BLOB_SIZE }]}>
      {/* Glow esterno — opacità controllata dal loop, centrato */}
      <Animated.View
        style={[
          styles.blobGlow,
          {
            width: BLOB_SIZE * 0.9,
            height: BLOB_SIZE * 0.9,
            borderRadius: BLOB_SIZE * 0.45,
            top: BLOB_SIZE * 0.05,
            left: BLOB_SIZE * 0.05,
            backgroundColor: colors.glow,
            opacity: glowValue,
          },
        ]}
      />
      {/* SVG blob — path ricalcolato ogni frame */}
      <Svg width={BLOB_SIZE} height={BLOB_SIZE} style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id="blobGrad" cx="50%" cy="45%" r="55%">
            <Stop offset="0%"   stopColor={colors.outer} stopOpacity="1" />
            <Stop offset="100%" stopColor={colors.inner} stopOpacity="1" />
          </RadialGradient>
        </Defs>
        <Path d={blobPath} fill="url(#blobGrad)" />
      </Svg>
    </View>
  );
};


const VoiceChatModal: React.FC<VoiceChatModalProps> = ({
  visible,
  onClose,
}) => {
  const {
    state,
    error,
    hasPermissions,
    isConnected,
    isRecording,
    isProcessing,
    isSpeaking,
    transcripts,
    activeTools,
    isMuted,
    connect,
    disconnect,
    requestPermissions,
    mute,
    unmute,
  } = useVoiceChat();

  // Animazioni modal
  const slideIn = useRef(new Animated.Value(height)).current;
  const fadeIn = useRef(new Animated.Value(0)).current;
  const liveDotOpacity = useRef(new Animated.Value(1)).current;
  const stateTextOpacity = useRef(new Animated.Value(1)).current;
  const prevStateRef = useRef(state);

  // Gestione connessione
  const handleConnect = useCallback(async () => {
    if (!hasPermissions) {
      const granted = await requestPermissions();
      if (!granted) {
        Alert.alert(
          'Permessi Richiesti',
          "La chat vocale richiede l'accesso al microfono per funzionare.",
          [{ text: 'OK', style: 'default' }]
        );
        return;
      }
    }
    await connect();
  }, [hasPermissions, requestPermissions, connect]);

  // Animazione di entrata del modal
  useEffect(() => {
    if (visible) {
      slideIn.setValue(height);
      fadeIn.setValue(0);
      Animated.parallel([
        Animated.timing(slideIn, { toValue: 0, duration: 400, useNativeDriver: true }),
        Animated.timing(fadeIn, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]).start();
    }
  }, [visible, slideIn, fadeIn]);

  // Auto-connessione quando il modal si apre (solo al cambio visible da false → true)
  const prevVisibleRef = useRef(false);
  useEffect(() => {
    const wasVisible = prevVisibleRef.current;
    prevVisibleRef.current = visible;
    if (visible && !wasVisible && state === 'idle') {
      handleConnect();
    }
  }, [visible, state, handleConnect]);

  // Cleanup quando il modal si chiude
  useEffect(() => {
    if (!visible) {
      disconnect();
    }
  }, [visible, disconnect]);

  // Smooth cross-fade when state changes
  useEffect(() => {
    if (prevStateRef.current !== state) {
      prevStateRef.current = state;
      stateTextOpacity.setValue(0);
      Animated.timing(stateTextOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [state, stateTextOpacity]);

  // Live dot pulse animation
  useEffect(() => {
    if (isConnected) {
      const dotPulse = Animated.loop(
        Animated.sequence([
          Animated.timing(liveDotOpacity, { toValue: 0.3, duration: 1000, useNativeDriver: true }),
          Animated.timing(liveDotOpacity, { toValue: 1, duration: 1000, useNativeDriver: true }),
        ])
      );
      dotPulse.start();
      return () => dotPulse.stop();
    }
  }, [isConnected, liveDotOpacity]);

  const handleClose = async () => {
    Animated.parallel([
      Animated.timing(slideIn, { toValue: height, duration: 300, useNativeDriver: true }),
      Animated.timing(fadeIn, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => onClose());
    await disconnect();
  };

  // Label testo stato
  const getStateLabel = (): string => {
    switch (state) {
      case 'connecting':
      case 'authenticating':
      case 'setting_up':
        return 'Connessione in corso...';
      case 'processing':
        return 'Elaboro...';
      case 'speaking':
        return 'Rispondo...';
      case 'recording':
        return 'Ti ascolto...';
      case 'ready':
        return 'Parla quando vuoi';
      case 'error':
        return 'Qualcosa è andato storto';
      default:
        return '';
    }
  };

  const isLoadingState = state === 'connecting' || state === 'authenticating' || state === 'setting_up' || state === 'processing';

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="none"
      statusBarTranslucent={true}
      onRequestClose={handleClose}
    >
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      <Animated.View
        style={[
          styles.overlay,
          {
            opacity: fadeIn,
            transform: [{ translateY: slideIn }],
          },
        ]}
      >
        {/* Header */}
        <View style={styles.header}>
          {isConnected ? (
            <View style={styles.liveIndicator}>
              <Animated.View style={[styles.liveDot, { opacity: liveDotOpacity }]} />
              <Text style={styles.liveText}>Live</Text>
            </View>
          ) : (
            <View style={styles.headerPlaceholder} />
          )}

          {isMuted && isConnected && (
            <View style={styles.mutedBadge}>
              <Ionicons name="mic-off" size={14} color="#FF3B30" />
              <Text style={styles.mutedBadgeText}>Muto</Text>
            </View>
          )}

          <TouchableOpacity
            style={styles.closeButton}
            onPress={handleClose}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Chiudi chat vocale"
          >
            <Ionicons name="close" size={22} color="#000000" />
          </TouchableOpacity>
        </View>

        {/* Center — blob animato */}
        <View style={styles.centerArea}>
          <AnimatedBlob
            state={state}
            isProcessing={isProcessing}
            isSpeaking={isSpeaking}
            isRecording={isRecording}
          />

          {/* Etichetta stato */}
          <Animated.Text style={[styles.stateLabel, { opacity: stateTextOpacity }]}>
            {getStateLabel()}
          </Animated.Text>

          {/* Tool calls (se presenti) */}
          {activeTools && activeTools.length > 0 && (
            <Animated.View style={[styles.toolsContainer, { opacity: stateTextOpacity }]}>
              <ScrollView
                style={styles.toolsScroll}
                contentContainerStyle={styles.toolsScrollContent}
                showsVerticalScrollIndicator={false}
                nestedScrollEnabled
              >
                {activeTools.map((tool: ActiveTool, idx: number) => (
                  <View key={`${tool.name}-${idx}`} style={styles.toolRow}>
                    {/* Icona stato */}
                    <View style={styles.toolIconCol}>
                      {tool.status === 'running' ? (
                        <Ionicons name="time-outline" size={14} color="#FF9500" />
                      ) : (
                        <Ionicons name="checkmark-circle-outline" size={14} color="#34C759" />
                      )}
                    </View>

                    <View style={styles.toolContent}>
                      {/* Nome funzione */}
                      <Text style={styles.toolName}>{tool.name}</Text>
                    </View>

                    {/* Badge stato */}
                    <View style={[
                      styles.toolStatusBadge,
                      tool.status === 'running' ? styles.toolStatusRunning : styles.toolStatusComplete,
                    ]}>
                      <Text style={[
                        styles.toolStatusText,
                        tool.status === 'running' ? styles.toolStatusTextRunning : styles.toolStatusTextComplete,
                      ]}>
                        {tool.status === 'running' ? 'in corso' : 'fatto'}
                      </Text>
                    </View>
                  </View>
                ))}
              </ScrollView>
            </Animated.View>
          )}

          {/* Errore */}
          {state === 'error' && error && (
            <Text style={styles.errorText}>{error}</Text>
          )}
        </View>

        {/* Bottom Control Bar */}
        <View style={styles.controlBar}>
          <TouchableOpacity
            style={[
              styles.micButton,
              isMuted && styles.micButtonMuted,
              isRecording && !isMuted && styles.micButtonRecording,
              (!isConnected || isLoadingState) && styles.micButtonDisabled,
            ]}
            onPress={() => (isMuted ? unmute() : mute())}
            disabled={!isConnected || isLoadingState || isSpeaking}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={isMuted ? "Riattiva microfono" : "Silenzia microfono"}
          >
            <Ionicons
              name={isMuted ? "mic-off" : "mic"}
              size={28}
              color={isMuted ? "#666666" : "#FFFFFF"}
            />
          </TouchableOpacity>
        </View>
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    justifyContent: "space-between",
  },

  // Header
  header: {
    paddingTop: StatusBar.currentHeight ? StatusBar.currentHeight + 16 : 52,
    paddingHorizontal: 20,
    paddingBottom: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerPlaceholder: {
    width: 72,
  },
  liveIndicator: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(52, 199, 89, 0.1)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#34C759",
    marginRight: 6,
  },
  liveText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#34C759",
  },
  mutedBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 59, 48, 0.1)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    gap: 4,
  },
  mutedBadgeText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#FF3B30",
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F2F2F7",
    justifyContent: "center",
    alignItems: "center",
  },

  // Center blob area
  centerArea: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  blobContainer: {
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  blobGlow: {
    position: "absolute",
    // Centrato dentro il container (5% di margine su ogni lato)
    ...Platform.select({
      ios: {
        shadowColor: "#000000",
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.40,
        shadowRadius: 36,
      },
      android: {
        elevation: 20,
      },
    }),
  },
  stateLabel: {
    marginTop: 36,
    fontSize: 17,
    fontWeight: "300",
    color: "#1C1C1E",
    letterSpacing: -0.3,
    textAlign: "center",
  },
  toolsBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 10,
    backgroundColor: "#F2F2F7",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
  },
  toolsText: {
    fontSize: 12,
    color: "#666666",
    fontWeight: "400",
  },
  // Tool calls list
  toolsContainer: {
    marginTop: 12,
    width: "100%",
    maxHeight: 180,
    borderRadius: 14,
    backgroundColor: "#F2F2F7",
    overflow: "hidden",
  },
  toolsScroll: {
    maxHeight: 180,
  },
  toolsScrollContent: {
    padding: 10,
    gap: 8,
  },
  toolRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    padding: 10,
    gap: 8,
  },
  toolIconCol: {
    marginTop: 1,
    width: 16,
    alignItems: "center",
  },
  toolContent: {
    flex: 1,
    gap: 3,
  },
  toolName: {
    fontSize: 12,
    fontWeight: "600",
    color: "#1C1C1E",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  toolArgs: {
    fontSize: 11,
    color: "#6E6E73",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  toolOutput: {
    fontSize: 11,
    color: "#34C759",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  toolStatusBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
    alignSelf: "flex-start",
    marginTop: 1,
  },
  toolStatusRunning: {
    backgroundColor: "rgba(255, 149, 0, 0.12)",
  },
  toolStatusComplete: {
    backgroundColor: "rgba(52, 199, 89, 0.12)",
  },
  toolStatusText: {
    fontSize: 10,
    fontWeight: "600",
  },
  toolStatusTextRunning: {
    color: "#FF9500",
  },
  toolStatusTextComplete: {
    color: "#34C759",
  },
  errorText: {
    marginTop: 12,
    fontSize: 13,
    color: "#FF453A",
    textAlign: "center",
    paddingHorizontal: 24,
  },

  // Control bar
  controlBar: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 28,
    paddingBottom: 52,
  },
  micButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#000000",
    justifyContent: "center",
    alignItems: "center",
    ...Platform.select({
      ios: {
        shadowColor: "#000000",
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.25,
        shadowRadius: 12,
      },
      android: {
        elevation: 10,
      },
    }),
  },
  micButtonRecording: {
    backgroundColor: "#000000",
  },
  micButtonMuted: {
    backgroundColor: "#F2F2F7",
  },
  micButtonDisabled: {
    opacity: 0.45,
  },
});

export default VoiceChatModal;
