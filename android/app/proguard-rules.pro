# Rhino (used by NewPipeExtractor) references desktop-only classes.
-dontwarn java.beans.**
-dontwarn javax.script.**
-dontwarn org.mozilla.javascript.**

# Keep the JavaScript bridge used by the WebView UI.
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}
-keep class com.gathin.karaoke.MainActivity$YouTubeBridge { *; }

# NewPipeExtractor resolves services and parsers reflectively.
-keep class org.schabi.newpipe.extractor.** { *; }
-keep class org.schabi.newpipe.extractor.services.** { *; }
-dontwarn org.schabi.newpipe.**

# Local HTTP server and its NanoHTTPD internals.
-keep class fi.iki.elonen.** { *; }

# AmneziaWG / WireGuard JNI and service classes.
-keep class com.zaneschepke.** { *; }
-keep class org.amnezia.** { *; }
-keep class com.wireguard.** { *; }
-dontwarn org.amnezia.**
-dontwarn com.wireguard.**
