#!/usr/bin/env node

/**
 * SentimentAsAService - Vercel Deployment Helper
 * Automated deployment script for VC demos
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 SentimentAsAService - Vercel Deployment Helper');
console.log('================================================');

// Check if we're in the right directory
if (!fs.existsSync('package.json')) {
  console.error('❌ Error: package.json not found. Please run this from the project root.');
  process.exit(1);
}

// Check if vercel.json exists
if (!fs.existsSync('vercel.json')) {
  console.error('❌ Error: vercel.json not found. Deployment configuration missing.');
  process.exit(1);
}

console.log('✅ Project structure verified');

// Check if Vercel CLI is installed
try {
  execSync('vercel --version', { stdio: 'ignore' });
  console.log('✅ Vercel CLI found');
} catch (error) {
  console.log('📦 Installing Vercel CLI...');
  try {
    execSync('npm install -g vercel', { stdio: 'inherit' });
    console.log('✅ Vercel CLI installed');
  } catch (installError) {
    console.error('❌ Failed to install Vercel CLI. Please install manually:');
    console.error('   npm install -g vercel');
    process.exit(1);
  }
}

// Check if user is logged in to Vercel
try {
  execSync('vercel whoami', { stdio: 'ignore' });
  console.log('✅ Vercel authentication verified');
} catch (error) {
  console.log('🔐 Please login to Vercel...');
  try {
    execSync('vercel login', { stdio: 'inherit' });
    console.log('✅ Vercel login successful');
  } catch (loginError) {
    console.error('❌ Vercel login failed. Please try manually:');
    console.error('   vercel login');
    process.exit(1);
  }
}

// Deploy to Vercel
console.log('🚀 Deploying to Vercel...');
console.log('');

try {
  // Deploy to production
  const output = execSync('vercel --prod --yes', { 
    encoding: 'utf8',
    stdio: 'inherit'
  });
  
  console.log('');
  console.log('🎉 Deployment successful!');
  console.log('');
  console.log('📊 Your SentimentAsAService demo is now live!');
  console.log('');
  console.log('🔗 Share these URLs with VCs:');
  console.log('   • Main Dashboard: [Your Vercel URL]');
  console.log('   • API Explorer: [Your Vercel URL]/api-explorer');
  console.log('   • Health Check: [Your Vercel URL]/health');
  console.log('');
  console.log('💡 Key Demo Features:');
  console.log('   ✅ Enterprise Dashboard with Live Analytics');
  console.log('   ✅ Interactive Claude AI Sentiment Analysis');
  console.log('   ✅ Military-Grade Security Showcase');
  console.log('   ✅ Complete API Documentation');
  console.log('   ✅ Healthcare Intelligence Platform');
  console.log('   ✅ Cross-App Correlation Analytics');
  console.log('');
  console.log('💰 Business Value Highlights:');
  console.log('   • $2,990-$24,990/month Enterprise Pricing');
  console.log('   • Pharmaceutical Research Licensing');
  console.log('   • HIPAA Compliant Healthcare Data');
  console.log('   • Unique Cross-App Correlation Insights');
  console.log('');
  console.log('🎯 Perfect for VC presentations!');
  
} catch (error) {
  console.error('❌ Deployment failed. Error details:');
  console.error(error.message);
  console.log('');
  console.log('🔧 Troubleshooting:');
  console.log('   1. Ensure you have a Vercel account');
  console.log('   2. Check your internet connection');
  console.log('   3. Verify project files are committed to Git');
  console.log('   4. Try manual deployment: vercel --prod');
  process.exit(1);
}
