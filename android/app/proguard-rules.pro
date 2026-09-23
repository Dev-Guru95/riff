# The JS bridge is called by name from page script — keep its exported members.
-keepclassmembers class com.riff.app.RiffBridge {
    public *;
}
-keepattributes JavascriptInterface
-keepattributes *Annotation*
