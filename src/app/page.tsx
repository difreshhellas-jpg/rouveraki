import Hero from "@/components/Hero";
import Marquee from "@/components/motion/Marquee";
import DaypartStrip from "@/components/DaypartStrip";
import StorySection from "@/components/StorySection";
import LocationSection from "@/components/LocationSection";
import HorizontalStory from "@/components/cinematic/HorizontalStory";
import ScrollBreak from "@/components/cinematic/ScrollBreak";
import MenuShowcase from "@/components/cinematic/MenuShowcase";
import MotionEngine from "@/components/MotionEngine";

export default function HomePage() {
  return (
    <>
      {/* Must precede the hero: everything after .fx-hero is restyled to slide over it. */}
      <MotionEngine />
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

      {/* Pinned pan on desktop, swipeable carousel on touch. */}
      <HorizontalStory />

      {/* Scene cut into the menu. */}
      <ScrollBreak />

      <MenuShowcase />
      <StorySection />
      <LocationSection />
    </>
  );
}
