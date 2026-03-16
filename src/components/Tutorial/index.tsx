import React, { useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  Modal,
  StyleSheet,
  FlatList,
  Pressable,
  Animated,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTranslation } from 'react-i18next';
import {
  TUTORIAL_STORAGE_KEY,
  TUTORIAL_STEP_DEFINITIONS,
  TUTORIAL_SECTION_DEFINITIONS,
  TutorialStepDefinition,
} from '../../constants/tutorialContent';


// Total pages = welcome + steps + completion
type PageType = 'welcome' | 'step' | 'section-header' | 'completion';

interface PageData {
  type: PageType;
  key: string;
  stepDef?: TutorialStepDefinition;
  sectionKey?: string;
}

function buildStaticPages(): PageData[] {
  const pages: PageData[] = [];

  // Welcome page
  pages.push({ type: 'welcome', key: 'welcome' });

  // Steps grouped by section with section headers
  for (const section of TUTORIAL_SECTION_DEFINITIONS) {
    // Section header page
    pages.push({
      type: 'section-header',
      key: `section-${section.key}`,
      sectionKey: section.key,
    });

    // Step pages
    for (const stepKey of section.stepKeys) {
      const stepDef = TUTORIAL_STEP_DEFINITIONS.find(s => s.key === stepKey);
      if (stepDef) {
        pages.push({
          type: 'step',
          key: stepDef.key,
          stepDef,
          sectionKey: section.key,
        });
      }
    }
  }

  // Completion page
  pages.push({ type: 'completion', key: 'completion' });

  return pages;
}

// Static page structure (keys, images, section grouping) — built once, no text
const STATIC_PAGES = buildStaticPages();

// Section icon mapping
function getSectionIcon(sectionKey?: string): keyof typeof Ionicons.glyphMap {
  switch (sectionKey) {
    case 'home': return 'home';
    case 'categories': return 'grid';
    case 'calendar': return 'calendar';
    default: return 'apps';
  }
}

