// Update this page (the content is just a fallback if you fail to update the page)
import { MadeWithDyad } from "@/components/made-with-dyad";
import { HealthCheck } from "@/components/HealthCheck";
import { ScaleControl } from "@/components/ScaleControl";

const Index = () => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 p-4">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold mb-4">ScaleIT Bridge</h1>
        <p className="text-xl text-gray-600">
          Universal Industrial Scale Communication Bridge
        </p>
      </div>
      
      <div className="flex flex-col items-center gap-8 w-full max-w-4xl">
        <HealthCheck />
        <ScaleControl />
      </div>
      
      <MadeWithDyad />
    </div>
  );
};

export default Index;