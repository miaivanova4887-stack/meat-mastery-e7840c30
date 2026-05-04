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
    if (!isTablet) {
      try {
        setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_PORTRAIT);
        Log.i(TAG, "stage=" + stage + " tablet=false smallestScreenWidthDp=" + sw
          + " applying=SCREEN_ORIENTATION_PORTRAIT constant=" + ActivityInfo.SCREEN_ORIENTATION_PORTRAIT);
      } catch (Throwable t) {
        Log.w(TAG, "stage=" + stage + " setRequestedOrientation threw", t);
      }
      Log.i(TAG, "stage=" + stage + " requestedOrientationAfter=" + getRequestedOrientation());
    } else {
      Log.i(TAG, "stage=" + stage + " tablet=true smallestScreenWidthDp=" + sw + " applied=false");
    }
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
