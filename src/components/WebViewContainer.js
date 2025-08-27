import React, {forwardRef, useImperativeHandle, useRef, useState, useEffect} from 'react';
import {
  View,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Dimensions,
  Platform,
  Linking,
} from 'react-native';
import {WebView} from 'react-native-webview';
import Orientation from 'react-native-orientation-locker';

const WebViewContainer = forwardRef(({url, fcmToken, onUrlChange}, ref) => {
  const webViewRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [canGoBack, setCanGoBack] = useState(false);
  const loadingTimeoutRef = useRef(null);
  const loadStartTimeRef = useRef(null);

  useImperativeHandle(ref, () => ({
    goBack: () => {
      if (canGoBack && webViewRef.current) {
        webViewRef.current.goBack();
      }
    },
    reload: () => {
      if (webViewRef.current) {
        webViewRef.current.reload();
      }
    },
    injectJavaScript: (script) => {
      if (webViewRef.current) {
        webViewRef.current.injectJavaScript(script);
      }
    },
  }));

  // 컴포넌트 언마운트 시 타이머 정리
  useEffect(() => {
    return () => {
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
      }
    };
  }, []);

  const handleLoadStart = () => {
    setLoading(true);
    loadStartTimeRef.current = Date.now();
    
    // 기존 타임아웃 클리어
    if (loadingTimeoutRef.current) {
      clearTimeout(loadingTimeoutRef.current);
    }
    
    // 10초 후 자동으로 로딩 인디케이터 숨기기
    loadingTimeoutRef.current = setTimeout(() => {
      console.warn('Loading timeout - forcing loading indicator off');
      setLoading(false);
    }, 10000);
  };

  const handleLoadEnd = () => {
    // 타임아웃 클리어
    if (loadingTimeoutRef.current) {
      clearTimeout(loadingTimeoutRef.current);
      loadingTimeoutRef.current = null;
    }
    
    // 로딩 시간 로깅
    if (loadStartTimeRef.current) {
      const loadTime = Date.now() - loadStartTimeRef.current;
      console.log(`Page loaded in ${loadTime}ms`);
    }
    
    setLoading(false);
  };

  const handleLoadProgress = ({nativeEvent}) => {
    // 95% 이상 로드되면 로딩 인디케이터 숨기기
    if (nativeEvent.progress > 0.95) {
      setLoading(false);
    }
  };

  const handleNavigationStateChange = (navState) => {
    setCanGoBack(navState.canGoBack);
    
    if (onUrlChange && navState.url !== url) {
      onUrlChange(navState.url);
    }
  };

  const handleError = (syntheticEvent) => {
    const {nativeEvent} = syntheticEvent;
    console.warn('WebView error: ', nativeEvent);
    Alert.alert(
      '연결 오류',
      '페이지를 불러올 수 없습니다. 네트워크 연결을 확인해주세요.',
      [
        {text: '다시시도', onPress: () => webViewRef.current?.reload()},
        {text: '취소', style: 'cancel'},
      ]
    );
  };

  const handleMessage = (event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      
      if (data.type === 'ORIENTATION_CHANGE') {
        if (data.orientation === 'landscape') {
          Orientation.lockToLandscape();
        } else {
          Orientation.lockToPortrait();
        }
      }
      
      if (data.type === 'FCM_TOKEN_REQUEST') {
        const script = `
          window.postMessage(JSON.stringify({
            type: 'FCM_TOKEN_RESPONSE',
            token: '${fcmToken}'
          }), '*');
        `;
        webViewRef.current?.injectJavaScript(script);
      }
      
      // DOM 로드 완료 시 로딩 인디케이터 숨기기
      if (data.type === 'PAGE_LOADED') {
        console.log('Page DOM loaded - hiding loading indicator');
        setLoading(false);
        if (loadingTimeoutRef.current) {
          clearTimeout(loadingTimeoutRef.current);
          loadingTimeoutRef.current = null;
        }
      }
    } catch (error) {
      console.warn('Message parsing error:', error);
    }
  };

  const injectedJavaScript = `
    (function() {
      // FCM 토큰을 웹페이지에서 접근 가능하도록 설정
      window.fcmToken = '${fcmToken}';
      
      // 토큰 요청 함수
      window.requestFCMToken = function() {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'FCM_TOKEN_REQUEST'
        }));
      };
      
      // 방향 변경 함수
      window.changeOrientation = function(orientation) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'ORIENTATION_CHANGE',
          orientation: orientation
        }));
      };
      
      // 뒤로가기 함수
      window.goBack = function() {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'GO_BACK'
        }));
      };
      
      // DOM 로드 완료 감지
      if (document.readyState === 'complete' || document.readyState === 'interactive') {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'PAGE_LOADED'
        }));
      } else {
        window.addEventListener('DOMContentLoaded', function() {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'PAGE_LOADED'
          }));
        });
      }
      
      true;
    })();
  `;

  const userAgent = Platform.OS === 'android' 
    ? 'Mozilla/5.0 (Linux; Android 10; Mobile App) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/88.0.4324.181 Mobile Safari/537.36'
    : 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1';

  // 결제 관련 URL 처리
  const handleShouldStartLoadWithRequest = (request) => {
    const url = request.url;
    
    // 결제 관련 스킴 목록
    const paymentSchemes = [
      'intent://', // 안드로이드 인텐트
      'kakaopay://', // 카카오페이
      'payco://', // 페이코
      'chaipay://', // 차이페이
      'toss://', // 토스
      'naverpay://', // 네이버페이
      'samsungpay://', // 삼성페이
      'kbankpay://', // 케이뱅크
      'ispmobile://', // ISP 모바일
      'hdcardappcardansimclick://', // 현대카드
      'shinhan-sr-ansimclick://', // 신한카드
      'kb-acp://', // 국민카드
      'mpocket.online.ansimclick://', // 삼성카드
      'lottemembers://', // 롯데카드
      'lotteappcard://', // 롯데앱카드
      'cloudpay://', // 하나카드
      'nhappcardansimclick://', // 농협카드
      'citispay://', // 씨티카드
      'citicardappkr://', // 씨티카드 한국
      'wooripay://', // 우리페이
      'shinsegaeeasypayment://', // 신세계페이
      'lpayapp://', // L페이
      'hanawalletmembers://', // 하나월렛
      'tauthlink://', // 패스 인증
      'ktauthexternalcall://', // KT 인증
      'upluscorporation://', // LG U+ 인증
    ];
    
    // 결제 관련 도메인 (PG사)
    const paymentDomains = [
      'pgapi.korpay.com',
      'kcp.co.kr',
      'inicis.com',
      'nicepay.co.kr',
      'danal.co.kr',
      'kicc.co.kr',
      'mobilians.co.kr',
      'paygate.net',
      'galaxia.co.kr',
      'tosspayments.com',
      'bootpay.co.kr',
      'iamport.kr',
    ];
    
    // 결제 관련 스킴인지 확인
    const isPaymentScheme = paymentSchemes.some(scheme => url.startsWith(scheme));
    
    // 결제 관련 도메인인지 확인
    const isPaymentDomain = paymentDomains.some(domain => url.includes(domain));
    
    // market:// 또는 앱스토어 URL 처리
    const isMarketUrl = url.startsWith('market://') || 
                       url.includes('play.google.com/store') ||
                       url.includes('apps.apple.com') ||
                       url.includes('itunes.apple.com');
    
    if (isPaymentScheme || isMarketUrl) {
      // 외부 앱으로 연결
      if (Platform.OS === 'android' && url.startsWith('intent://')) {
        // 안드로이드 인텐트 URL 처리
        const intentUrl = url.replace('intent://', 'https://');
        Linking.canOpenURL(intentUrl)
          .then((supported) => {
            if (supported) {
              Linking.openURL(url);
            } else {
              // 마켓 URL 추출 시도
              const marketMatch = url.match(/market:\/\/[^#]+/);
              if (marketMatch) {
                Linking.openURL(marketMatch[0]);
              } else {
                Alert.alert('알림', '해당 앱이 설치되어 있지 않습니다.');
              }
            }
          })
          .catch((err) => {
            console.error('URL open error:', err);
            Alert.alert('오류', '앱을 열 수 없습니다.');
          });
      } else {
        // 일반 URL Scheme 처리
        Linking.canOpenURL(url)
          .then((supported) => {
            if (supported) {
              Linking.openURL(url);
            } else {
              Alert.alert('알림', '해당 앱이 설치되어 있지 않습니다.');
            }
          })
          .catch((err) => {
            console.error('URL open error:', err);
            Alert.alert('오류', '앱을 열 수 없습니다.');
          });
      }
      return false; // WebView에서 로드하지 않음
    }
    
    // 결제 페이지에서 window.open 대체 처리
    if (isPaymentDomain) {
      // 결제 페이지는 WebView에서 계속 처리
      return true;
    }
    
    return true; // 일반 URL은 WebView에서 로드
  };

  return (
    <View style={styles.container}>
      <WebView
        ref={webViewRef}
        source={{uri: url}}
        style={styles.webview}
        onLoadStart={handleLoadStart}
        onLoadEnd={handleLoadEnd}
        onLoadProgress={handleLoadProgress}
        onError={handleError}
        onNavigationStateChange={handleNavigationStateChange}
        onMessage={handleMessage}
        injectedJavaScript={injectedJavaScript}
        userAgent={userAgent}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        startInLoadingState={true}
        scalesPageToFit={true}
        mixedContentMode="always"
        allowsInlineMediaPlayback={true}
        mediaPlaybackRequiresUserAction={false}
        allowsFullscreenVideo={true}
        pullToRefreshEnabled={true}
        bounces={false}
        scrollEnabled={true}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        overScrollMode="never"
        nestedScrollEnabled={true}
        thirdPartyCookiesEnabled={true}
        sharedCookiesEnabled={true}
        allowFileAccess={true}
        allowUniversalAccessFromFileURLs={true}
        allowFileAccessFromFileURLs={true}
        setSupportMultipleWindows={false}
        onShouldStartLoadWithRequest={handleShouldStartLoadWithRequest}
      />
      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  webview: {
    flex: 1,
  },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
  },
});

export default WebViewContainer;