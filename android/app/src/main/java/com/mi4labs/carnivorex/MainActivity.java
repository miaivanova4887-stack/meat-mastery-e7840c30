package com.mi4labs.carnivorex;

import android.content.pm.ActivityInfo;
import android.content.res.Configuration;
import android.os.Bundle;
import android.util.Log;
import com.getcapacitor.BridgeActivity;
import app.lovable.plugins.healthconnect.HealthConnectPlugin;

public class MainActivity extends BridgeActivity {
  private static final String TAG = "CarnivoreXOrientation";

  private void applyPhonePortraitLock(String stage) {
    int sw = getResources().getConfiguration().smallestScreenWidthDp;
    boolean isTablet = sw >= 600;
    int target = isTablet
      ? ActivityInfo.SCREEN_ORIENTATION_FULL_USER
      : ActivityInfo.SCREEN_ORIENTATION_PORTRAIT;
    try {
      setRequestedOrientation(target);
      Log.i(TAG, "stage=" + stage + " tablet=" + isTablet + " smallestScreenWidthDp=" + sw
        + " applying=" + (isTablet ? "SCREEN_ORIENTATION_FULL_USER" : "SCREEN_ORIENTATION_PORTRAIT")
        + " constant=" + target);
    } catch (Throwable t) {
      Log.w(TAG, "stage=" + stage + " setRequestedOrientation threw", t);
    }
    Log.i(TAG, "stage=" + stage + " requestedOrientationAfter=" + getRequestedOrientation());
  }

  @Override
  public void onCreate(Bundle savedInstanceState) {
    registerPlugin(HealthConnectPlugin.class);
    applyPhonePortraitLock("before-super");
    super.onCreate(savedInstanceState);
    applyPhonePortraitLock("after-super");
  }

  @Override
  public void onConfigurationChanged(Configuration newConfig) {
    super.onConfigurationChanged(newConfig);
    applyPhonePortraitLock("onConfigurationChanged");
  }
}
