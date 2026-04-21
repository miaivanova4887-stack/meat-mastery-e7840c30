//
//  MainViewController.swift
//  CarnivoreX
//
//  Custom Capacitor bridge view controller that registers app-local
//  plugins (plugins living in the app target, not an SPM package).
//
//  Capacitor auto-discovers plugins from packageClassList in
//  capacitor.config.json, but that list is regenerated from node_modules
//  by `cap sync`, so custom in-app plugins have to be registered here.
//

import UIKit
import Capacitor

class MainViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(HealthConnectPlugin())
        bridge?.registerPluginInstance(AudioSessionPlugin())
    }
}