export const TutorialOnboarding: React.FC<{
  visible: boolean;
  onComplete: () => void;
  onSkip: () => void;
}> = ({ visible, onComplete, onSkip }) => {
  const { t } = useTranslation();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const flatListRef = useRef<FlatList>(null);
  const scrollX = useRef(new Animated.Value(0)).current;
  const [currentIndex, setCurrentIndex] = useState(0);

  const pages = STATIC_PAGES;
  const totalPages = pages.length;

  const handleScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { x: scrollX } } }],
    { useNativeDriver: false }
  );

  const onMomentumScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const index = Math.round(e.nativeEvent.contentOffset.x / screenWidth);
      setCurrentIndex(index);
    },
    [screenWidth]
  );

  const goToPage = useCallback(
    (index: number) => {
      flatListRef.current?.scrollToIndex({ index, animated: true });
      setCurrentIndex(index);
    },
    []
  );

  const handleNext = useCallback(() => {
    if (currentIndex < totalPages - 1) {
      goToPage(currentIndex + 1);
    }
  }, [currentIndex, totalPages, goToPage]);

  const handleBack = useCallback(() => {
    if (currentIndex > 0) {
      goToPage(currentIndex - 1);
    }
  }, [currentIndex, goToPage]);

  const handleComplete = useCallback(async () => {
    try {
      await AsyncStorage.setItem(TUTORIAL_STORAGE_KEY, 'true');
    } catch (error) {
      console.error('[Tutorial] Error saving completion:', error);
    }
    setCurrentIndex(0);
    onComplete();
  }, [onComplete]);

  const handleSkip = useCallback(async () => {
    try {
      await AsyncStorage.setItem(TUTORIAL_STORAGE_KEY, 'skipped');
    } catch (error) {
      console.error('[Tutorial] Error saving skip:', error);
    }
    setCurrentIndex(0);
    onSkip();
  }, [onSkip]);

  const handleReview = useCallback(() => {
    goToPage(0);
  }, [goToPage]);

  const renderWelcomePage = () => (
    <View style={[styles.pageContainer, { width: screenWidth, height: screenHeight }]}>
      <View style={styles.welcomeCard}>
        <Image
          source={require('../../../assets/icons/adaptive-icon.png')}
          style={styles.welcomeLogo}
          resizeMode="contain"
        />
        <Text style={styles.welcomeTitle}>{t('tutorial.welcome.title')}</Text>
        <Text style={styles.welcomeDescription}>
          {t('tutorial.welcome.description')}
        </Text>
        <Pressable
          style={({ pressed }) => [
            styles.primaryButton,
            pressed && styles.buttonPressed,
          ]}
          onPress={handleNext}
        >
          <Text style={styles.primaryButtonText}>
            {t('tutorial.welcome.startButton')}
          </Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [
            styles.secondaryButton,
            pressed && styles.buttonPressed,
          ]}
          onPress={handleSkip}
        >
          <Text style={styles.secondaryButtonText}>
            {t('tutorial.welcome.skipButton')}
          </Text>
        </Pressable>
      </View>
    </View>
  );

  const renderSectionHeader = (page: PageData) => {
    const sectionDef = TUTORIAL_SECTION_DEFINITIONS.find(s => s.key === page.sectionKey);
    return (
      <View style={[styles.pageContainer, { width: screenWidth, height: screenHeight }]}>
        <View style={styles.sectionHeaderCard}>
          <View style={styles.sectionIconContainer}>
            <Ionicons
              name={getSectionIcon(page.sectionKey)}
              size={48}
              color="#000"
            />
          </View>
          <Text style={styles.sectionHeaderTitle}>
            {sectionDef ? t(sectionDef.titleKey) : ''}
          </Text>
          <Text style={styles.sectionHeaderSubtitle}>
            {t('tutorial.navigation.next')}
          </Text>
          <Ionicons name="arrow-forward" size={24} color="#999" style={{ marginTop: 8 }} />
        </View>
      </View>
    );
  };

  const renderStepPage = (page: PageData) => {
    if (!page.stepDef) return null;
    const { stepDef } = page;
    const sectionDef = TUTORIAL_SECTION_DEFINITIONS.find(s => s.key === page.sectionKey);

    return (
      <View style={[styles.pageContainer, { width: screenWidth, height: screenHeight }]}>
        <View style={styles.stepContent}>
          {/* Section badge */}
          <View style={styles.sectionBadge}>
            <Ionicons
              name={getSectionIcon(stepDef.section)}
              size={14}
              color="#000"
            />
            <Text style={styles.sectionBadgeText}>
              {sectionDef ? t(sectionDef.titleKey) : ''}
            </Text>
          </View>

          {/* Screenshot image */}
          <View style={[styles.imageContainer, { width: screenWidth - 64, height: screenHeight * 0.42 }]}>
            <Image
              source={stepDef.image}
              style={styles.stepImage}
              resizeMode="contain"
            />
          </View>

          {/* Step title and description */}
          <Text style={styles.stepTitle}>{t(stepDef.titleKey)}</Text>
          <Text style={styles.stepDescription}>{t(stepDef.descriptionKey)}</Text>
        </View>
      </View>
    );
  };

  const renderCompletionPage = () => (
    <View style={[styles.pageContainer, { width: screenWidth, height: screenHeight }]}>
      <View style={styles.completionCard}>
        <View style={styles.completionIconContainer}>
          <Ionicons name="checkmark" size={48} color="#FFFFFF" />
        </View>
        <Text style={styles.completionTitle}>
          {t('tutorial.completion.title')}
        </Text>
        <Text style={styles.completionDescription}>
          {t('tutorial.completion.description')}
        </Text>
        <Pressable
          style={({ pressed }) => [
            styles.primaryButton,
            pressed && styles.buttonPressed,
          ]}
          onPress={handleComplete}
        >
          <Text style={styles.primaryButtonText}>
            {t('tutorial.completion.primaryButton')}
          </Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [
            styles.secondaryButton,
            pressed && styles.buttonPressed,
          ]}
          onPress={handleReview}
        >
          <Text style={styles.secondaryButtonText}>
            {t('tutorial.completion.secondaryButton')}
          </Text>
        </Pressable>
      </View>
    </View>
  );

  const renderPage = ({ item }: { item: PageData }) => {
    switch (item.type) {
      case 'welcome':
        return renderWelcomePage();
      case 'section-header':
        return renderSectionHeader(item);
      case 'step':
        return renderStepPage(item);
      case 'completion':
        return renderCompletionPage();
      default:
        return null;
    }
  };

  // Progress dots (exclude welcome and completion from count)
  const stepPages = pages.filter(p => p.type === 'step' || p.type === 'section-header');
  const isWelcome = currentIndex === 0;
  const isCompletion = currentIndex === totalPages - 1;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={false}
      statusBarTranslucent
    >
      <View style={styles.container}>
        {/* Skip button (only on step pages) */}
        {!isWelcome && !isCompletion && (
          <Pressable
            style={({ pressed }) => [
              styles.skipHeaderButton,
              pressed && { opacity: 0.6 },
            ]}
            onPress={handleSkip}
          >
            <Text style={styles.skipHeaderText}>
              {t('tutorial.navigation.skip')}
            </Text>
          </Pressable>
        )}

        {/* Swipable pages */}
        <FlatList
          ref={flatListRef}
          data={pages}
          keyExtractor={item => item.key}
          renderItem={renderPage}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          bounces={false}
          onScroll={handleScroll}
          onMomentumScrollEnd={onMomentumScrollEnd}
          scrollEventThrottle={16}
          getItemLayout={(_, index) => ({
            length: screenWidth,
            offset: screenWidth * index,
            index,
          })}
        />

        {/* Bottom navigation bar (for step pages only) */}
        {!isWelcome && !isCompletion && (
          <View style={styles.bottomBar}>
            {/* Progress dots */}
            <View style={styles.progressContainer}>
              {stepPages.map((page, idx) => {
                const pageIndex = pages.indexOf(page);
                const isActive = pageIndex === currentIndex;
                const isPast = pageIndex < currentIndex;

                return (
                  <View
                    key={page.key}
                    style={[
                      styles.progressDot,
                      isActive && styles.progressDotActive,
                      isPast && styles.progressDotPast,
                      page.type === 'section-header' && styles.progressDotSection,
                    ]}
                  />
                );
              })}
            </View>

            {/* Nav buttons */}
            <View style={styles.navButtonsContainer}>
              <Pressable
                style={({ pressed }) => [
                  styles.navButton,
                  styles.navButtonBack,
                  pressed && { opacity: 0.6 },
                ]}
                onPress={handleBack}
              >
                <Ionicons name="arrow-back" size={20} color="#000" />
                <Text style={styles.navButtonBackText}>
                  {t('tutorial.navigation.back')}
                </Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [
                  styles.navButton,
                  styles.navButtonNext,
                  pressed && { opacity: 0.8 },
                ]}
                onPress={handleNext}
              >
                <Text style={styles.navButtonNextText}>
                  {t('tutorial.navigation.next')}
                </Text>
                <Ionicons name="arrow-forward" size={20} color="#FFF" />
              </Pressable>
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },

  // Skip button top-right
  skipHeaderButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 56 : 40,
    right: 20,
    zIndex: 10,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  skipHeaderText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#999',
  },

  // Page container (each page) — width/height injected as inline style per render
  pageContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },

  // Welcome page
  welcomeCard: {
    alignItems: 'center',
    width: '100%',
    maxWidth: 360,
  },
  welcomeLogo: {
    width: 100,
    height: 100,
    marginBottom: 32,
  },
  welcomeTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#000',
    textAlign: 'center',
    marginBottom: 16,
    letterSpacing: -0.5,
  },
  welcomeDescription: {
    fontSize: 17,
    fontWeight: '400',
    color: '#666',
    textAlign: 'center',
    lineHeight: 26,
    marginBottom: 40,
  },

  // Section header page
  sectionHeaderCard: {
    alignItems: 'center',
    width: '100%',
    maxWidth: 360,
  },
  sectionIconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  sectionHeaderTitle: {
    fontSize: 32,
    fontWeight: '700',
    color: '#000',
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  sectionHeaderSubtitle: {
    fontSize: 16,
    fontWeight: '400',
    color: '#999',
    textAlign: 'center',
    marginTop: 12,
  },

  // Step page
  stepContent: {
    alignItems: 'center',
    width: '100%',
    maxWidth: 360,
    paddingTop: Platform.OS === 'ios' ? 80 : 60,
  },
  sectionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
    marginBottom: 20,
  },
  sectionBadgeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#000',
  },
  // width/height injected as inline style per render
  imageContainer: {
    backgroundColor: '#F8F8F8',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 24,
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  stepImage: {
    width: '100%',
    height: '100%',
  },
  stepTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#000',
    textAlign: 'center',
    marginBottom: 10,
    letterSpacing: -0.3,
  },
  stepDescription: {
    fontSize: 15,
    fontWeight: '400',
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 8,
  },

  // Completion page
  completionCard: {
    alignItems: 'center',
    width: '100%',
    maxWidth: 360,
  },
  completionIconContainer: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  completionTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#000',
    textAlign: 'center',
    marginBottom: 16,
    letterSpacing: -0.5,
  },
  completionDescription: {
    fontSize: 17,
    fontWeight: '400',
    color: '#666',
    textAlign: 'center',
    lineHeight: 26,
    marginBottom: 40,
  },

  // Buttons
  primaryButton: {
    backgroundColor: '#000',
    paddingVertical: 16,
    borderRadius: 28,
    width: '100%',
    alignItems: 'center',
    marginBottom: 12,
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    paddingVertical: 14,
    borderRadius: 28,
    width: '100%',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  primaryButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFF',
  },
  secondaryButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#000',
  },
  buttonPressed: {
    transform: [{ scale: 0.97 }],
    opacity: 0.9,
  },

  // Bottom bar
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    paddingTop: 16,
    backgroundColor: '#FFF',
  },

  // Progress dots
  progressContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginBottom: 16,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E0E0E0',
  },
  progressDotActive: {
    width: 24,
    borderRadius: 4,
    backgroundColor: '#000',
  },
  progressDotPast: {
    backgroundColor: '#666',
  },
  progressDotSection: {
    width: 12,
    height: 8,
    borderRadius: 4,
  },

  // Nav buttons
  navButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  navButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 24,
    gap: 8,
  },
  navButtonBack: {
    backgroundColor: '#F5F5F5',
  },
  navButtonNext: {
    backgroundColor: '#000',
  },
  navButtonBackText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  navButtonNextText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
});
