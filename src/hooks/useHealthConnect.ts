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
    try {
      await Health.requestAuthorization({
        all: [],
        read: ['steps', 'heartRate', 'weight', 'sleepAnalysis'],
        write: [],
      });
      setIsConnected(true);
      await fetchHealthData();
    } catch (err) {
      setError('Health Connect permission denied or not available.');
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

      const stepsResult = await Health.queryHKitSampleType({
        sampleName: 'steps',
        startDate: startOfDay.toISOString(),
        endDate: now.toISOString(),
        limit: 0,
      });

      const hrResult = await Health.queryHKitSampleType({
        sampleName: 'heartRate',
        startDate: startOfDay.toISOString(),
        endDate: now.toISOString(),
        limit: 1,
      });

      const weightResult = await Health.queryHKitSampleType({
        sampleName: 'weight',
        startDate: startOfDay.toISOString(),
        endDate: now.toISOString(),
        limit: 1,
      });

      const sleepResult = await Health.queryHKitSampleType({
        sampleName: 'sleepAnalysis',
        startDate: startOfDay.toISOString(),
        endDate: now.toISOString(),
        limit: 1,
      });

      setHealthData({
        steps: stepsResult?.resultData?.reduce(
          (sum: number, s: any) => sum + (s.quantity || 0), 0) || 0,
        heartRate: hrResult?.resultData?.[0]?.quantity || 0,
        weight: weightResult?.resultData?.[0]?.quantity || 0,
        sleep: sleepResult?.resultData?.[0]?.quantity || 0,
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
