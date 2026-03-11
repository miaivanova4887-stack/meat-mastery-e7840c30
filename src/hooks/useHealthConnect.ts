import { useState } from 'react';
import { Health } from '@capgo/capacitor-health';

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
      const availability = await Health.isAvailable();
      if (!availability.available) {
        setError(`Health Connect not available: ${availability.reason}`);
        return;
      }
      await Health.requestAuthorization({
        read: ['steps', 'heartRate', 'weight', 'sleep'],
        write: [],
      });
      setIsConnected(true);
      await fetchHealthData();
    } catch (err: any) {
      setError(`Error: ${err.message || 'Permission denied'}`);
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchHealthData = async () => {
    try {
      const now = new Date();
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);

      const stepsResult = await Health.readSamples({
        dataType: 'steps',
        startDate: startOfDay.toISOString(),
        endDate: now.toISOString(),
        limit: 50,
      });

      const hrResult = await Health.readSamples({
        dataType: 'heartRate',
        startDate: startOfDay.toISOString(),
        endDate: now.toISOString(),
        limit: 1,
      });

      const weightResult = await Health.readSamples({
        dataType: 'weight',
        startDate: startOfDay.toISOString(),
        endDate: now.toISOString(),
        limit: 1,
      });

      const sleepResult = await Health.readSamples({
        dataType: 'sleep',
        startDate: startOfDay.toISOString(),
        endDate: now.toISOString(),
        limit: 1,
      });

      setHealthData({
        steps: stepsResult?.samples?.reduce(
          (sum: number, s: any) => sum + (s.value || 0), 0) || 0,
        heartRate: hrResult?.samples?.[0]?.value || 0,
        weight: weightResult?.samples?.[0]?.value || 0,
        sleep: sleepResult?.samples?.[0]?.value || 0,
      });
    } catch (err) {
      console.error('Error fetching health data:', err);
    }
  };

  return {
    healthData,
    isConnected,
    isLoading,
    error,
    requestPermissions,
    fetchHealthData,
  };
};
