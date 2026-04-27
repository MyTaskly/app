import Purchases from 'react-native-purchases';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

type Offerings = Purchases.Offerings;
type PurchasesPackage = Purchases.Package;
type CustomerInfo = Purchases.CustomerInfo;

class RevenueCatService {
  private static instance: RevenueCatService | null = null;
  private initialized: boolean = false;

  private constructor() {}

  static getInstance(): RevenueCatService {
    if (!RevenueCatService.instance) {
      RevenueCatService.instance = new RevenueCatService();
      RevenueCatService.instance.init();
    }
    return RevenueCatService.instance;
  }

  private init(): void {
    if (this.initialized) return;
    if (Platform.OS !== 'android') return;

    const apiKey = Constants.expoConfig?.extra?.revenueCatAndroidPublicKey
      ?? process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_PUBLIC_KEY;

    if (!apiKey) {
      console.warn('RevenueCat: missing API key. Set EXPO_PUBLIC_REVENUECAT_ANDROID_PUBLIC_KEY in .env');
      return;
    }

    Purchases.configure({ apiKey });
    this.initialized = true;
  }

  async getOfferings(): Promise<Offerings | null> {
    if (!this.initialized) return null;
    try {
      const offerings = await Purchases.getOfferings();
      return offerings;
    } catch (error) {
      console.warn('Failed to fetch RevenueCat offerings:', error);
      return null;
    }
  }

  async purchasePlan(pkg: PurchasesPackage): Promise<CustomerInfo> {
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    return customerInfo;
  }

  async restorePurchases(): Promise<CustomerInfo> {
    const { customerInfo } = await Purchases.restorePurchases();
    return customerInfo;
  }
}

export default RevenueCatService;
export type { Offerings, PurchasesPackage, CustomerInfo };
