import {Linking, Platform} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

class DeepLinkService {
  constructor() {
    this.isInitialized = false;
    this.urlHandlers = [];
    this.initialUrl = null;
  }

  async initialize(onUrlReceived) {
    try {
      if (this.isInitialized) {
        return;
      }

      console.log('Initializing DeepLink Service...');

      // URL 핸들러 등록
      if (onUrlReceived) {
        this.urlHandlers.push(onUrlReceived);
      }

      // 앱이 실행되지 않은 상태에서 링크로 열렸을 때 처리
      const initialUrl = await Linking.getInitialURL();
      if (initialUrl) {
        console.log('Initial URL detected:', initialUrl);
        this.initialUrl = initialUrl;
        setTimeout(() => {
          this.handleUrl(initialUrl);
        }, 1000); // 앱 초기화 완료 후 처리
      }

      // 앱이 실행 중일 때 링크 처리
      const linkingSubscription = Linking.addEventListener('url', this.handleLinkingUrl);

      // 전역 함수로 등록하여 FCM에서 사용 가능하도록 설정
      global.handleDeepLinkUrl = (url) => {
        this.handleUrl(url);
      };

      this.linkingSubscription = linkingSubscription;
      this.isInitialized = true;
      
      console.log('DeepLink Service initialized successfully');
    } catch (error) {
      console.error('DeepLink initialization error:', error);
    }
  }

  handleLinkingUrl = (event) => {
    if (event && event.url) {
      console.log('Deep link URL received:', event.url);
      this.handleUrl(event.url);
    }
  };

  handleUrl(url) {
    try {
      console.log('Processing deep link URL:', url);
      
      // URL 유효성 검사
      if (!this.isValidUrl(url)) {
        console.warn('Invalid URL format:', url);
        return;
      }

      // URL 파싱
      const parsedUrl = this.parseUrl(url);
      
      // 처리된 URL 저장
      AsyncStorage.setItem('last_deeplink_url', url);
      AsyncStorage.setItem('last_deeplink_data', JSON.stringify(parsedUrl));

      // 등록된 핸들러들에게 URL 전달
      this.urlHandlers.forEach(handler => {
        try {
          handler(parsedUrl.fullUrl, parsedUrl);
        } catch (error) {
          console.error('URL handler error:', error);
        }
      });

      // 웹뷰에 딥링크 데이터 전달
      if (global.webViewRef && global.webViewRef.current) {
        const script = `
          window.postMessage(JSON.stringify({
            type: 'DEEP_LINK_RECEIVED',
            url: '${parsedUrl.fullUrl}',
            data: ${JSON.stringify(parsedUrl)}
          }), '*');
        `;
        global.webViewRef.current.injectJavaScript(script);
      }

    } catch (error) {
      console.error('URL handling error:', error);
    }
  }

  parseUrl(url) {
    try {
      const urlObj = new URL(url);
      
      const result = {
        fullUrl: url,
        protocol: urlObj.protocol,
        host: urlObj.host,
        pathname: urlObj.pathname,
        search: urlObj.search,
        hash: urlObj.hash,
        params: {},
        isCustomScheme: false,
        isHttpScheme: false,
      };

      // URL 파라미터 파싱
      urlObj.searchParams.forEach((value, key) => {
        result.params[key] = value;
      });

      // 커스텀 스킴인지 확인
      if (urlObj.protocol.startsWith('app') || urlObj.protocol.startsWith('myapp')) {
        result.isCustomScheme = true;
        
        // 커스텀 스킴의 경우 호스트를 path로 처리
        if (urlObj.host) {
          result.customPath = urlObj.host + urlObj.pathname;
        }
      } else if (urlObj.protocol.startsWith('http')) {
        result.isHttpScheme = true;
      }

      return result;
    } catch (error) {
      console.error('URL parsing error:', error);
      return {
        fullUrl: url,
        error: error.message,
      };
    }
  }

  isValidUrl(url) {
    if (!url || typeof url !== 'string') {
      return false;
    }

    try {
      new URL(url);
      return true;
    } catch {
      // 커스텀 스킴 URL의 경우 URL 생성자가 실패할 수 있으므로 추가 검사
      const customSchemePattern = /^[a-zA-Z][a-zA-Z0-9+.-]*:/;
      return customSchemePattern.test(url);
    }
  }

  addUrlHandler(handler) {
    if (typeof handler === 'function') {
      this.urlHandlers.push(handler);
    }
  }

  removeUrlHandler(handler) {
    const index = this.urlHandlers.indexOf(handler);
    if (index > -1) {
      this.urlHandlers.splice(index, 1);
    }
  }

  async getLastDeepLink() {
    try {
      const url = await AsyncStorage.getItem('last_deeplink_url');
      const data = await AsyncStorage.getItem('last_deeplink_data');
      
      return {
        url,
        data: data ? JSON.parse(data) : null,
      };
    } catch (error) {
      console.error('Get last deep link error:', error);
      return null;
    }
  }

  async openUrl(url) {
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
        return true;
      } else {
        console.warn('URL is not supported:', url);
        return false;
      }
    } catch (error) {
      console.error('Open URL error:', error);
      return false;
    }
  }

  // 기본 URL과 딥링크 URL을 결합하여 웹뷰용 URL 생성
  async buildWebViewUrl(baseUrl, deepLinkData) {
    try {
      // FCM 토큰 가져오기
      const fcmToken = await AsyncStorage.getItem('fcm_token');
      
      const url = new URL(baseUrl);
      
      // FCM 토큰 추가
      if (fcmToken) {
        url.searchParams.set('token', fcmToken);
      }
      
      // 딥링크 파라미터 추가
      if (deepLinkData && deepLinkData.params) {
        Object.keys(deepLinkData.params).forEach(key => {
          url.searchParams.set(key, deepLinkData.params[key]);
        });
      }
      
      // 딥링크 경로 추가
      if (deepLinkData && deepLinkData.customPath) {
        url.searchParams.set('deeplink_path', deepLinkData.customPath);
      }
      
      // 딥링크 소스 추가
      url.searchParams.set('source', 'deeplink');
      
      return url.toString();
    } catch (error) {
      console.error('Build WebView URL error:', error);
      // 오류 시 기본 URL에 토큰만 추가하여 반환
      const fcmToken = await AsyncStorage.getItem('fcm_token');
      return fcmToken ? `${baseUrl}?token=${fcmToken}` : baseUrl;
    }
  }

  destroy() {
    if (this.linkingSubscription) {
      this.linkingSubscription?.remove();
    }
    
    this.urlHandlers = [];
    this.isInitialized = false;
    
    // 전역 함수 제거
    if (global.handleDeepLinkUrl) {
      delete global.handleDeepLinkUrl;
    }
    
    console.log('DeepLink Service destroyed');
  }

  // 앱 스킴 생성 헬퍼 함수들
  static generateCustomScheme(packageName) {
    // 패키지명에서 커스텀 스킴 생성 (예: com.example.app -> exampleapp)
    const parts = packageName.split('.');
    const scheme = parts[parts.length - 1].toLowerCase();
    return `${scheme}://`;
  }

  static generateUniversalLink(domain, packageName) {
    // Universal Link 형태 생성
    return `https://${domain}/${packageName.replace(/\./g, '/')}/`;
  }
}

export default new DeepLinkService();