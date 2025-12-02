# KRides Testing Setup Script
# This script installs all necessary testing dependencies

Write-Host "🚀 Setting up testing environment for KRides..." -ForegroundColor Cyan
Write-Host ""

# Check if npm is available
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    Write-Host "❌ npm is not installed. Please install Node.js first." -ForegroundColor Red
    exit 1
}

Write-Host "📦 Installing testing dependencies..." -ForegroundColor Yellow
Write-Host ""

# Core testing packages
$packages = @(
    "jest",
    "@testing-library/react-native",
    "@testing-library/jest-native",
    "@testing-library/react-hooks",
    "react-test-renderer",
    "jest-expo",
    "@react-native-async-storage/async-storage"
)

Write-Host "Installing: $($packages -join ', ')" -ForegroundColor Gray
npm install --save-dev $packages

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to install testing packages" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "✅ Testing packages installed successfully!" -ForegroundColor Green
Write-Host ""

# Verify installation
Write-Host "🔍 Verifying installation..." -ForegroundColor Yellow

$requiredFiles = @(
    "jest.config.js",
    "jest.setup.js",
    "scripts\validate-env.js",
    "helpers\__tests__\rideCalculations.test.js"
)

$allFilesExist = $true
foreach ($file in $requiredFiles) {
    if (Test-Path $file) {
        Write-Host "✅ Found: $file" -ForegroundColor Green
    } else {
        Write-Host "❌ Missing: $file" -ForegroundColor Red
        $allFilesExist = $false
    }
}

Write-Host ""

if ($allFilesExist) {
    Write-Host "✅ All configuration files are in place!" -ForegroundColor Green
} else {
    Write-Host "⚠️  Some configuration files are missing. Please check the setup." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "📋 Next Steps:" -ForegroundColor Cyan
Write-Host "  1. Run 'npm test' to execute tests" -ForegroundColor White
Write-Host "  2. Run 'npm run test:coverage' to see test coverage" -ForegroundColor White
Write-Host "  3. Run 'npm run validate-env' to check environment variables" -ForegroundColor White
Write-Host "  4. Check the testing_guide.md for detailed instructions" -ForegroundColor White
Write-Host ""
Write-Host "🎉 Testing setup complete!" -ForegroundColor Green
