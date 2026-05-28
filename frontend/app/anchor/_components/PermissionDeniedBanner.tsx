import {
  Banner,
  BannerDescription,
  BannerTitle,
} from "../../components/ui/banner";

// Shown when the user has denied location permission for the site.
export function PermissionDeniedBanner() {
  return (
    <Banner variant="warning">
      <BannerTitle>Location permission denied</BannerTitle>
      <BannerDescription>
        Helmwise can&apos;t watch your anchor without GPS. Enable location for
        this site in your browser settings and reload.
      </BannerDescription>
    </Banner>
  );
}
