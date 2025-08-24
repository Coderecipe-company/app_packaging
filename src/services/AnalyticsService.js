import analytics from '@react-native-firebase/analytics';

class AnalyticsService {
  constructor() {
    this.analytics = analytics();
    this.isEnabled = false;
  }

  async initialize() {
    try {
      // Analytics 활성화
      await this.analytics.setAnalyticsCollectionEnabled(true);
      this.isEnabled = true;
      
      console.log('Firebase Analytics initialized and enabled');
      
      // 기본 사용자 속성 설정
      await this.setDefaultUserProperties();
      
      // 앱 오픈 이벤트 로깅
      await this.logEvent('app_open', {
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('Analytics initialization error:', error);
      // Analytics 실패해도 앱 실행에는 영향 없음
    }
  }

  async setDefaultUserProperties() {
    try {
      // 플랫폼 설정
      await this.analytics.setUserProperty('platform', 'mobile');
      
      // 앱 버전 설정 (나중에 동적으로 가져올 수 있음)
      // await this.analytics.setUserProperty('app_version', '1.0.0');
      
    } catch (error) {
      console.error('Error setting user properties:', error);
    }
  }

  // 이벤트 로깅
  async logEvent(eventName, params = {}) {
    try {
      if (!this.isEnabled) {
        console.log('Analytics not enabled, skipping event:', eventName);
        return;
      }
      
      await this.analytics.logEvent(eventName, params);
      console.log('Analytics event logged:', eventName, params);
    } catch (error) {
      console.error('Error logging event:', error);
    }
  }

  // 화면 추적
  async logScreenView(screenName, screenClass = 'WebView') {
    try {
      await this.analytics.logScreenView({
        screen_name: screenName,
        screen_class: screenClass,
      });
      console.log('Screen view logged:', screenName);
    } catch (error) {
      console.error('Error logging screen view:', error);
    }
  }

  // 사용자 ID 설정
  async setUserId(userId) {
    try {
      await this.analytics.setUserId(userId);
      console.log('User ID set:', userId);
    } catch (error) {
      console.error('Error setting user ID:', error);
    }
  }

  // 사용자 속성 설정
  async setUserProperty(name, value) {
    try {
      await this.analytics.setUserProperty(name, value);
      console.log('User property set:', name, value);
    } catch (error) {
      console.error('Error setting user property:', error);
    }
  }

  // 구매 이벤트
  async logPurchase(value, currency = 'KRW', items = []) {
    try {
      await this.analytics.logPurchase({
        value: value,
        currency: currency,
        items: items
      });
      console.log('Purchase logged:', value, currency);
    } catch (error) {
      console.error('Error logging purchase:', error);
    }
  }

  // 로그인 이벤트
  async logLogin(method) {
    try {
      await this.analytics.logLogin({
        method: method
      });
      console.log('Login logged:', method);
    } catch (error) {
      console.error('Error logging login:', error);
    }
  }

  // 회원가입 이벤트
  async logSignUp(method) {
    try {
      await this.analytics.logSignUp({
        method: method
      });
      console.log('Sign up logged:', method);
    } catch (error) {
      console.error('Error logging sign up:', error);
    }
  }

  // 검색 이벤트
  async logSearch(searchTerm) {
    try {
      await this.analytics.logSearch({
        search_term: searchTerm
      });
      console.log('Search logged:', searchTerm);
    } catch (error) {
      console.error('Error logging search:', error);
    }
  }

  // 아이템 조회 이벤트
  async logViewItem(itemId, itemName, itemCategory) {
    try {
      await this.analytics.logViewItem({
        item_id: itemId,
        item_name: itemName,
        item_category: itemCategory
      });
      console.log('View item logged:', itemId);
    } catch (error) {
      console.error('Error logging view item:', error);
    }
  }

  // 장바구니 추가 이벤트
  async logAddToCart(itemId, itemName, value) {
    try {
      await this.analytics.logAddToCart({
        item_id: itemId,
        item_name: itemName,
        value: value
      });
      console.log('Add to cart logged:', itemId);
    } catch (error) {
      console.error('Error logging add to cart:', error);
    }
  }

  // FCM 관련 이벤트
  async logNotificationReceive(messageId, title) {
    try {
      await this.logEvent('notification_receive', {
        message_id: messageId,
        title: title,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error logging notification receive:', error);
    }
  }

  async logNotificationOpen(messageId, title, url) {
    try {
      await this.logEvent('notification_open', {
        message_id: messageId,
        title: title,
        url: url,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error logging notification open:', error);
    }
  }
}

export default new AnalyticsService();