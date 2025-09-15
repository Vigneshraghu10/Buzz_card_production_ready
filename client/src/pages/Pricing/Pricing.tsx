import PricingSection from "@/components/PricingSection";

export default function Pricing() {
  return (
    <div className="py-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            Choose Your Plan
          </h1>
          <p className="text-lg text-gray-600">
            Unlock powerful AI-driven business card management features
          </p>
        </div>
        <PricingSection />
      </div>
    </div>
  );
}