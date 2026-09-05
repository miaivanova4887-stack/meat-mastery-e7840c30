# Add project specific ProGuard rules here.
# You can control the set of applied configuration files using the
# proguardFiles setting in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# If your project uses WebView with JS, uncomment the following
# and specify the fully qualified class name to the JavaScript interface
# class:
#-keepclassmembers class fqcn.of.javascript.interface.for.webview {
#   public *;
#}

# Uncomment this to preserve the line number information for
# debugging stack traces.
#-keepattributes SourceFile,LineNumberTable

# If you keep the line number information, uncomment this to
# hide the original source file name.
#-renamesourcefileattribute SourceFile

# ---------------------------------------------------------------------------
# In-app purchases (RevenueCat + Google Play Billing)
# Release builds shrink and rename code; the billing/purchases SDKs are
# reflection-heavy, and stripping them makes the store return no products,
# which surfaces in the app as subscriptions showing "Unavailable".
# ---------------------------------------------------------------------------
-keep class com.revenuecat.purchases.** { *; }
-keep interface com.revenuecat.purchases.** { *; }
-keepclassmembers class com.revenuecat.purchases.** { *; }
-dontwarn com.revenuecat.purchases.**

-keep class com.android.billingclient.** { *; }
-keep interface com.android.billingclient.** { *; }
-keepclassmembers class com.android.billingclient.** { *; }
-dontwarn com.android.billingclient.**

-keep class com.android.vending.billing.** { *; }
-dontwarn com.android.vending.billing.**

# Capacitor bridges plugin methods reflectively.
-keep @com.getcapacitor.annotation.CapacitorPlugin public class * { @com.getcapacitor.PluginMethod public <methods>; }
-keepclassmembers class * extends com.getcapacitor.Plugin { @com.getcapacitor.PluginMethod public <methods>; }

# Kotlin metadata + coroutines used by the purchases SDK.
-keep class kotlin.Metadata { *; }
-dontwarn kotlinx.coroutines.**
