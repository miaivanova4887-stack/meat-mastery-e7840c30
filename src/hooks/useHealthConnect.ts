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
      await Health.requestAuthorization({
        read: ['steps', 'heartRate', 'weight'],
        write: [],
      });
      setIsConnected(true);
      await fetchHealthData();
    } catch (err: any) {
      setError(`Error: ${err?.message || JSON.stringify(err) || 'Permission denied'}`);
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

      try {
        const stepsResult = await Health.readSamples({
          dataType: 'steps',
          startDate: startOfDay.toISOString(),
          endDate: now.toISOString(),
          limit: 50,
        });
        steps = stepsResult?.samples?.reduce(
          (sum: number, s: any) => sum + (s.value || 0), 0) || 0;
      } catch (e) { console.log('steps error', e); }

      try {
        const hrResult = await Health.readSamples({
          dataType: 'heartRate',
          startDate: startOfDay.toISOString(),
          endDate: now.toISOString(),
          limit: 1,
        });
        heartRate = hrResult?.samples?.[0]?.value || 0;
      } catch (e) { console.log('heartRate error', e); }

      try {
        const weightResult = await Health.readSamples({
          dataType: 'weight',
          startDate: startOfDay.toISOString(),
          endDate: now.toISOString(),
          limit: 1,
        });
        weight = weightResult?.samples?.[0]?.value || 0;
      } catch (e) { console.log('weight error', e); }

      setHealthData({ steps, heartRate, weight, sleep: 0 });
      
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
