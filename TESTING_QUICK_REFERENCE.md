# Quick Testing Reference Guide

## 🚀 Quick Start

### 1. Install Testing Dependencies
```bash
# Run the automated setup script
.\scripts\setup-testing.ps1

# OR install manually
npm install --save-dev jest @testing-library/react-native @testing-library/jest-native @testing-library/react-hooks react-test-renderer jest-expo
```

### 2. Run Tests
```bash
# Run all tests
npm test

# Run tests in watch mode (auto-rerun on changes)
npm run test:watch

# Run tests with coverage report
npm run test:coverage

# Run only integration tests
npm run test:integration
```

### 3. Validate Environment
```bash
npm run validate-env
```

---

## 📁 Project Structure

```
KRides/
├── helpers/
│   ├── __tests__/
│   │   └── rideCalculations.test.js    ✅ Example test
│   ├── rideCalculations.js
│   ├── firebaseRides.js
│   └── ...
├── hooks/
│   ├── __tests__/
│   │   └── useGoogleAuth.test.js       ✅ Example test
│   ├── useGoogleAuth.js
│   └── ...
├── components/
│   ├── __tests__/                      📝 Add your tests here
│   └── ...
├── screens/
│   ├── __tests__/                      📝 Add your tests here
│   └── ...
├── scripts/
│   ├── setup-testing.ps1               🔧 Setup script
│   └── validate-env.js                 🔍 Environment validator
├── jest.config.js                      ⚙️ Jest configuration
├── jest.setup.js                       ⚙️ Test setup & mocks
├── PRE_DEPLOYMENT_CHECKLIST.md         ✅ Deployment checklist
└── package.json                        📦 Updated with test scripts
```

---

## 📝 Writing Tests

### Helper Function Test Template
```javascript
import { yourFunction } from '../yourHelper';

describe('YourHelper', () => {
  it('should do something', () => {
    const result = yourFunction(input);
    expect(result).toBe(expectedOutput);
  });
});
```

### Hook Test Template
```javascript
import { renderHook, act } from '@testing-library/react-hooks';
import { useYourHook } from '../useYourHook';

describe('useYourHook', () => {
  it('should initialize correctly', () => {
    const { result } = renderHook(() => useYourHook());
    expect(result.current.value).toBe(initialValue);
  });
});
```

### Component Test Template
```javascript
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import YourComponent from '../YourComponent';

describe('YourComponent', () => {
  it('should render correctly', () => {
    const { getByText } = render(<YourComponent />);
    expect(getByText('Expected Text')).toBeTruthy();
  });
});
```

---

## 🎯 Common Testing Patterns

### Testing Async Functions
```javascript
it('should fetch data', async () => {
  const data = await fetchData();
  expect(data).toBeDefined();
});
```

### Testing Hooks with State Changes
```javascript
it('should update state', async () => {
  const { result } = renderHook(() => useYourHook());
  
  await act(async () => {
    await result.current.updateValue('new value');
  });
  
  expect(result.current.value).toBe('new value');
});
```

### Testing Button Presses
```javascript
it('should call function on press', () => {
  const onPressMock = jest.fn();
  const { getByTestId } = render(<Button onPress={onPressMock} />);
  
  fireEvent.press(getByTestId('button'));
  
  expect(onPressMock).toHaveBeenCalled();
});
```

### Testing Firebase Operations
```javascript
it('should create document', async () => {
  const docId = await createDocument(data);
  expect(docId).toBeTruthy();
  expect(typeof docId).toBe('string');
});
```

---

## 🔍 Debugging Tests

### Run Single Test File
```bash
npm test -- helpers/__tests__/rideCalculations.test.js
```

### Run Tests Matching Pattern
```bash
npm test -- --testNamePattern="should calculate"
```

### Verbose Output
```bash
npm test -- --verbose
```

### Update Snapshots
```bash
npm test -- -u
```

---

## 📊 Coverage Reports

After running `npm run test:coverage`, check:
- `coverage/lcov-report/index.html` - Visual coverage report
- Console output for coverage summary

**Target Coverage:**
- Statements: 60%+
- Branches: 50%+
- Functions: 60%+
- Lines: 60%+

---

## 🚨 Common Issues & Solutions

### Issue: "Cannot find module"
**Solution:** Check import paths and ensure file exists

### Issue: "Timeout" errors
**Solution:** Increase timeout for async tests
```javascript
it('should complete', async () => {
  // test code
}, 10000); // 10 second timeout
```

### Issue: "ReferenceError: React is not defined"
**Solution:** Add `import React from 'react';` at top of test file

### Issue: Mock not working
**Solution:** Ensure mock is defined before import
```javascript
jest.mock('../module');
import { function } from '../module';
```

---

## ✅ Pre-Deployment Checklist

Before deploying, ensure:
1. ✅ All tests pass (`npm test`)
2. ✅ Coverage meets threshold (`npm run test:coverage`)
3. ✅ Environment validated (`npm run validate-env`)
4. ✅ Manual testing completed (see `PRE_DEPLOYMENT_CHECKLIST.md`)
5. ✅ Build successful (`eas build --platform android --profile preview`)

---

## 📚 Resources

- **Jest Docs:** https://jestjs.io/
- **React Native Testing Library:** https://callstack.github.io/react-native-testing-library/
- **Testing Guide:** See `testing_guide.md` for comprehensive guide
- **Deployment Checklist:** See `PRE_DEPLOYMENT_CHECKLIST.md`

---

## 🎯 Priority Testing Areas

Focus your testing efforts on:

1. **Payment Flow** (Critical)
   - Ride booking with payment
   - Refund processing
   - Commission calculation

2. **Authentication** (Critical)
   - Email/password login
   - Google Sign-In
   - Session management

3. **Ride Management** (High)
   - Creating rides
   - Accepting rides
   - Completing rides
   - Cancelling rides

4. **Location Services** (High)
   - Getting current location
   - Calculating distances
   - Route display

5. **Real-time Updates** (Medium)
   - Driver location tracking
   - Ride status updates
   - Notifications

---

## 💡 Tips

- **Start Small:** Begin with helper functions, then hooks, then components
- **Test Behavior:** Test what the code does, not how it does it
- **Mock External Services:** Always mock Firebase, APIs, and third-party services
- **Keep Tests Simple:** One test should verify one thing
- **Use Descriptive Names:** Test names should explain what they verify
- **Run Tests Often:** Use watch mode during development

---

**Need Help?** Check the full `testing_guide.md` for detailed examples and explanations.
