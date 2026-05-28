import {
  Banner,
  BannerDescription,
  BannerTitle,
} from "../../components/ui/banner";

// Shown when the browser exposes no geolocation API at all.
export function GeolocationUnsupportedBanner() {
  return (
    <Banner variant="warning">
      <BannerTitle>Geolocation not supported</BannerTitle>
      <BannerDescription>
        This browser cannot access GPS. Use a modern Chrome, Safari, or Firefox
        on a device with location services enabled.
      </BannerDescription>
    </Banner>
  );
}
