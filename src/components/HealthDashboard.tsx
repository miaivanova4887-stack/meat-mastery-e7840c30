import { useHealthConnect } from '@/hooks/useHealthConnect';
import { Activity, Heart, Moon, Weight } from 'lucide-react';

export const HealthDashboard = () => {
  const {
    healthData,
    isConnected,
    isLoading,
    error,
    requestPermissions,
    fetchHealthData,
  } = useHealthConnect();

  return (
    <div className="p-4 rounded-xl bg-zinc-900 text-white space-y-4">
      <h2 className="text-xl font-bold">Health Data</h2>

      {!isConnected ? (
        <div className="space-y-3">
          <p className="text-zinc-400 text-sm">
            Connect to Samsung Health via Health Connect to track your
            carnivore journey metrics.
          </p>
          <button
            onClick={requestPermissions}
            disabled={isLoading}
            className="w-full bg-green-600 hover:bg-green-700 text-white 
                       font-semibold py-3 px-4 rounded-lg transition-colors"
          >
            {isLoading ? 'Connecting...' : 'Connect Health Data'}
          </button>
          {error && (
            <p className="text-red-400 text-sm">{error}</p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-3 bg-zinc-800 p-3 rounded-lg">
            <Activity className="text-green-400" size={24} />
            <div>
              <p className="text-zinc-400 text-xs">Steps Today</p>
              <p className="text-white font-bold text-lg">
                {healthData.steps.toLocaleString()}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 bg-zinc-800 p-3 rounded-lg">
            <Heart className="text-red-400" size={24} />
            <div>
              <p className="text-zinc-400 text-xs">Heart Rate</p>
              <p className="text-white font-bold text-lg">
                {healthData.heartRate} bpm
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 bg-zinc-800 p-3 rounded-lg">
            <Weight className="text-blue-400" size={24} />
            <div>
              <p className="text-zinc-400 text-xs">Weight</p>
              <p className="text-white font-bold text-lg">
                {healthData.weight} kg
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 bg-zinc-800 p-3 rounded-lg">
            <Moon className="text-purple-400" size={24} />
            <div>
              <p className="text-zinc-400 text-xs">Sleep</p>
              <p className="text-white font-bold text-lg">
                {healthData.sleep} hrs
              </p>
            </div>
          </div>

          <button
            onClick={fetchHealthData}
            className="w-full bg-zinc-700 hover:bg-zinc-600 text-white 
                       font-semibold py-2 px-4 rounded-lg transition-colors"
          >
            Refresh Data
          </button>
        </div>
      )}
    </div>
  );
};
