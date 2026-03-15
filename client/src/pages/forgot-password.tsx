import { useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import femeLogo from "@assets/feme-logo.png";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Request failed');
      }

      // Open the BigCommerce password reset page in a new tab
      if (data.resetUrl) {
        window.open(data.resetUrl, '_blank');
      }

      setSent(true);
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: err.message || 'An unexpected error occurred',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-white px-4 py-8">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center mb-6">
            <img src={femeLogo} alt="FEME" className="h-12" />
          </div>
          <p className="text-sm md:text-base text-gray-600">Reset your password</p>
        </div>

        <Card className="border border-gray-200 shadow-sm">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-semibold">
              {sent ? "Check Your Email" : "Forgot Password"}
            </CardTitle>
            <CardDescription className="text-gray-600">
              {sent
                ? "A password reset page has been opened. Follow the instructions there to reset your password."
                : "Enter your email address and we'll help you reset your password."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {sent ? (
              <div className="space-y-4">
                <p className="text-sm text-gray-500">
                  If the page didn't open, check your pop-up blocker. Once you've reset your password, come back here to sign in.
                </p>
                <Button
                  className="w-full h-11 bg-black hover:bg-gray-800 text-white font-medium"
                  onClick={() => setLocation("/login")}
                >
                  Back to Sign In
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
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
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full h-11 bg-black hover:bg-gray-800 text-white font-medium"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Sending...
                    </>
                  ) : (
                    'Reset Password'
                  )}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>

        <div className="text-center mt-6">
          <button
            onClick={() => setLocation("/login")}
            className="text-sm font-medium text-gray-600 hover:text-black underline"
          >
            &larr; Back to Sign In
          </button>
        </div>
      </div>
    </div>
  );
}
