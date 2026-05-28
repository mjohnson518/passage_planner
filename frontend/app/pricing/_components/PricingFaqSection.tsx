"use client";

import { useState } from "react";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";

function FAQItem({ question, answer }: { question: string; answer: string }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="border-b border-border last:border-0 py-4">
      <button
        type="button"
        className="w-full flex items-center justify-between text-left"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="font-medium">{question}</span>
        <Info
          className={cn(
            "h-5 w-5 text-primary transition-transform flex-shrink-0 ml-4",
            isOpen && "rotate-180",
          )}
        />
      </button>
      {isOpen && <p className="mt-4 text-muted-foreground">{answer}</p>}
    </div>
  );
}

export function PricingFaqSection() {
  return (
    <section className="section-alt px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <div className="text-center mb-12">
          <span className="badge-brass mb-4 inline-block">FAQ</span>
          <h2 className="font-display mt-2">Frequently Asked Questions</h2>
        </div>
        <div className="card-nautical p-8 space-y-2">
          <FAQItem
            question="Can I change plans anytime?"
            answer="Yes! You can upgrade or downgrade your plan at any time. Changes take effect at the next billing cycle."
          />
          <FAQItem
            question="Is there a free trial?"
            answer="Yes, both Premium and Pro plans come with a 14-day free trial. No credit card required to start."
          />
          <FAQItem
            question="What payment methods do you accept?"
            answer="We accept all major credit cards, debit cards, and PayPal through our secure payment processor, Stripe."
          />
          <FAQItem
            question="Can I cancel my subscription?"
            answer="Absolutely. You can cancel your subscription at any time from your account settings. You'll continue to have access until the end of your billing period."
          />
          <FAQItem
            question="Do you offer discounts for sailing clubs?"
            answer="Yes! We offer special pricing for sailing clubs, marinas, and educational institutions. Contact us for details."
          />
          <FAQItem
            question="What are passage packs?"
            answer="Passage packs are one-time top-ups that give you extra passages beyond your plan's monthly limit. They never expire and are available to Premium and Pro subscribers."
          />
        </div>
      </div>
    </section>
  );
}
