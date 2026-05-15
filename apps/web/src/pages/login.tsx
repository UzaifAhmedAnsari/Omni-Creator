import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Video, Sparkles, BarChart3, Share2 } from "lucide-react";

export default function LoginPage() {
  const { login } = useAuth();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const apiBase = import.meta.env.VITE_API_URL ?? "/api";

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsLoading(true);

    const path = isSignUp ? `${apiBase}/auth/signup` : `${apiBase}/auth/login`;
    const body = isSignUp
      ? { email, password, firstName: firstName || undefined, lastName: lastName || undefined }
      : { email, password };

    try {
      const response = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        credentials: "include",
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data?.error || "Unable to sign in. Please try again.");
        setIsLoading(false);
        return;
      }

      window.location.href = "/";
    } catch (err) {
      setError("Unable to connect to authentication service.");
      setIsLoading(false);
    }
  };

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
              <h2 className="text-xl font-semibold">
                {isSignUp ? "Create your account" : "Welcome back"}
              </h2>
              <p className="text-sm text-muted-foreground">
                {isSignUp
                  ? "Sign up with email and password or use Replit."
                  : "Sign in to your OmniCreator account."}
              </p>
            </div>

            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="grid gap-4">
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@example.com"
                    required
                  />
                </div>
                {isSignUp ? (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <Label htmlFor="firstName">First name</Label>
                      <Input
                        id="firstName"
                        type="text"
                        value={firstName}
                        onChange={(event) => setFirstName(event.target.value)}
                        placeholder="First name"
                      />
                    </div>
                    <div>
                      <Label htmlFor="lastName">Last name</Label>
                      <Input
                        id="lastName"
                        type="text"
                        value={lastName}
                        onChange={(event) => setLastName(event.target.value)}
                        placeholder="Last name"
                      />
                    </div>
                  </div>
                ) : null}
                <div>
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="••••••••"
                    required
                  />
                </div>
              </div>

              {error ? (
                <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                  {error}
                </div>
              ) : null}

              <Button type="submit" className="w-full" size="lg" disabled={isLoading}>
                {isSignUp ? "Sign up with email" : "Sign in with email"}
              </Button>
            </form>

            <div className="space-y-3">
              <Button
                onClick={login}
                className="w-full"
                size="lg"
                variant="secondary"
                disabled={isLoading}
              >
                Sign in with Replit
              </Button>

              <div className="text-center text-sm text-muted-foreground">
                {isSignUp ? (
                  <>
                    Already have an account?{' '}
                    <button
                      type="button"
                      onClick={() => setIsSignUp(false)}
                      className="font-medium text-primary underline-offset-4"
                    >
                      Sign in
                    </button>
                  </>
                ) : (
                  <>
                    Don&apos;t have an account?{' '}
                    <button
                      type="button"
                      onClick={() => setIsSignUp(true)}
                      className="font-medium text-primary underline-offset-4"
                    >
                      Sign up
                    </button>
                  </>
                )}
              </div>

              <p className="text-center text-xs text-muted-foreground">
                By signing in, you agree to our terms of service and privacy policy.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
