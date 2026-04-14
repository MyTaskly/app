declare module '*.png' {
  const value: import('react-native').ImageSourcePropType;
  export default value;
}

declare module '*.jpg' {
  const value: import('react-native').ImageSourcePropType;
  export default value;
}

export interface TaskListRouteParams {
  category_name: string; // Deprecato, mantenuto per retrocompatibilità
  categoryId?: number | string; // Preferito
}

export type RootStackParamList = {
  WelcomeCarousel: undefined;
  Login: undefined;
  Register: undefined;
  EmailVerification: { email: string; username: string; password: string };
  VerificationSuccess: { email: string; username: string; password: string };
  HomeTabs: undefined;
  Home20: undefined; // Nuova schermata Home2.0
  TaskList: {
    categoryId: number | string;
    category_name: string;
    isOwned?: boolean;
    permissionLevel?: "READ_ONLY" | "READ_WRITE";
  };
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
  NotificationSettings: undefined;
  MemorySettings: undefined;
  AISettings: undefined;
  RecurringTasks: undefined;
  Statistics: undefined;
  Updates: undefined;
  NotFound: undefined;
};

export type TabParamList = {
  Home: undefined;
  Categories: undefined;
  Notes: undefined;
  BotChat: undefined;
};