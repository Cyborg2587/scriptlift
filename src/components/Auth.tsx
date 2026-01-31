import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, AlertCircle, ArrowLeft, Mail, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PasswordField } from '@/components/auth/PasswordField';

interface AuthProps {
  onLogin: () => void;
}

const Auth: React.FC<AuthProps> = ({ onLogin }) => {
  const [view, setView] = useState<'login' | 'signup' | 'reset'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<React.ReactNode | null>(null);

  const getRedirectUrl = () => {
    const url = new URL(window.location.href);
    return `${url.protocol}//${url.host}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    const redirectUrl = getRedirectUrl();

    try {
      if (view === 'reset') {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: redirectUrl,
        });
        if (error) throw error;
        setMessage("If an account exists with this email, you will receive a password reset link shortly.");
      } else if (view === 'login') {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        onLogin();
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { name: name || email.split('@')[0] },
            emailRedirectTo: redirectUrl, 
          }
        });

        if (error) throw error;

        if (data.user && data.session) {
          onLogin();
          return;
        }

        if (data.user && !data.session) {
          setMessage(
            <div className="flex flex-col gap-1">
              <span className="font-semibold">Account created successfully!</span>
              <span>Please check your email to confirm your account.</span>
            </div>
          );
        }
      }
    } catch (err: any) {
      console.error("Auth Error:", err);
      setError(err.message || 'An error occurred during authentication.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-grow flex items-center justify-center p-4 bg-background">
      <div className="w-full max-w-md space-y-6">
        {/* Logo */}
        <div className="text-center">
          <div className="inline-flex items-center gap-2 mb-6">
            <div className="bg-primary p-3 rounded-xl">
              <FileText className="w-8 h-8 text-primary-foreground" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-foreground">ScriptLift</h1>
          <p className="text-muted-foreground mt-1">Privacy-first AI transcription</p>
        </div>

        <Card className="border-border shadow-lg">
          <CardHeader className="text-center">
            <CardTitle>
              {view === 'login' && 'Welcome Back'}
              {view === 'signup' && 'Create an Account'}
              {view === 'reset' && 'Reset Password'}
            </CardTitle>
            <CardDescription>
              {view === 'login' && 'Enter your credentials to access your workspace'}
              {view === 'signup' && 'Join to sync your files across devices'}
              {view === 'reset' && 'Enter your email to receive reset instructions'}
            </CardDescription>
          </CardHeader>
          
          <CardContent>
            {error && (
              <div className="mb-4 p-3 bg-destructive/10 text-destructive text-sm rounded-lg flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}
            
            {message && (
              <div className="mb-4 p-3 bg-success/10 text-success text-sm rounded-lg flex items-start gap-2">
                <Mail className="w-4 h-4 mt-0.5 shrink-0" />
                <div>{message}</div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {view === 'signup' && (
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <Input
                    id="name"
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="John Doe"
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                />
              </div>

              {view !== 'reset' && (
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <Label htmlFor="password">Password</Label>
                    {view === 'login' && (
                      <button 
                        type="button"
                        onClick={() => setView('reset')}
                        className="text-xs text-primary hover:underline font-medium"
                      >
                        Forgot password?
                      </button>
                    )}
                  </div>
                  <PasswordField
                    id="password"
                    required
                    value={password}
                    onChange={setPassword}
                    placeholder="••••••••"
                    disabled={loading}
                  />
                </div>
              )}

              <Button type="submit" disabled={loading} className="w-full">
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    {view === 'login' && 'Sign In'}
                    {view === 'signup' && 'Create Account'}
                    {view === 'reset' && 'Send Reset Link'}
                  </>
                )}
              </Button>
            </form>

            <div className="mt-6 text-center space-y-2">
              {view === 'login' && (
                <p className="text-sm text-muted-foreground">
                  Don't have an account?{' '}
                  <button
                    onClick={() => setView('signup')}
                    className="text-primary font-medium hover:underline"
                  >
                    Sign up
                  </button>
                </p>
              )}

              {view === 'signup' && (
                <p className="text-sm text-muted-foreground">
                  Already have an account?{' '}
                  <button
                    onClick={() => setView('login')}
                    className="text-primary font-medium hover:underline"
                  >
                    Log in
                  </button>
                </p>
              )}

              {view === 'reset' && (
                <button
                  onClick={() => setView('login')}
                  className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mx-auto"
                >
                  <ArrowLeft className="w-3 h-3" /> Back to Login
                </button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Auth;
