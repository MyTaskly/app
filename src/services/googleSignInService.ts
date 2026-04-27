import * as WebBrowser from 'expo-web-browser';
import { updateAuthData } from './authService';
import axios from './axiosInstance';
import { API_ENDPOINTS } from '../constants/authConstants';

/**
 * Clear WebBrowser session to force fresh OAuth consent
 */
export const clearWebBrowserSession = async (): Promise<void> => {
  try {
    await WebBrowser.dismissBrowser();
    await WebBrowser.coolDownAsync();
    console.log('🧹 WebBrowser session cleared');
  } catch (error) {
    console.error('❌ Error clearing WebBrowser session:', error);
  }
};

/**
 * Initialize Google Sign-In configuration
 */
export const initializeGoogleSignIn = async (): Promise<void> => {
  try {
    // For server-side Google Sign-In, we don't need to initialize the Google SDK
    // The initialization is handled by the backend server
    console.log('🔧 Google Sign-In initialized (server-side mode)');
  } catch (error) {
    console.error('❌ Error initializing Google Sign-In:', error);
    throw error;
  }
};

/**
 * Google Sign-In server-side following the new backend implementation
 */
export const signInWithGoogleServerSide = async () => {
  try {
    console.log('📤 Starting Google login server-side...');

    // 0. Clear any existing WebBrowser session
    await clearWebBrowserSession();

    // 1. Call the server endpoint to get Google authorization URL
    const response = await axios.get(`${API_ENDPOINTS.GOOGLE_LOGIN}`);
    const { authorization_url } = response.data;

    if (!authorization_url) {
      throw new Error('Authorization URL not received from server');
    }

    console.log('🔗 Opening Google authorization URL...');
    console.log('📋 Authorization URL:', authorization_url);

    // 2. Open browser for authorization
    const result = await WebBrowser.openAuthSessionAsync(
      authorization_url,
      'mytaskly://auth/login',
      {
        showInRecents: false,
      }
    );

    // Force dismiss browser from Android back stack
    try {
      await WebBrowser.dismissBrowser();
      await WebBrowser.coolDownAsync();
    } catch (_) {}

    if (result.type === 'success') {
      console.log('✅ Authorization completed, processing result...');

      // 3. Parse the result URL to extract tokens and user data
      const url = new URL(result.url);

      // Check if this is a success URL
      if (url.pathname.includes('/success')) {
        // Check for success parameters
        const accessToken = url.searchParams.get('access_token');
        const refreshToken = url.searchParams.get('refresh_token');
        const userId = url.searchParams.get('user_id');
        const username = url.searchParams.get('username');
        const email = url.searchParams.get('email');
        const bearerDuration = parseInt(url.searchParams.get('bearer_duration') || '3600');
        const refreshDuration = parseInt(url.searchParams.get('refresh_duration') || '86400');

        if (!accessToken || !userId) {
          throw new Error('Missing required authentication data from server');
        }

        // 4. Save authentication data locally
        await updateAuthData({
          bearerToken: accessToken,
          refreshToken: refreshToken || '',
          loginTime: new Date().toISOString(),
          bearerDuration: bearerDuration,
          refreshDuration: refreshDuration,
          username: decodeURIComponent(username || ''),
          email: decodeURIComponent(email || ''),
          utente_id: userId,
        });

        console.log('✅ Google login server-side completed successfully');

        return {
          success: true,
          userInfo: {
            id: userId,
            name: decodeURIComponent(username || ''),
            email: decodeURIComponent(email || ''),
          },
          message: 'Login con Google completato con successo',
          bearerToken: accessToken,
        };
      } else {
        // Check for error parameters in case of error redirect
        const error = url.searchParams.get('error');
        const errorMessage = url.searchParams.get('message');

        if (error) {
          throw new Error(errorMessage || `Google login error: ${error}`);
        }

        throw new Error('Unexpected redirect URL format');
      }

    } else if (result.type === 'cancel') {
      console.log('ℹ️ User cancelled Google login');
      return {
        success: false,
        message: 'Login cancellato dall\'utente',
      };
    } else {
      throw new Error('Login fallito - unexpected result type');
    }

  } catch (error: any) {
    console.error('❌ Error during Google server-side login:', error);

    return {
      success: false,
      message: error.response?.data?.message || error.message || 'Errore durante il login con Google',
      error: error,
    };
  }
};

/**
 * Handle login success from redirect URL parameters
 */
export const handleGoogleLoginSuccess = async (url: string) => {
  try {
    console.log('🔍 Processing login success URL...');

    const parsedUrl = new URL(url);
    const urlParams = parsedUrl.searchParams;

    const accessToken = urlParams.get('access_token');
    const refreshToken = urlParams.get('refresh_token');
    const userId = urlParams.get('user_id');
    const username = urlParams.get('username');
    const email = urlParams.get('email');

    if (!accessToken || !userId) {
      throw new Error('Missing required authentication data');
    }

    // Save authentication data locally
    await updateAuthData({
      bearerToken: accessToken,
      refreshToken: refreshToken || '',
      loginTime: new Date().toISOString(),
      bearerDuration: 3600, // 1 hour default
      refreshDuration: 86400, // 24 hours default
      username: username || '',
      email: email || '',
      utente_id: userId,
    });

    console.log('✅ Google login success processed');

    return {
      success: true,
      userInfo: {
        id: userId,
        name: username,
        email: email,
      },
      message: 'Login completed successfully',
    };
  } catch (error: any) {
    console.error('❌ Error processing login success:', error);
    return {
      success: false,
      message: error.message || 'Error processing login success',
      error,
    };
  }
};

/**
 * Handle login error from redirect URL parameters
 */
export const handleGoogleLoginError = (url: string) => {
  try {
    const parsedUrl = new URL(url);
    const urlParams = parsedUrl.searchParams;

    const error = urlParams.get('error');
    const message = urlParams.get('message');

    console.error('❌ Google login error:', error, message);

    return {
      success: false,
      error,
      message: message || 'Google login failed',
    };
  } catch (err: any) {
    console.error('❌ Error parsing login error URL:', err);
    return {
      success: false,
      error: 'url_parse_error',
      message: 'Error parsing login error response',
    };
  }
};

/**
 * Sign out from Google (placeholder for compatibility)
 */
export const signOutFromGoogle = async (): Promise<void> => {
  try {
    await clearWebBrowserSession();
    console.log('✅ Signed out from Google');
  } catch (error) {
    console.error('❌ Error signing out from Google:', error);
  }
};

/**
 * Check if user is signed in with Google (placeholder for compatibility)
 */
export const isGoogleSignedIn = async (): Promise<boolean> => {
  // Since we use server-side authentication, we check if there's a bearer token
  // This is handled by the auth service
  return false; // Placeholder - actual check should be done in auth service
};

/**
 * Get current Google user (placeholder for compatibility)
 */
export const getCurrentGoogleUser = async (): Promise<any | null> => {
  // Since we use server-side authentication, user info is stored in auth service
  return null; // Placeholder - actual user should be fetched from auth service
};

/**
 * Revoke Google access (placeholder for compatibility)
 */
export const revokeGoogleAccess = async (): Promise<void> => {
  try {
    await signOutFromGoogle();
    console.log('✅ Google access revoked');
  } catch (error) {
    console.error('❌ Error revoking Google access:', error);
  }
};

/**
 * Aliases for backward compatibility
 */
export const initiateGoogleLogin = signInWithGoogleServerSide;
export const signInWithGoogle = signInWithGoogleServerSide;