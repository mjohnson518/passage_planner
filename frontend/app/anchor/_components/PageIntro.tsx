// Page heading + short explanation of the anchor-watch alarm behavior.
// `consecutiveOutsideToAlarm` is passed in so the copy stays in sync with the
// alarm threshold defined on the page.
export function PageIntro({
  consecutiveOutsideToAlarm,
}: {
  consecutiveOutsideToAlarm: number;
}) {
  return (
    <div>
      <h1 className="font-display text-4xl mb-2">Anchor watch</h1>
      <p className="text-muted-foreground">
        Sets a swing circle at the drop point and alarms if your GPS position
        leaves it for {consecutiveOutsideToAlarm} consecutive readings
        (accuracy-aware).
      </p>
    </div>
  );
}
