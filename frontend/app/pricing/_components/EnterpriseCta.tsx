import Link from "next/link";
import { Ship } from "lucide-react";
import { Button } from "@/components/ui/button";

export function EnterpriseCta() {
  return (
    <section className="section-ocean px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl text-center">
        <Ship className="h-12 w-12 text-primary-foreground mx-auto mb-4" />
        <h2 className="font-display text-primary-foreground">
          Need a Custom Solution?
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-primary-foreground/80">
          For marinas, charter companies, or large fleets, we offer custom
          enterprise plans with dedicated support, custom integrations, and
          volume pricing.
        </p>
        <div className="mt-8">
          <Link href="/contact">
            <Button size="lg" className="btn-brass">
              Contact Sales
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
