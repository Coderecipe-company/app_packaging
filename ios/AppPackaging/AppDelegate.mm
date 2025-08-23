#import "AppDelegate.h"

#import <React/RCTBundleURLProvider.h>
#import <React/RCTLinkingManager.h>
#import <Firebase.h>
#import <FirebaseMessaging.h>
#import <UserNotifications/UserNotifications.h>
#import "RNSplashScreen.h"

@implementation AppDelegate

- (BOOL)application:(UIApplication *)application didFinishLaunchingWithOptions:(NSDictionary *)launchOptions
{
  // Firebase 초기화
  if ([FIRApp defaultApp] == nil) {
    [FIRApp configure];
  }
  
  // FCM 설정
  [FIRMessaging messaging].delegate = self;
  
  // 알림 권한 요청
  UNUserNotificationCenter *center = [UNUserNotificationCenter currentNotificationCenter];
  center.delegate = self;
  [center requestAuthorizationWithOptions:(UNAuthorizationOptionAlert | UNAuthorizationOptionSound | UNAuthorizationOptionBadge)
                        completionHandler:^(BOOL granted, NSError * _Nullable error) {
    if (granted) {
      NSLog(@"Notification permission granted");
    }
  }];
  
  [application registerForRemoteNotifications];
  
  self.moduleName = @"AppPackaging";
  self.initialProps = @{};

  BOOL result = [super application:application didFinishLaunchingWithOptions:launchOptions];
  
  // 스플래시 스크린 표시
  [RNSplashScreen show];
  
  return result;
}

- (NSURL *)sourceURLForBridge:(RCTBridge *)bridge
{
#if DEBUG
  return [[RCTBundleURLProvider sharedSettings] jsBundleURLForBundleRoot:@"index"];
#else
  return [[NSBundle mainBundle] URLForResource:@"main" withExtension:@"jsbundle"];
#endif
}

// 딥링크 처리
- (BOOL)application:(UIApplication *)application
   openURL:(NSURL *)url
   options:(NSDictionary<UIApplicationOpenURLOptionsKey,id> *)options
{
  return [RCTLinkingManager application:application openURL:url options:options];
}

// Universal Links 처리
- (BOOL)application:(UIApplication *)application continueUserActivity:(nonnull NSUserActivity *)userActivity
 restorationHandler:(nonnull void (^)(NSArray<id<UIUserActivityRestoring>> * _Nullable))restorationHandler
{
  return [RCTLinkingManager application:application
                   continueUserActivity:userActivity
                     restorationHandler:restorationHandler];
}

// APNs 토큰 등록 성공
- (void)application:(UIApplication *)application didRegisterForRemoteNotificationsWithDeviceToken:(NSData *)deviceToken {
  [FIRMessaging messaging].APNSToken = deviceToken;
}

// APNs 토큰 등록 실패
- (void)application:(UIApplication *)application didFailToRegisterForRemoteNotificationsWithError:(NSError *)error {
  NSLog(@"Failed to register for remote notifications: %@", error);
}

#pragma mark - FCM Delegate

// FCM 토큰 갱신
- (void)messaging:(FIRMessaging *)messaging didReceiveRegistrationToken:(NSString *)fcmToken {
  NSLog(@"FCM registration token: %@", fcmToken);
  
  // 토큰을 React Native로 전달
  [[NSNotificationCenter defaultCenter] postNotificationName:@"FCMTokenReceived" 
                                                      object:nil 
                                                    userInfo:@{@"token": fcmToken}];
}

#pragma mark - UNUserNotificationCenter Delegate

// 포어그라운드에서 알림 수신
- (void)userNotificationCenter:(UNUserNotificationCenter *)center
       willPresentNotification:(UNNotification *)notification
         withCompletionHandler:(void (^)(UNNotificationPresentationOptions options))completionHandler {
  
  NSDictionary *userInfo = notification.request.content.userInfo;
  NSLog(@"Foreground notification received: %@", userInfo);
  
  // 포어그라운드에서도 알림 표시
  completionHandler(UNNotificationPresentationOptionAlert | UNNotificationPresentationOptionBadge | UNNotificationPresentationOptionSound);
}

// 알림 탭 처리
- (void)userNotificationCenter:(UNUserNotificationCenter *)center
didReceiveNotificationResponse:(UNNotificationResponse *)response
         withCompletionHandler:(void(^)(void))completionHandler {
  
  NSDictionary *userInfo = response.notification.request.content.userInfo;
  NSLog(@"Notification tapped: %@", userInfo);
  
  // 딥링크 URL이 있는 경우 처리
  NSString *deepLinkUrl = userInfo[@"url"];
  if (deepLinkUrl) {
    [[NSNotificationCenter defaultCenter] postNotificationName:@"NotificationDeepLink" 
                                                        object:nil 
                                                      userInfo:@{@"url": deepLinkUrl}];
  }
  
  completionHandler();
}

@end