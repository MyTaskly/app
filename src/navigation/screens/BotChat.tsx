import React, { useState, useCallback, useEffect, useRef } from 'react';
import { View, KeyboardAvoidingView, Platform, Alert, Keyboard, Dimensions } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { sendMessageToBot, createNewChat, formatMessage, clearChatHistory } from '../../services/textBotService';
import { getChatWithMessages, ChatMessage } from '../../services/chatHistoryService';
import { reconstructMessagesFromHistory } from '../../components/BotChat/utils/chatHistoryUtils';
import {
  ChatHeader,
  ChatInput,
  ChatList,
  Message,
  chatStyles
} from '../../components/BotChat';

const BotChat: React.FC = () => {
  // Stati
  const [messages, setMessages] = useState<Message[]>([]);
  const [modelType, setModelType] = useState<'base' | 'advanced'>('base');
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  
  // Ref per prevenire invii multipli mentre uno è in corso
  const isSendingRef = useRef(false);

  // Costanti
  const USER = 'user';
  const BOT = 'bot';

  // Helper per determinare il tipo di dispositivo
  const getDeviceType = () => {
    const { width, height } = Dimensions.get('window');
    const aspectRatio = height / width;
    
    if (Platform.OS === 'ios') {
      // iPad ha generalmente un aspect ratio più piccolo (più quadrato)
      // iPhone ha un aspect ratio più alto (più rettangolare)
      return aspectRatio < 1.6 ? 'ipad' : 'iphone';
    }
    return 'android';
  };

  const deviceType = getDeviceType();  // Configurazione KeyboardAvoidingView basata sul dispositivo
  const getKeyboardAvoidingViewConfig = () => {
    switch (deviceType) {
      case 'ipad':
        return {
          behavior: 'padding' as const, // Usiamo padding anche per iPad
          keyboardVerticalOffset: 20, // Ma con offset molto ridotto
          enabled: true
        };
      case 'iphone':
        return {
          behavior: 'padding' as const,
          keyboardVerticalOffset: 35, // Ridotto da 90 a 35 per meno spazio
          enabled: true
        };
      case 'android':
      default:
        return {
          behavior: 'padding' as const,
          keyboardVerticalOffset: 0,
          enabled: true
        };
    }
  };

  // Inizializzazione della chat al primo render
  useEffect(() => {
    initializeChat();
    AsyncStorage.getItem('ai_model_tier').then((val) => {
      if (val === 'advanced' || val === 'base') setModelType(val);
    });
  }, []);
  // Gestione eventi tastiera per Android e iPad
  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener('keyboardDidShow', (event) => {
      setKeyboardVisible(true);
      
      // Su iPad, forziamo uno scroll aggiuntivo per assicurarci che l'input sia visibile
      if (deviceType === 'ipad') {
        setTimeout(() => {
          // Scroll aggiuntivo specifico per iPad
        }, 150);
      }
    });
    const keyboardDidHideListener = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardVisible(false);
    });

    return () => {
      keyboardDidShowListener?.remove();
      keyboardDidHideListener?.remove();
    };
  }, [deviceType]);
  // Funzione per inizializzare la chat creando una nuova sessione sul server
  const initializeChat = async () => {
    try {
      // Crea una nuova sessione chat sul server
      const chatId = await createNewChat();
      setCurrentChatId(chatId);
      setMessages([]);
      console.log('✅ Nuova chat inizializzata con ID:', chatId);
    } catch (error) {
      console.error('❌ Errore durante l\'inizializzazione della chat:', error);
      // In caso di errore, continua comunque senza chat_id (modalità offline)
      setCurrentChatId(null);
      setMessages([]);
    }
  };

  // Funzione per caricare una chat esistente dal server
  const loadExistingChat = async (chatId: string) => {
    try {
      console.log('📥 Caricamento chat esistente:', chatId);

      // Recupera la chat con tutti i suoi messaggi dal server
      const chatData = await getChatWithMessages(chatId);

      // Trasforma i messaggi dall'API al formato UI (con ricostruzione widget tool)
      const transformedMessages = reconstructMessagesFromHistory(
        chatData.messages,
        USER,
        BOT,
      );

      setCurrentChatId(chatId);
      setMessages(transformedMessages);

      console.log('✅ Chat caricata con successo:', {
        chatId,
        title: chatData.title,
        messageCount: transformedMessages.length
      });
    } catch (error) {
      console.error('❌ Errore durante il caricamento della chat:', error);
      Alert.alert(
        'Errore',
        'Impossibile caricare la chat. Riprova più tardi.',
        [{ text: 'OK' }]
      );
    }
  };

  // Handler per creare una nuova chat
  const handleNewChat = () => {
    // Se c'è una chat aperta, semplicemente pulisci e esci dalla sessione
    if (currentChatId) {
      Alert.alert(
        "Pulisci Chat",
        "Vuoi pulire la chat corrente? I messaggi verranno rimossi localmente ma la cronologia sul server rimarrà intatta.",
        [
          {
            text: "Annulla",
            style: "cancel"
          },
          {
            text: "Conferma",
            onPress: () => {
              // Pulisci solo localmente senza creare una nuova sessione
              setMessages([]);
              setCurrentChatId(null);
              console.log('✅ Chat pulita e uscito dalla sessione');
            }
          }
        ]
      );
    } else {
      // Se non c'è una chat aperta, crea una nuova sessione
      Alert.alert(
        "Nuova Chat",
        "Vuoi creare una nuova chat? Tutti i messaggi attuali verranno eliminati sia localmente che dal server.",
        [
          {
            text: "Annulla",
            style: "cancel"
          },
          {
            text: "Conferma",
            onPress: async () => {
              try {
                // Elimina la cronologia dal server
                const serverCleared = await clearChatHistory();

                if (!serverCleared) {
                  // Mostra un avviso ma procedi comunque con la pulizia locale
                  Alert.alert(
                    "Avviso",
                    "Non è stato possibile eliminare la cronologia dal server, ma la chat locale verrà comunque resettata.",
                    [{ text: "OK", onPress: () => initializeChat() }]
                  );
                } else {
                  // Tutto ok, procedi con la pulizia locale
                  await initializeChat();
                }
              } catch (error) {
                console.error("Errore durante il reset della chat:", error);
                // In caso di errore, procedi comunque con la pulizia locale
                Alert.alert(
                  "Errore",
                  "Si è verificato un errore durante l'eliminazione della cronologia dal server, ma la chat locale verrà resettata.",
                  [{ text: "OK", onPress: () => initializeChat() }]
                );
              }
            }
          }
        ]
      );
    }
  };

  // Handler per cambiare il tipo di modello
  const handleModelChange = (newModelType: 'base' | 'advanced') => {
    setModelType(newModelType);
    // Notifica all'utente del cambio
    const modelName = newModelType === 'advanced' ? 'avanzato' : 'base';
    
    setMessages(prevMessages => [
      ...prevMessages,
      {
        id: Math.random().toString(),
        text: `Modello cambiato a: ${modelName}`,
        sender: BOT,
        start_time: new Date(),
        modelType: newModelType
      }
    ]);
  };
  // Handler per inviare messaggi vocali (ora gestito direttamente nel hook)
  const handleSendVoiceMessage = useCallback(async (audioUri: string) => {
    // Questa funzione è mantenuta per compatibilità ma non viene più utilizzata
    // La logica è stata spostata nel hook useVoiceRecording
    console.log('Messaggio vocale gestito direttamente dal hook:', audioUri);
  }, []);

  // Handler per inviare messaggi con streaming + widgets
  const handleSendMessage = useCallback(async (text: string) => {
    // Previeni invii multipli mentre uno è in corso
    if (isSendingRef.current) return;
    isSendingRef.current = true;

    // 1. Creiamo il messaggio dell'utente
    const userMessage: Message = {
      id: Math.random().toString(),
      text,
      sender: USER,
      start_time: new Date(),
    };

    // Aggiungiamo il messaggio dell'utente
    setMessages(prevMessages => [...prevMessages, userMessage]);

    // 2. Creiamo messaggio bot temporaneo per streaming
    const tempId = Math.random().toString();
    setMessages(prevMessages => [
      ...prevMessages,
      {
        id: tempId,
        text: "",
        sender: BOT,
        start_time: new Date(),
        isStreaming: true,
        toolWidgets: [],
      }
    ]);

    // 3. Accumulo dati streaming
    let accumulatedText = "";
    let currentWidgets: any[] = [];
    let receivedChatId: string | undefined;

    // 4. Callback per aggiornare UI durante streaming
    const onStreamChunk = (
      chunk: string,
      isComplete: boolean,
      toolWidgets?: any[],
      chatInfo?: { chat_id: string; is_new: boolean }
    ) => {
      if (chunk) {
        accumulatedText += chunk;
      }

      if (toolWidgets) {
        currentWidgets = toolWidgets;
      }

      // Se riceviamo chat_id dal server, aggiorniamo lo stato
      if (chatInfo?.chat_id) {
        receivedChatId = chatInfo.chat_id;
        if (chatInfo.is_new) {
          console.log('[BotChat] Nuova chat creata automaticamente dal server:', receivedChatId);
        }
      }

      // Aggiorna il messaggio bot con testo + widgets accumulati
      setMessages(prevMessages =>
        prevMessages.map(msg =>
          msg.id === tempId
            ? {
                ...msg,
                text: accumulatedText,
                toolWidgets: currentWidgets,
                isStreaming: !isComplete,
                isComplete,
              }
            : msg
        )
      );
    };

    try {
      // 5. Invia richiesta con streaming callback e chat_id
      const result = await sendMessageToBot(
        text,
        modelType,
        onStreamChunk,
        currentChatId || undefined
      );

      // 6. Aggiorna currentChatId se il server ha restituito un chat_id
      if (result.chat_id && result.chat_id !== currentChatId) {
        console.log('[BotChat] Aggiornamento chat_id da:', currentChatId, 'a:', result.chat_id);
        setCurrentChatId(result.chat_id);
      }

      // 7. Aggiornamento finale con dati completi
      const formattedText = formatMessage(result.text);

      setMessages(prevMessages =>
        prevMessages.map(msg =>
          msg.id === tempId
            ? {
                ...msg,
                text: formattedText,
                toolWidgets: result.toolWidgets,
                isStreaming: false,
                isComplete: true,
                modelType,
              }
            : msg
        )
      );

    } catch (error) {
      console.error("Errore durante la comunicazione con il bot:", error);

      // In caso di errore, aggiorna messaggio con errore
      setMessages(prevMessages =>
        prevMessages.map(msg =>
          msg.id === tempId
            ? {
                ...msg,
                text: "Mi dispiace, si è verificato un errore. Riprova più tardi.",
                isStreaming: false,
                isComplete: true,
                toolWidgets: [],
              }
            : msg
        )
      );
    } finally {
      // Permetti di inviare un nuovo messaggio solo dopo che il bot ha risposto
      isSendingRef.current = false;
    }
  }, [modelType, messages, currentChatId]);

  const keyboardConfig = getKeyboardAvoidingViewConfig();
  // Per iPad, usiamo un approccio ibrido: KeyboardAvoidingView con offset minimo
  if (deviceType === 'ipad') {
    return (
      <SafeAreaView style={chatStyles.container}>
        <View style={chatStyles.chatContainer}>
          <ChatHeader
            modelType={modelType}
            onModelChange={handleModelChange}
            onNewChat={handleNewChat}
          />          <ChatList messages={messages} />
          <KeyboardAvoidingView
            behavior="padding"
            keyboardVerticalOffset={10}
            enabled={true}          >
            <ChatInput 
              onSendMessage={handleSendMessage}
              onSendVoiceMessage={handleSendVoiceMessage}
              modelType={modelType}
            />
          </KeyboardAvoidingView>
        </View>
      </SafeAreaView>
    );
  }

  // Per iPhone e Android, usiamo l'approccio standard
  return (
    <SafeAreaView style={chatStyles.container}>
      <KeyboardAvoidingView
        style={chatStyles.chatContainer}
        behavior={keyboardConfig.behavior}
        keyboardVerticalOffset={keyboardConfig.keyboardVerticalOffset}
        enabled={keyboardConfig.enabled}
      >
        <ChatHeader
          modelType={modelType}
          onModelChange={handleModelChange}
          onNewChat={handleNewChat}
        />        <ChatList messages={messages} />
        <ChatInput 
          onSendMessage={handleSendMessage}
          onSendVoiceMessage={handleSendVoiceMessage}
          modelType={modelType}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default BotChat;