import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Login failed');
      }

      // Store JWT token
      localStorage.setItem('b2b_token', data.accessToken);

      // Store user info
      localStorage.setItem('user', JSON.stringify(data.user));

      toast({
        title: "Login Successful",
        description: "Welcome to your B2B portal!",
      });

      // Navigate to dashboard
      setLocation('/');
    } catch (err: any) {
      const errorMessage = err.message || 'An unexpected error occurred';
      toast({
        variant: "destructive",
        title: "Login Failed",
        description: errorMessage,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = () => {
    setEmail("demo@company.com");
    setPassword("demo123");
    
    // Auto-fill demo credentials and submit after a short delay
    setTimeout(() => {
      const form = document.querySelector('form');
      if (form) {
        const event = new Event('submit', { bubbles: true, cancelable: true });
        form.dispatchEvent(event);
      }
    }, 100);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-white px-4 py-8">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-5xl md:text-6xl font-bold tracking-tight text-black mb-3">feme</h1>
          <p className="text-sm md:text-base text-gray-600">Sign in to your business account</p>
        </div>

        <Card className="border border-gray-200 shadow-sm">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-semibold">Sign In</CardTitle>
            <CardDescription className="text-gray-600">
              Enter your credentials to continue
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              {graphqlError && (
                <Alert variant="destructive" className="bg-red-50 border-red-200">
                  <AlertDescription className="text-red-800">
                    {graphqlError.message}
                  </AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  required
                  className="h-11 border-gray-300 focus:border-black focus:ring-black"
                  data-testid="input-email"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="h-11 border-gray-300 focus:border-black focus:ring-black"
                  data-testid="input-password"
                />
              </div>

              <Button
                type="submit"
                className="w-full h-11 bg-black hover:bg-gray-800 text-white font-medium"
                disabled={loading}
                data-testid="button-login"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Signing in...
                  </>
                ) : (
                  'Sign In'
                )}
              </Button>

              <Button
                type="button"
                variant="outline"
                className="w-full h-11 border-2 border-black text-black hover:bg-black hover:text-white font-medium transition-colors"
                onClick={handleDemoLogin}
                disabled={loading}
                data-testid="button-demo"
              >
                Try Demo Account
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="text-center mt-6 text-sm text-gray-500">
          <p>Powered by BigCommerce B2B Edition GraphQL API</p>
        </div>
      </div>
    </div>
  );
}
