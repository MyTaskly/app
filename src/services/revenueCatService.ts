import Purchases from 'react-native-purchases';
import { Platform } from 'react-native';

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
    }
    return RevenueCatService.instance;
  }

  private configure(apiKey: string): void {
    if (this.initialized) return;

    Purchases.configure({ apiKey });
    this.initialized = true;
  }

  async getOfferings(): Promise<Offerings | null> {
    try {
      const offerings = await Purchases.getOfferings();
      return offerings;
    } catch (error) {
      console.warn('Failed to fetch RevenueCat offerings:', error);
      return null;
    }
  }

  async purchasePlan(pkg: PurchasesPackage): Promise<CustomerInfo> {
    try {
      const { customerInfo } = await Purchases.purchasePackage(pkg);
      return customerInfo;
    } catch (error) {
      throw error;
    }
  }

  async restorePurchases(): Promise<CustomerInfo> {
    const { customerInfo } = await Purchases.restorePurchases();
    return customerInfo;
  }
}

export default RevenueCatService;
export type { Offerings, PurchasesPackage, CustomerInfo };
