package com.mi4labs.carnivorex;

import android.content.pm.ActivityInfo;
import android.content.res.Configuration;
import android.os.Bundle;
import android.util.Log;
import com.getcapacitor.BridgeActivity;
import app.lovable.plugins.healthconnect.HealthConnectPlugin;

public class MainActivity extends BridgeActivity {
  private static final String TAG = "CarnivoreXOrientation";

  @Override
  public void onCreate(Bundle savedInstanceState) {
    registerPlugin(HealthConnectPlugin.class);
    super.onCreate(savedInstanceState);

    // Hard portrait lock for phones (smallestScreenWidthDp < 600).
    // Tablets keep full sensor rotation.
    boolean isTablet = getResources().getConfiguration().smallestScreenWidthDp >= 600;
    Log.i(TAG, "isTablet=" + isTablet + " sw=" + getResources().getConfiguration().smallestScreenWidthDp);
    if (!isTablet) {
      setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_PORTRAIT);
      Log.i(TAG, "applied=true orientation=PORTRAIT");
    } else {
      Log.i(TAG, "applied=false (tablet)");
    }
  }

  @Override
  public void onConfigurationChanged(Configuration newConfig) {
    super.onConfigurationChanged(newConfig);
    // Re-assert portrait lock if device config changes (multi-window, fold/unfold)
    boolean isTablet = newConfig.smallestScreenWidthDp >= 600;
    if (!isTablet && getRequestedOrientation() != ActivityInfo.SCREEN_ORIENTATION_PORTRAIT) {
      setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_PORTRAIT);
      Log.i(TAG, "re-applied PORTRAIT on configChange");
    }
  }
}
