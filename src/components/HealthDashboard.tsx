export const HealthDashboard = () => {
  return (
    <div className="p-4 rounded-xl bg-zinc-900 text-white space-y-3">
      <h2 className="text-xl font-bold">Health Data</h2>
      <p className="text-zinc-400 text-sm">
        Samsung Health integration coming soon. Connect your health data 
        to track steps, heart rate, weight and sleep alongside your 
        carnivore journey.
      </p>
      <div className="grid grid-cols-2 gap-2 opacity-50">
        <div className="bg-zinc-800 p-3 rounded-lg">
          <p className="text-xs text-zinc-400">Steps</p>
          <p className="text-lg font-bold">--</p>
        </div>
        <div className="bg-zinc-800 p-3 rounded-lg">
          <p className="text-xs text-zinc-400">Heart Rate</p>
          <p className="text-lg font-bold">-- bpm</p>
        </div>
        <div className="bg-zinc-800 p-3 rounded-lg">
          <p className="text-xs text-zinc-400">Weight</p>
          <p className="text-lg font-bold">-- kg</p>
        </div>
        <div className="bg-zinc-800 p-3 rounded-lg">
          <p className="text-xs text-zinc-400">Sleep</p>
          <p className="text-lg font-bold">-- hrs</p>
        </div>
      </div>
    </div>
  );
};
