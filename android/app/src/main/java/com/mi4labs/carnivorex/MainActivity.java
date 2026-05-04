package com.mi4labs.carnivorex;

import android.content.pm.ActivityInfo;
import android.content.res.Configuration;
import android.os.Bundle;
import android.util.Log;
import com.getcapacitor.BridgeActivity;
import app.lovable.plugins.healthconnect.HealthConnectPlugin;

public class MainActivity extends BridgeActivity {
  private static final String TAG = "CarnivoreXOrientation";

  /**
   * Phone-vs-tablet detection. We require BOTH a wide smallestScreenWidthDp
   * AND the SCREENLAYOUT_SIZE_LARGE/XLARGE bit. Many modern phones (foldables,
   * large flagships in landscape, multi-window) report sw>=600 but are NOT
   * tablets — using sw alone unlocked rotation on phones in past builds.
   */
  private boolean isTabletDevice(Configuration cfg) {
    int sizeMask = cfg.screenLayout & Configuration.SCREENLAYOUT_SIZE_MASK;
    boolean largeBit = sizeMask >= Configuration.SCREENLAYOUT_SIZE_LARGE;
    boolean wideSw   = cfg.smallestScreenWidthDp >= 600;
    return largeBit && wideSw;
  }

  private void applyPhonePortraitLock(String stage) {
    Configuration cfg = getResources().getConfiguration();
    boolean isTablet = isTabletDevice(cfg);
    int target = isTablet
      ? ActivityInfo.SCREEN_ORIENTATION_FULL_USER
      : ActivityInfo.SCREEN_ORIENTATION_PORTRAIT;
    Log.i(TAG, "stage=" + stage
      + " sw=" + cfg.smallestScreenWidthDp
      + " screenLayoutSize=" + (cfg.screenLayout & Configuration.SCREENLAYOUT_SIZE_MASK)
      + " isTablet=" + isTablet
      + " applying=" + (isTablet ? "FULL_USER" : "PORTRAIT")
      + " constant=" + target);
    try {
      setRequestedOrientation(target);
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
  public void onStart() {
    super.onStart();
    applyPhonePortraitLock("onStart");
  }

  @Override
  public void onResume() {
    super.onResume();
    applyPhonePortraitLock("onResume");
  }

  @Override
  public void onConfigurationChanged(Configuration newConfig) {
    super.onConfigurationChanged(newConfig);
    applyPhonePortraitLock("onConfigurationChanged");
  }
}
