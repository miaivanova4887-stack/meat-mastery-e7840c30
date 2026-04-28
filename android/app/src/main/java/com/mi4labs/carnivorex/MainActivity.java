package com.mi4labs.carnivorex;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import app.lovable.plugins.healthconnect.HealthConnectPlugin;

public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(Bundle savedInstanceState) {
    registerPlugin(HealthConnectPlugin.class);
    super.onCreate(savedInstanceState);
  }
}
