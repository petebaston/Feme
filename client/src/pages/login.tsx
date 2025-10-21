import { useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";

export default function Login() {
  const [, setLocation] = useLocation();
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      // Get BigCommerce configuration from environment
      const storeHash = import.meta.env.VITE_STORE_HASH || 'demo_store';
      const channelId = import.meta.env.VITE_CHANNEL_ID || '1';

      // Use local API for demo mode (replace with actual B2B API in production)
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          password,
        }),
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Invalid email or password');
        }
        throw new Error('Login failed. Please try again.');
      }

      const data = await response.json();

      // Store authentication data
      localStorage.setItem('b2b_token', data.b2bToken || data.token || 'demo_token');
      localStorage.setItem('b2b_store_hash', storeHash);
      localStorage.setItem('b2b_channel_id', channelId);
      localStorage.setItem('b2b_user', JSON.stringify(data.user || { email, name: 'Demo User' }));
      
      console.log('[Login] Stored BigCommerce B2B token:', data.b2bToken ? 'Yes' : 'No');

      toast({
        title: "Login Successful",
        description: "Welcome to your B2B portal!",
      });

      // Redirect to dashboard - use window.location to trigger auth check
      window.location.href = "/dashboard";
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred');
      toast({
        variant: "destructive",
        title: "Login Failed",
        description: err.message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDemoLogin = () => {
    setEmail("demo@company.com");
    setPassword("demo123");
    
    // Auto-fill demo credentials and login
    setTimeout(() => {
      const event = new Event('submit', { bubbles: true, cancelable: true });
      const form = document.querySelector('form');
      if (form) {
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
              {error && (
                <Alert variant="destructive" className="bg-red-50 border-red-200">
                  <AlertDescription className="text-red-800">{error}</AlertDescription>
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
                disabled={isLoading}
                data-testid="button-login"
              >
                {isLoading ? (
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
                disabled={isLoading}
                data-testid="button-demo"
              >
                Try Demo Account
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="text-center mt-6 text-sm text-gray-500">
          <p>Powered by BigCommerce B2B Edition</p>
        </div>
      </div>
    </div>
  );
}
