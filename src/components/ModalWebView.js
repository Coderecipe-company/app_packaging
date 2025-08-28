import React, {useRef, useState} from 'react';
import {
  Modal,
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  SafeAreaView,
  ActivityIndicator,
  Linking,
  Platform,
} from 'react-native';
import {WebView} from 'react-native-webview';

const ModalWebView = ({visible, url, onClose, onNavigationStateChange}) => {
  const webViewRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [canGoBack, setCanGoBack] = useState(false);
  const [title, setTitle] = useState('');

  const handleNavigationStateChange = (navState) => {
    setCanGoBack(navState.canGoBack);
    setTitle(navState.title || '결제');
    
    if (onNavigationStateChange) {
      onNavigationStateChange(navState);
    }
    
    // 결제 완료 URL 패턴 확인
    const successPatterns = [
      'success',
      'complete',
      'finish',
      'return',
      'callback'
    ];
    
    const isSuccessUrl = successPatterns.some(pattern => 
      navState.url.toLowerCase().includes(pattern)
    );
    
    if (isSuccessUrl) {
      // 결제 완료 후 자동으로 닫기 (1초 후)
      setTimeout(() => {
        onClose(navState.url);
      }, 1000);
    }
  };

  const handleShouldStartLoadWithRequest = (request) => {
    const url = request.url;
    
    // 결제 앱 스킴 처리
    const paymentSchemes = [
      'intent://',
      'kakaopay://',
      'payco://',
      'chaipay://',
      'toss://',
      'naverpay://',
      'samsungpay://',
      'kbankpay://',
      'ispmobile://',
      'hdcardappcardansimclick://',
      'shinhan-sr-ansimclick://',
      'kb-acp://',
      'mpocket.online.ansimclick://',
      'lottemembers://',
      'lotteappcard://',
      'cloudpay://',
      'nhappcardansimclick://',
      'citispay://',
      'citicardappkr://',
      'wooripay://',
      'shinsegaeeasypayment://',
      'lpayapp://',
      'hanawalletmembers://',
      'tauthlink://',
      'ktauthexternalcall://',
      'upluscorporation://',
    ];
    
    const isPaymentScheme = paymentSchemes.some(scheme => url.startsWith(scheme));
    const isMarketUrl = url.startsWith('market://') || 
                       url.includes('play.google.com/store') ||
                       url.includes('apps.apple.com');
    
    if (isPaymentScheme || isMarketUrl) {
      if (Platform.OS === 'android' && url.startsWith('intent://')) {
        // 안드로이드 인텐트 처리
        const intentUrl = url.replace('intent://', 'https://');
        Linking.canOpenURL(intentUrl)
          .then((supported) => {
            if (supported) {
              Linking.openURL(url);
            } else {
              const marketMatch = url.match(/market:\/\/[^#]+/);
              if (marketMatch) {
                Linking.openURL(marketMatch[0]);
              }
            }
          })
          .catch((err) => console.error('URL open error:', err));
      } else {
        Linking.canOpenURL(url)
          .then((supported) => {
            if (supported) {
              Linking.openURL(url);
            }
          })
          .catch((err) => console.error('URL open error:', err));
      }
      return false;
    }
    
    return true;
  };

  const handleGoBack = () => {
    if (canGoBack && webViewRef.current) {
      webViewRef.current.goBack();
    } else {
      onClose();
    }
  };

  const injectedJavaScript = `
    (function() {
      // 결제 페이지 호환성을 위한 스크립트
      window.ReactNativeWebView = window.ReactNativeWebView || {};
      
      // opener 관련 함수 제공
      if (!window.opener) {
        window.opener = {
          postMessage: function(data, origin) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'OPENER_MESSAGE',
              data: data,
              origin: origin
            }));
          },
          close: function() {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'CLOSE_WINDOW'
            }));
          }
        };
      }
      
      // 결제 완료 감지
      const checkPaymentComplete = function() {
        const bodyText = document.body.innerText || '';
        if (bodyText.includes('결제완료') || 
            bodyText.includes('결제 완료') || 
            bodyText.includes('주문완료') ||
            bodyText.includes('payment complete')) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'PAYMENT_COMPLETE'
          }));
        }
      };
      
      // DOM 변경 감지
      const observer = new MutationObserver(checkPaymentComplete);
      observer.observe(document.body, { childList: true, subtree: true });
      
      true;
    })();
  `;

  const handleMessage = (event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      
      if (data.type === 'CLOSE_WINDOW' || data.type === 'PAYMENT_COMPLETE') {
        onClose(data);
      }
      
      if (data.type === 'OPENER_MESSAGE') {
        // 부모 창으로 메시지 전달이 필요한 경우
        console.log('Message to opener:', data);
      }
    } catch (error) {
      console.warn('Message parsing error:', error);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={handleGoBack}
      transparent={false}>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleGoBack} style={styles.headerButton}>
            <Text style={styles.headerButtonText}>{'< 뒤로'}</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {title}
          </Text>
          <TouchableOpacity onPress={onClose} style={styles.headerButton}>
            <Text style={styles.headerButtonText}>닫기</Text>
          </TouchableOpacity>
        </View>
        
        {url && (
          <WebView
            ref={webViewRef}
            source={{uri: url}}
            style={styles.webview}
            onLoadStart={() => setLoading(true)}
            onLoadEnd={() => setLoading(false)}
            onNavigationStateChange={handleNavigationStateChange}
            onShouldStartLoadWithRequest={handleShouldStartLoadWithRequest}
            onMessage={handleMessage}
            injectedJavaScript={injectedJavaScript}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            startInLoadingState={true}
            mixedContentMode="always"
            allowsInlineMediaPlayback={true}
            mediaPlaybackRequiresUserAction={false}
            thirdPartyCookiesEnabled={true}
            sharedCookiesEnabled={true}
            setSupportMultipleWindows={false}
            userAgent={Platform.OS === 'android' 
              ? 'Mozilla/5.0 (Linux; Android 10; Mobile App) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/88.0.4324.181 Mobile Safari/537.36'
              : 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1'}
          />
        )}
        
        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#007AFF" />
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  header: {
    height: 44,
    backgroundColor: '#f8f8f8',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    paddingHorizontal: 10,
  },
  headerButton: {
    padding: 8,
    minWidth: 50,
  },
  headerButtonText: {
    color: '#007AFF',
    fontSize: 16,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
    marginHorizontal: 10,
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

export default ModalWebView;