import React, {forwardRef, useImperativeHandle, useRef, useState} from 'react';
import {
  View,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Dimensions,
  Platform,
} from 'react-native';
import {WebView} from 'react-native-webview';
import Orientation from 'react-native-orientation-locker';

const WebViewContainer = forwardRef(({url, fcmToken, onUrlChange}, ref) => {
  const webViewRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [canGoBack, setCanGoBack] = useState(false);

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

  const handleLoadStart = () => {
    setLoading(true);
  };

  const handleLoadEnd = () => {
    setLoading(false);
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
      
      true;
    })();
  `;

  const userAgent = Platform.OS === 'android' 
    ? 'Mozilla/5.0 (Linux; Android 10; Mobile App) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/88.0.4324.181 Mobile Safari/537.36'
    : 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1';

  return (
    <View style={styles.container}>
      <WebView
        ref={webViewRef}
        source={{uri: url}}
        style={styles.webview}
        onLoadStart={handleLoadStart}
        onLoadEnd={handleLoadEnd}
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
        onShouldStartLoadWithRequest={(request) => {
          return true;
        }}
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