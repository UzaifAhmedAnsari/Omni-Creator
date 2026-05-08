import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Video, Sparkles, BarChart3, Share2 } from "lucide-react";

export default function LoginPage() {
  const { login } = useAuth();

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center p-4">
      <div className="w-full max-w-4xl grid md:grid-cols-2 gap-8 items-center">
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary">
              <Video className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-2xl font-bold">OmniCreator</span>
          </div>
          <div className="space-y-2">
            <h1 className="text-4xl font-bold leading-tight">
              AI-powered content studio for modern creators
            </h1>
            <p className="text-lg text-muted-foreground">
              Generate videos, images, and carousels with AI. Schedule and publish to all your social channels from one place.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { icon: Sparkles, label: "AI Generation", desc: "Videos, images & ads" },
              { icon: Share2, label: "Multi-Platform", desc: "Publish everywhere" },
              { icon: BarChart3, label: "Analytics", desc: "Track performance" },
              { icon: Video, label: "Brand Kits", desc: "Stay on-brand" },
            ].map(({ icon: Icon, label, desc }) => (
              <div key={label} className="flex items-start gap-3 rounded-lg border border-border p-3 bg-card">
                <Icon className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                <div>
                  <div className="text-sm font-medium">{label}</div>
                  <div className="text-xs text-muted-foreground">{desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col items-center justify-center">
          <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-8 shadow-lg space-y-6">
            <div className="text-center space-y-1">
              <h2 className="text-xl font-semibold">Welcome back</h2>
              <p className="text-sm text-muted-foreground">Sign in to your OmniCreator account</p>
            </div>
            <Button onClick={login} className="w-full" size="lg">
              Sign in with Replit
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              By signing in, you agree to our terms of service and privacy policy.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
