import { useState } from 'react';
import { HealthConnect } from 'capacitor-health-connect';

export interface HealthData {
  steps: number;
  heartRate: number;
  weight: number;
  sleep: number;
}

export const useHealthConnect = () => {
  const [healthData, setHealthData] = useState<HealthData>({
    steps: 0,
    heartRate: 0,
    weight: 0,
    sleep: 0,
  });
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requestPermissions = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const status = await HealthConnect.checkAvailability();
      if (status.availability !== 'Available') {
        setError(`Health Connect not available: ${status.availability}`);
        return;
      }

      await HealthConnect.requestHealthPermissions({
        read: [
          { recordType: 'Steps' },
          { recordType: 'HeartRate' },
          { recordType: 'Weight' },
          { recordType: 'SleepSession' },
        ],
        write: [],
      });

      setIsConnected(true);
      await fetchHealthData();
    } catch (err: any) {
      setError(`Error: ${err?.message || 'Permission denied'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchHealthData = async () => {
    try {
      const now = new Date();
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);

      let steps = 0;
      let heartRate = 0;
      let weight = 0;
      let sleep = 0;

      try {
        const s = await HealthConnect.readRecords({
          type: 'Steps',
          timeRangeFilter: {
            type: 'between
