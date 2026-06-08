// swift-tools-version: 5.9
import PackageDescription

// DO NOT MODIFY THIS FILE - managed by Capacitor CLI commands
let package = Package(
    name: "CapApp-SPM",
    platforms: [.iOS(.v15)],
    products: [
        .library(
            name: "CapApp-SPM",
            targets: ["CapApp-SPM"])
    ],
    dependencies: [
        .package(url: "https://github.com/ionic-team/capacitor-swift-pm.git", exact: "8.3.0"),
        .package(name: "CapacitorCommunitySpeechRecognition", path: "../../../node_modules/@capacitor-community/speech-recognition"),
        .package(name: "CapacitorCommunityTextToSpeech", path: "../../../node_modules/@capacitor-community/text-to-speech"),
        .package(name: "CapgoCapacitorSocialLogin", path: "../../../node_modules/@capgo/capacitor-social-login"),
        .package(name: "CapacitorApp", path: "../../../node_modules/@capacitor/app"),
        .package(name: "CapacitorPushNotifications", path: "../../../node_modules/@capacitor/push-notifications"),
        .package(name: "RevenuecatPurchasesCapacitor", path: "../../../node_modules/@revenuecat/purchases-capacitor"),
        .package(name: "CapacitorNativeSettings", path: "../../../node_modules/capacitor-native-settings"),
        .package(name: "AppsflyerCapacitorPlugin", path: "../../../node_modules/appsflyer-capacitor-plugin")
    ],
    targets: [
        .target(
            name: "CapApp-SPM",
            dependencies: [
                .product(name: "Capacitor", package: "capacitor-swift-pm"),
                .product(name: "Cordova", package: "capacitor-swift-pm"),
                .product(name: "CapacitorCommunitySpeechRecognition", package: "CapacitorCommunitySpeechRecognition"),
                .product(name: "CapacitorCommunityTextToSpeech", package: "CapacitorCommunityTextToSpeech"),
                .product(name: "CapgoCapacitorSocialLogin", package: "CapgoCapacitorSocialLogin"),
                .product(name: "CapacitorApp", package: "CapacitorApp"),
                .product(name: "CapacitorPushNotifications", package: "CapacitorPushNotifications"),
                .product(name: "RevenuecatPurchasesCapacitor", package: "RevenuecatPurchasesCapacitor"),
                .product(name: "CapacitorNativeSettings", package: "CapacitorNativeSettings"),
                .product(name: "AppsflyerCapacitorPlugin", package: "AppsflyerCapacitorPlugin")
            ]
        )
    ]
)
    targets: [
        .target(
            name: "CapApp-SPM",
            dependencies: [
                .product(name: "Capacitor", package: "capacitor-swift-pm"),
                .product(name: "Cordova", package: "capacitor-swift-pm"),
                .product(name: "CapacitorCommunitySpeechRecognition", package: "CapacitorCommunitySpeechRecognition"),
                .product(name: "CapacitorCommunityTextToSpeech", package: "CapacitorCommunityTextToSpeech"),
                .product(name: "CapgoCapacitorSocialLogin", package: "CapgoCapacitorSocialLogin"),
                .product(name: "CapacitorApp", package: "CapacitorApp"),
                .product(name: "CapacitorPushNotifications", package: "CapacitorPushNotifications"),
                .product(name: "RevenuecatPurchasesCapacitor", package: "RevenuecatPurchasesCapacitor"),
                .product(name: "CapacitorNativeSettings", package: "CapacitorNativeSettings")
            ]
        )
    ]
)
