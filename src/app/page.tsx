import Hero from "@/components/Hero";
import Marquee from "@/components/motion/Marquee";
import DaypartStrip from "@/components/DaypartStrip";
import StorySection from "@/components/StorySection";
import LocationSection from "@/components/LocationSection";
import ProductScrollHero from "@/components/cinematic/ProductScrollHero";
import HorizontalStory from "@/components/cinematic/HorizontalStory";
import ScrollBreak from "@/components/cinematic/ScrollBreak";
import MenuShowcase from "@/components/cinematic/MenuShowcase";
import CursorTrail from "@/components/cinematic/CursorTrail";

export default function HomePage() {
  return (
    <>
      <Hero />

      {/* Scroll-scrubbed gyros sequence (shared with the Kyknos site) coming apart. */}
      <ProductScrollHero />

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
      {/* Desktop pointers only; there is no cursor to trail on touch. */}
      <CursorTrail />
    </>
  );
}
