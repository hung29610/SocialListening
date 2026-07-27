import PublicSiteShell from '@/components/public/PublicSiteShell';
/* ── HERO SLOT (Epic SIGNAL integration point) ─────────────────────
   W-B's real particle hero is mounted below (PRs #181 + #182 merged).
   The static fallback at components/landing/HeroSlot.tsx is retained
   for reference until epic close; SignalHero renders the page <h1>,
   so the page must not add another.  */
import { SignalHero as HeroSlot } from '@/components/landing/hero';
import SourcesWall from '@/components/landing/SourcesWall';
import FeatureScenes from '@/components/landing/FeatureScenes';
import MetricsBand from '@/components/landing/MetricsBand';
import AICapabilities from '@/components/landing/AICapabilities';
import CompetitorScene from '@/components/landing/CompetitorScene';
import Testimonials from '@/components/landing/Testimonials';
import FinalCTA from '@/components/landing/FinalCTA';

export default function Home() {
  return (
    <PublicSiteShell>
      <HeroSlot />
      <SourcesWall />
      <FeatureScenes />
      <MetricsBand />
      <AICapabilities />
      <CompetitorScene />
      <Testimonials />
      <FinalCTA />
    </PublicSiteShell>
  );
}
