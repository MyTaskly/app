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
      if (offerings.current) {
        console.log('[RevenueCat] Current offering:', offerings.current.identifier);
        offerings.current.availablePackages.forEach((pkg) => {
          console.log(`[RevenueCat] Package "${pkg.identifier}" — ${pkg.product.priceString} (${pkg.product.identifier})`);
        });
      } else {
        console.log('[RevenueCat] No current offering available');
      }
      return offerings;
    } catch (error) {
      // SDK already logs the full error; keep our log at debug level
      console.debug('RevenueCat offerings unavailable:', error.code);
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
