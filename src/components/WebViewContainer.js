import React, {forwardRef, useImperativeHandle, useRef, useState, useEffect} from 'react';
import {
  View,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Dimensions,
  Platform,
  Linking,
  Modal,
  SafeAreaView,
  TouchableOpacity,
  Text,
} from 'react-native';
import {WebView} from 'react-native-webview';
import Orientation from 'react-native-orientation-locker';

const WebViewContainer = forwardRef(({url, fcmToken, onUrlChange}, ref) => {
  const webViewRef = useRef(null);
  const popupWebViewRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [canGoBack, setCanGoBack] = useState(false);
  const loadingTimeoutRef = useRef(null);
  const loadStartTimeRef = useRef(null);
  const [popupVisible, setPopupVisible] = useState(false);
  const [popupUrl, setPopupUrl] = useState('');

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
      
      // PG 결제 호환성을 위한 설정
      // 결제 데이터 저장용 전역 변수
      window.__paymentData = window.__paymentData || {};
      
      // window.opener 설정 (결제창이 opener를 찾을 때)
      if (!window.opener) {
        window.opener = window;
      }
      
      // opener의 getFormData 함수 제공
      window.opener.getFormData = function() {
        console.log('getFormData called');
        return window.__paymentData || {};
      };
      
      // window.getFormData도 제공 (일부 PG사는 이렇게 호출)
      window.getFormData = function() {
        console.log('getFormData called from window');
        return window.__paymentData || {};
      };
      
      // 결제 데이터 설정 함수
      window.setPaymentData = function(data) {
        window.__paymentData = data;
        console.log('Payment data set:', data);
      };
      
      // window.open 오버라이드
      const originalOpen = window.open;
      window.open = function(url, name, features) {
        console.log('window.open called:', url, name, features);
        
        // 결제창인 경우 현재 창에서 열기
        if (name === '_blank' || name === 'payment' || url.includes('pay')) {
          // 새 창 객체 반환 (결제창이 참조할 수 있도록)
          const newWindow = {
            closed: false,
            opener: window,
            location: { href: url },
            document: { },
            getFormData: window.getFormData,
            postMessage: function(message, origin) {
              console.log('postMessage from payment window:', message);
            },
            close: function() {
              this.closed = true;
              window.history.back();
            }
          };
          
          // 현재 창에서 URL 로드
          window.location.href = url;
          
          return newWindow;
        }
        
        return originalOpen.call(window, url, name, features);
      };
      
      // iframe 지원 개선
      try {
        document.domain = document.domain;
      } catch(e) {
        console.log('Could not set document.domain');
      }
      
      // postMessage 호환성
      const originalPostMessage = window.postMessage;
      window.postMessage = function(message, targetOrigin) {
        console.log('postMessage:', message, targetOrigin);
        if (originalPostMessage) {
          originalPostMessage.call(window, message, targetOrigin);
        }
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
    console.log('URL Loading Request:', url);
    
    // 결제 관련 스킴 목록
    const paymentSchemes = [
      'intent://', // 안드로이드 인텐트
      'supertoss://', // 토스 앱
      'toss://', // 토스
      'kakaopay://', // 카카오페이
      'payco://', // 페이코
      'chaipay://', // 차이페이
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
    
    // 결제 관련 스킴인지 확인
    const isPaymentScheme = paymentSchemes.some(scheme => url.startsWith(scheme));
    
    // market:// 또는 앱스토어 URL 처리
    const isMarketUrl = url.startsWith('market://') || 
                       url.includes('play.google.com/store') ||
                       url.includes('apps.apple.com') ||
                       url.includes('itunes.apple.com');
    
    if (isPaymentScheme || isMarketUrl) {
      console.log('Opening payment app:', url);
      
      // 외부 앱으로 연결
      if (Platform.OS === 'android' && url.startsWith('intent://')) {
        // intent URL 파싱하여 앱 실행 시도
        try {
          // S.browser_fallback_url 추출
          const fallbackMatch = url.match(/S\.browser_fallback_url=([^;#]+)/);
          const packageMatch = url.match(/package=([^;#]+)/);
          
          // 먼저 intent URL로 앱 실행 시도
          Linking.openURL(url).catch(() => {
            // 실패시 fallback URL 또는 마켓으로 이동
            if (fallbackMatch && fallbackMatch[1]) {
              const fallbackUrl = decodeURIComponent(fallbackMatch[1]);
              Linking.openURL(fallbackUrl);
            } else if (packageMatch && packageMatch[1]) {
              // 패키지명으로 마켓 열기
              Linking.openURL(`market://details?id=${packageMatch[1]}`);
            } else {
              Alert.alert('알림', '토스 앱을 설치해주세요.');
            }
          });
        } catch (err) {
          console.error('Intent URL parsing error:', err);
        }
      } else {
        // 일반 URL Scheme 처리
        Linking.canOpenURL(url)
          .then((supported) => {
            if (supported) {
              Linking.openURL(url);
            } else {
              // 토스 관련 스킴인 경우 마켓으로 안내
              if (url.startsWith('supertoss://') || url.startsWith('toss://')) {
                Alert.alert(
                  '토스 앱 설치',
                  '토스 앱이 설치되어 있지 않습니다. 설치하시겠습니까?',
                  [
                    {text: '취소', style: 'cancel'},
                    {
                      text: '설치',
                      onPress: () => {
                        const marketUrl = Platform.OS === 'android'
                          ? 'market://details?id=viva.republica.toss'
                          : 'https://apps.apple.com/kr/app/id839333328';
                        Linking.openURL(marketUrl);
                      }
                    }
                  ]
                );
              } else {
                Alert.alert('알림', '해당 앱이 설치되어 있지 않습니다.');
              }
            }
          })
          .catch((err) => {
            console.error('URL open error:', err);
          });
      }
      return false; // WebView에서 로드하지 않음
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
        injectedJavaScriptBeforeContentLoaded={`
          // 페이지 로드 전에 필수 함수들 설정
          window.__paymentData = {};
          window.opener = window;
          window.opener.getFormData = function() {
            return window.__paymentData || {};
          };
          window.getFormData = function() {
            return window.__paymentData || {};
          };
          true;
        `}
        userAgent={userAgent}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        startInLoadingState={true}
        scalesPageToFit={false}
        mixedContentMode="always"
        allowsInlineMediaPlayback={true}
        mediaPlaybackRequiresUserAction={false}
        allowsFullscreenVideo={true}
        pullToRefreshEnabled={false}
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
        setSupportMultipleWindows={true}
        originWhitelist={['*']}
        javaScriptCanOpenWindowsAutomatically={true}
        cacheEnabled={true}
        cacheMode="LOAD_DEFAULT"
        incognito={false}
        onShouldStartLoadWithRequest={handleShouldStartLoadWithRequest}
        onOpenWindow={({nativeEvent}) => {
          // 새 창 열기 요청 (팝업)
          const newWindowUrl = nativeEvent.targetUrl;
          console.log('Popup window request:', newWindowUrl);
          
          if (newWindowUrl) {
            // 팝업 WebView 열기
            setPopupUrl(newWindowUrl);
            setPopupVisible(true);
          }
        }}
      />
      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      )}
      
      {/* 팝업 WebView Modal */}
      <Modal
        visible={popupVisible}
        animationType="slide"
        onRequestClose={() => setPopupVisible(false)}
        transparent={false}>
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity 
              onPress={() => {
                if (popupWebViewRef.current?.canGoBack) {
                  popupWebViewRef.current.goBack();
                } else {
                  setPopupVisible(false);
                  setPopupUrl('');
                }
              }}
              style={styles.modalButton}>
              <Text style={styles.modalButtonText}>{'< 뒤로'}</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>결제</Text>
            <TouchableOpacity 
              onPress={() => {
                setPopupVisible(false);
                setPopupUrl('');
                // 메인 WebView 새로고침
                if (webViewRef.current) {
                  webViewRef.current.reload();
                }
              }}
              style={styles.modalButton}>
              <Text style={styles.modalButtonText}>닫기</Text>
            </TouchableOpacity>
          </View>
          
          {popupUrl ? (
            <WebView
              ref={popupWebViewRef}
              source={{uri: popupUrl}}
              style={styles.webview}
              onShouldStartLoadWithRequest={handleShouldStartLoadWithRequest}
              javaScriptEnabled={true}
              domStorageEnabled={true}
              startInLoadingState={true}
              mixedContentMode="always"
              thirdPartyCookiesEnabled={true}
              sharedCookiesEnabled={true}
              setSupportMultipleWindows={false}
              originWhitelist={['*']}
              javaScriptCanOpenWindowsAutomatically={true}
              userAgent={userAgent}
              injectedJavaScriptBeforeContentLoaded={`
                // 팝업창에서도 opener 설정
                window.opener = window.parent || window;
                window.opener.getFormData = function() { return {}; };
                window.getFormData = function() { return {}; };
                true;
              `}
              onMessage={(event) => {
                // 팝업에서 메시지 처리
                console.log('Popup message:', event.nativeEvent.data);
              }}
              onNavigationStateChange={(navState) => {
                // 결제 완료 감지
                if (navState.url.includes('success') || 
                    navState.url.includes('complete') || 
                    navState.url.includes('callback')) {
                  setTimeout(() => {
                    setPopupVisible(false);
                    setPopupUrl('');
                    if (webViewRef.current) {
                      webViewRef.current.reload();
                    }
                  }, 1000);
                }
              }}
            />
          ) : null}
        </SafeAreaView>
      </Modal>
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
  modalContainer: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  modalHeader: {
    height: 44,
    backgroundColor: '#f8f8f8',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    paddingHorizontal: 10,
  },
  modalButton: {
    padding: 8,
    minWidth: 50,
  },
  modalButtonText: {
    color: '#007AFF',
    fontSize: 16,
  },
  modalTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default WebViewContainer;