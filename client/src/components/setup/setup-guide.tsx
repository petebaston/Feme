import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface SetupStep {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'in-progress' | 'completed' | 'error';
}

export default function SetupGuide() {
  const [activeStep, setActiveStep] = useState(0);
  const [setupData, setSetupData] = useState({
    storeHash: '',
    channelId: '1',
    b2bApiUrl: 'https://api-b2b.bigcommerce.com',
    assetsPath: '',
  });

  const steps: SetupStep[] = [
    {
      id: 'clone',
      title: 'Clone Repository',
      description: 'Get the BigCommerce B2B Buyer Portal source code',
      status: 'completed'
    },
    {
      id: 'environment',
      title: 'Environment Configuration',
      description: 'Configure your BigCommerce store integration',
      status: 'in-progress'
    },
    {
      id: 'bigcommerce',
      title: 'BigCommerce Setup',
      description: 'Enable B2B features in your store',
      status: 'pending'
    },
    {
      id: 'build',
      title: 'Build Application',
      description: 'Compile your portal for production',
      status: 'pending'
    },
    {
      id: 'deploy',
      title: 'Deploy to Production',
      description: 'Host your portal and integrate with BigCommerce',
      status: 'pending'
    }
  ];

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const getStepIcon = (status: SetupStep['status']) => {
    switch (status) {
      case 'completed':
        return (
          <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center text-white">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        );
      case 'in-progress':
        return (
          <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center text-primary-foreground">
            <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
          </div>
        );
      case 'error':
        return (
          <div className="w-8 h-8 bg-red-500 rounded-full flex items-center justify-center text-white">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
        );
      default:
        return (
          <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center text-muted-foreground">
            {steps.findIndex(s => s.id === status) + 1}
          </div>
        );
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      {/* Header */}
      <div className="text-center">
        <div className="w-16 h-16 bg-primary rounded-xl flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-primary-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
        </div>
        <h1 className="text-4xl font-bold text-foreground mb-2">B2B Portal Setup Guide</h1>
        <p className="text-xl text-muted-foreground">Complete step-by-step instructions for deploying your headless B2B portal</p>
      </div>

      {/* Progress Overview */}
      <Card>
        <CardHeader>
          <CardTitle>Setup Progress</CardTitle>
          <CardDescription>Follow these steps to get your B2B portal up and running</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {steps.map((step, index) => (
              <div key={step.id} className="flex items-center space-x-4">
                {getStepIcon(step.status)}
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium text-foreground">{step.title}</h3>
                    <Badge variant={
                      step.status === 'completed' ? 'default' :
                      step.status === 'in-progress' ? 'secondary' :
                      step.status === 'error' ? 'destructive' : 'outline'
                    }>
                      {step.status}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{step.description}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Setup Steps */}
      <Tabs defaultValue="clone" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="clone">Clone</TabsTrigger>
          <TabsTrigger value="environment">Environment</TabsTrigger>
          <TabsTrigger value="bigcommerce">BigCommerce</TabsTrigger>
          <TabsTrigger value="build">Build</TabsTrigger>
          <TabsTrigger value="deploy">Deploy</TabsTrigger>
        </TabsList>

        {/* Step 1: Clone Repository */}
        <TabsContent value="clone" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center text-primary-foreground font-bold">1</div>
                Clone Repository
              </CardTitle>
              <CardDescription>Get the BigCommerce B2B Buyer Portal source code</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-muted rounded-lg p-4 relative">
                <Button
                  variant="outline"
                  size="sm"
                  className="absolute top-2 right-2"
                  onClick={() => copyToClipboard('git clone https://github.com/bigcommerce/b2b-buyer-portal.git\ncd b2b-buyer-portal\nyarn install')}
                >
                  Copy
                </Button>
                <pre className="text-sm font-mono text-foreground">
                  <code>{`git clone https://github.com/bigcommerce/b2b-buyer-portal.git
cd b2b-buyer-portal
yarn install`}</code>
                </pre>
              </div>
              
              <Alert>
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <AlertDescription>
                  Ensure you have Node.js ≥22.16.0 and Yarn ≥1.22.17 installed before proceeding.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Step 2: Environment Configuration */}
        <TabsContent value="environment" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center text-primary-foreground font-bold">2</div>
                Environment Configuration
              </CardTitle>
              <CardDescription>Configure your BigCommerce store integration</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4">
                <div>
                  <label className="text-sm font-medium text-foreground">Store Hash</label>
                  <Input
                    placeholder="Found in your store URL: store-{hash}.mybigcommerce.com"
                    value={setupData.storeHash}
                    onChange={(e) => setSetupData(prev => ({ ...prev, storeHash: e.target.value }))}
                  />
                </div>
                
                <div>
                  <label className="text-sm font-medium text-foreground">Channel ID</label>
                  <Input
                    placeholder="Available in B2B Edition app → Storefronts"
                    value={setupData.channelId}
                    onChange={(e) => setSetupData(prev => ({ ...prev, channelId: e.target.value }))}
                  />
                </div>
                
                <div>
                  <label className="text-sm font-medium text-foreground">B2B API URL</label>
                  <Input
                    placeholder="https://api-b2b.bigcommerce.com"
                    value={setupData.b2bApiUrl}
                    onChange={(e) => setSetupData(prev => ({ ...prev, b2bApiUrl: e.target.value }))}
                  />
                </div>
                
                <div>
                  <label className="text-sm font-medium text-foreground">Assets Absolute Path (Production)</label>
                  <Input
                    placeholder="https://your-cdn-url.com/assets/"
                    value={setupData.assetsPath}
                    onChange={(e) => setSetupData(prev => ({ ...prev, assetsPath: e.target.value }))}
                  />
                </div>
              </div>

              <Separator />

              <div>
                <h4 className="font-medium mb-3">Generated .env Configuration</h4>
                <div className="bg-muted rounded-lg p-4 relative">
                  <Button
                    variant="outline"
                    size="sm"
                    className="absolute top-2 right-2"
                    onClick={() => copyToClipboard(`VITE_STORE_HASH=${setupData.storeHash}
VITE_CHANNEL_ID=${setupData.channelId}
VITE_B2B_URL=${setupData.b2bApiUrl}
VITE_ASSETS_ABSOLUTE_PATH=${setupData.assetsPath}
VITE_IS_LOCAL_ENVIRONMENT=FALSE
NODE_ENV=production`)}
                  >
                    Copy
                  </Button>
                  <pre className="text-xs font-mono text-foreground">
                    <code>{`VITE_STORE_HASH=${setupData.storeHash}
VITE_CHANNEL_ID=${setupData.channelId}
VITE_B2B_URL=${setupData.b2bApiUrl}
VITE_ASSETS_ABSOLUTE_PATH=${setupData.assetsPath}
VITE_IS_LOCAL_ENVIRONMENT=FALSE
NODE_ENV=production`}</code>
                  </pre>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Step 3: BigCommerce Setup */}
        <TabsContent value="bigcommerce" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center text-primary-foreground font-bold">3</div>
                BigCommerce Configuration
              </CardTitle>
              <CardDescription>Enable B2B features and configure your store</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 bg-primary/10 rounded-full flex items-center justify-center text-primary text-sm font-bold mt-0.5">1</div>
                  <div>
                    <h4 className="font-medium text-foreground">Access B2B Edition App</h4>
                    <p className="text-sm text-muted-foreground">Navigate to Apps → My Apps → BigCommerce B2B Edition</p>
                  </div>
                </div>
                
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 bg-primary/10 rounded-full flex items-center justify-center text-primary text-sm font-bold mt-0.5">2</div>
                  <div>
                    <h4 className="font-medium text-foreground">Configure Storefronts</h4>
                    <p className="text-sm text-muted-foreground">Go to Storefronts section and select your channel</p>
                  </div>
                </div>
                
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 bg-primary/10 rounded-full flex items-center justify-center text-primary text-sm font-bold mt-0.5">3</div>
                  <div>
                    <h4 className="font-medium text-foreground">Enable Custom Portal</h4>
                    <p className="text-sm text-muted-foreground">Select "Custom (use for your self-hosted buyer portal)"</p>
                  </div>
                </div>
              </div>
              
              <Alert>
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <AlertDescription>
                  B2B features can initially be activated on only one channel. Contact support for multi-channel support.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Step 4: Build Application */}
        <TabsContent value="build" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center text-primary-foreground font-bold">4</div>
                Build Application
              </CardTitle>
              <CardDescription>Compile your portal for production deployment</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h4 className="font-medium mb-3">Production Build Command</h4>
                <div className="bg-muted rounded-lg p-4 relative">
                  <Button
                    variant="outline"
                    size="sm"
                    className="absolute top-2 right-2"
                    onClick={() => copyToClipboard('chmod +x scripts/build-production.sh\n./scripts/build-production.sh')}
                  >
                    Copy
                  </Button>
                  <pre className="text-sm font-mono text-foreground">
                    <code>{`chmod +x scripts/build-production.sh
./scripts/build-production.sh`}</code>
                  </pre>
                </div>
              </div>
              
              <div>
                <h4 className="font-medium mb-3">Expected Build Output</h4>
                <div className="bg-muted rounded-lg p-4">
                  <pre className="text-xs font-mono text-foreground">
                    <code>{`dist/public/
├── index.html
├── assets/
│   ├── index-[hash].js
│   ├── index-[hash].css
│   ├── polyfills-legacy-[hash].js
│   └── index-legacy-[hash].js
└── deployment-info.json`}</code>
                  </pre>
                </div>
              </div>

              <Alert>
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <AlertDescription>
                  The build process optimizes your code, minifies assets, and creates browser-compatible versions.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Step 5: Deploy */}
        <TabsContent value="deploy" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center text-primary-foreground font-bold">5</div>
                Deploy to Production
              </CardTitle>
              <CardDescription>Host your portal and integrate with BigCommerce</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <Tabs defaultValue="replit" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="replit">Replit</TabsTrigger>
                  <TabsTrigger value="vercel">Vercel</TabsTrigger>
                  <TabsTrigger value="static">Static Hosting</TabsTrigger>
                </TabsList>

                <TabsContent value="replit" className="space-y-4">
                  <div>
                    <h4 className="font-medium mb-3">Automated Replit Deployment</h4>
                    <div className="bg-muted rounded-lg p-4 relative">
                      <Button
                        variant="outline"
                        size="sm"
                        className="absolute top-2 right-2"
                        onClick={() => copyToClipboard('chmod +x scripts/deploy-replit.sh\n./scripts/deploy-replit.sh')}
                      >
                        Copy
                      </Button>
                      <pre className="text-sm font-mono text-foreground">
                        <code>{`chmod +x scripts/deploy-replit.sh
./scripts/deploy-replit.sh`}</code>
                      </pre>
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="font-medium mb-3">Integration Scripts for Your Storefront</h4>
                    <div className="bg-muted rounded-lg p-4 relative">
                      <Button
                        variant="outline"
                        size="sm"
                        className="absolute top-2 right-2"
                        onClick={() => copyToClipboard(`<script>
window.B3 = {
  setting: {
    store_hash: '${setupData.storeHash}',
    channel_id: ${setupData.channelId},
  },
};
</script>
<script src="${setupData.assetsPath || 'https://your-repl-url/'}assets/index.js"></script>`)}
                      >
                        Copy
                      </Button>
                      <pre className="text-xs font-mono text-foreground">
                        <code>{`<script>
window.B3 = {
  setting: {
    store_hash: '${setupData.storeHash}',
    channel_id: ${setupData.channelId},
  },
};
</script>
<script src="${setupData.assetsPath || 'https://your-repl-url/'}assets/index.js"></script>`}</code>
                      </pre>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="vercel" className="space-y-4">
                  <div>
                    <h4 className="font-medium mb-3">Vercel Deployment</h4>
                    <div className="bg-muted rounded-lg p-4 relative">
                      <Button
                        variant="outline"
                        size="sm"
                        className="absolute top-2 right-2"
                        onClick={() => copyToClipboard('npm i -g vercel\nvercel --prod')}
                      >
                        Copy
                      </Button>
                      <pre className="text-sm font-mono text-foreground">
                        <code>{`npm i -g vercel
vercel --prod`}</code>
                      </pre>
                    </div>
                  </div>
                  
                  <Alert>
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <AlertDescription>
                      Don't forget to set your environment variables in the Vercel dashboard.
                    </AlertDescription>
                  </Alert>
                </TabsContent>

                <TabsContent value="static" className="space-y-4">
                  <div>
                    <h4 className="font-medium mb-3">Static File Hosting</h4>
                    <p className="text-sm text-muted-foreground mb-3">Upload the contents of <code>dist/public/</code> to your hosting provider:</p>
                    <ul className="text-sm space-y-1 text-muted-foreground">
                      <li>• AWS S3 + CloudFront</li>
                      <li>• Netlify</li>
                      <li>• Cloudflare Pages</li>
                      <li>• GitHub Pages</li>
                    </ul>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Success Message */}
      <Card className="bg-green-50 border-green-200">
        <CardContent className="pt-6">
          <div className="text-center">
            <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-2xl font-bold text-green-900 mb-2">Setup Complete!</h3>
            <p className="text-green-700 mb-4">Your BigCommerce B2B Buyer Portal is now ready for production use.</p>
            <div className="flex justify-center gap-4">
              <Button asChild>
                <a href="https://developer.bigcommerce.com/community" target="_blank" rel="noopener noreferrer">
                  Get Support
                </a>
              </Button>
              <Button variant="outline" asChild>
                <a href="https://github.com/bigcommerce/b2b-buyer-portal" target="_blank" rel="noopener noreferrer">
                  View Documentation
                </a>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
