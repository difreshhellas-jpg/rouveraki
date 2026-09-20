import Hero from "@/components/Hero";
import Marquee from "@/components/motion/Marquee";
import DaypartStrip from "@/components/DaypartStrip";
import StorySection from "@/components/StorySection";
import LocationSection from "@/components/LocationSection";

export default function HomePage() {
  return (
    <>
      <Hero />
      {/* Reinforces the all-day proposition without another photo. */}
      <Marquee
        items={[
          "Φρέσκο καθημερινά",
          "Στα κάρβουνα",
          "Θέα στη μαρίνα",
          "Ανοιχτά 06:00 - 01:00",
          "Ντόπια υλικά",
        ]}
      />
      <DaypartStrip />
      <StorySection />
      <LocationSection />
    </>
  );
}
