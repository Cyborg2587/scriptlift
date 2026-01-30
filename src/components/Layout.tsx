import React from 'react';
import { User } from '@/types';
import { LogOut, FileText, LayoutDashboard } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface LayoutProps {
  children: React.ReactNode;
  user: User | null;
  onLogout: () => void;
}

const Layout: React.FC<LayoutProps> = ({ children, user, onLogout }) => {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-2">
              <div className="bg-primary p-2 rounded-lg">
                <FileText className="w-6 h-6 text-primary-foreground" />
              </div>
              <span className="font-bold text-xl text-foreground tracking-tight">ScriptLift</span>
            </div>

            {user && (
              <nav className="hidden md:flex space-x-1">
                <div className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium bg-primary/10 text-primary">
                  <LayoutDashboard className="w-4 h-4" />
                  Dashboard
                </div>
              </nav>
            )}
          </div>
          
          <div className="flex items-center gap-4">
            {user && (
              <>
                <div className="hidden sm:flex flex-col items-end mr-2">
                  <span className="text-sm font-semibold text-foreground">{user.name}</span>
                  <span className="text-xs text-muted-foreground">{user.email}</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onLogout}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Sign Out
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow flex flex-col">
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-card border-t border-border py-6 mt-auto">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-muted-foreground text-sm">
            © {new Date().getFullYear()} ScriptLift. Privacy-first AI Transcription.
          </p>
          <div className="mt-1 text-xs text-muted-foreground/70">
            Powered by Whisper AI • Files processed securely in your browser
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Layout;
