package com.mi4labs.carnivorex;

import android.content.pm.ActivityInfo;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import app.lovable.plugins.healthconnect.HealthConnectPlugin;

public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(Bundle savedInstanceState) {
    registerPlugin(HealthConnectPlugin.class);
    // Phones (smallestScreenWidthDp < 600) are locked to portrait
    // (allowing reverse-portrait). Tablets keep full sensor rotation.
    boolean isTablet = getResources().getConfiguration().smallestScreenWidthDp >= 600;
    if (!isTablet) {
      setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_USER_PORTRAIT);
    }
    super.onCreate(savedInstanceState);
  }
}
