export default function SimpleHomePage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 py-16">
        <h1 className="text-4xl font-bold text-center mb-8">
          Helmwise
        </h1>
        <p className="text-xl text-center text-muted-foreground mb-12">
          AI-Powered Sailing Route Planning
        </p>

        <div className="grid md:grid-cols-3 gap-8">
          <div className="bg-card p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-3">Weather Routing</h2>
            <p className="text-muted-foreground">Get real-time weather analysis for your route</p>
          </div>

          <div className="bg-card p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-3">Tidal Planning</h2>
            <p className="text-muted-foreground">Optimize your departure with tidal predictions</p>
          </div>

          <div className="bg-card p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-3">Safety Briefing</h2>
            <p className="text-muted-foreground">Comprehensive safety information for your journey</p>
          </div>
        </div>

        <div className="text-center mt-12">
          <a
            href="/signup"
            className="inline-block bg-primary text-primary-foreground px-8 py-3 rounded-lg hover:bg-primary/90 transition"
          >
            Get Started Free
          </a>
        </div>
      </div>
    </div>
  )
} 