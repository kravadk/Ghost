# Design Document: RPC Endpoint Resilience

## Overview

This design implements a robust RPC endpoint management system for the Aleo Private Messenger application. The system will handle endpoint failures gracefully through automatic failover, intelligent retry logic, endpoint health tracking, and comprehensive error handling. The design focuses on maintaining reliable blockchain connectivity while providing visibility into connection status and performance.

## Architecture

The solution follows a layered architecture:

1. **RPC Manager Layer**: Central coordinator for all RPC operations
   - Endpoint selection and rotation
   - Health tracking and prioritization
   - Request routing and failover orchestration

2. **Retry Handler Layer**: Manages retry logic with exponential backoff
   - Configurable retry attempts
   - Progressive delay calculation
   - Failure classification (retryable vs non-retryable)

3. **Health Monitor Layer**: Tracks endpoint performance and availability
   - Success/failure recording
   - Response time tracking
   - Circuit breaker implementation
   - Persistence to localStorage

4. **UI Integration Layer**: Provides user-facing status and controls
   - Real-time status indicators
   - Manual health check triggers
   - Error message display

## Components and Interfaces

### 1. RPC Manager (`rpcManager.ts`)

**Purpose**: Central service for managing all RPC endpoint operations

**Interface**:
```typescript
interface RPCEndpoint {
  url: string;
  priority: number;
  lastSuccess: number | null;
  lastFailure: number | null;
  consecutiveFailures: number;
  averageResponseTime: number;
  isHealthy: boolean;
}

interface RPCManagerConfig {
  endpoints: string[];
  maxRetries: number;
  baseRetryDelay: number;
  requestTimeout: number;
  circuitBreakerThreshold: number;
  circuitBreakerResetTime: number;
}

class RPCManager {
  constructor(config: RPCManagerConfig);
  
  // Execute RPC call with automatic failover
  async call<T>(method: string, params?: unknown[]): Promise<T>;
  
  // Get current best endpoint
  getBestEndpoint(): RPCEndpoint | null;
  
  // Get all endpoints with health status
  getAllEndpoints(): RPCEndpoint[];
  
  // Manually test all endpoints
  async testAllEndpoints(): Promise<Map<string, EndpointTestResult>>;
  
  // Reset health data for an endpoint
  resetEndpoint(url: string): void;
}
```

**Key Responsibilities**:
- Maintain ordered list of endpoints with health metadata
- Select best available endpoint for each request
- Coordinate failover when endpoints fail
- Persist and restore endpoint health data

### 2. Retry Handler (`retryHandler.ts`)

**Purpose**: Implement retry logic with exponential backoff

**Interface**:
```typescript
interface RetryConfig {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
}

interface RetryResult<T> {
  success: boolean;
  data?: T;
  error?: Error;
  attempts: number;
}

class RetryHandler {
  constructor(config: RetryConfig);
  
  // Execute function with retry logic
  async executeWithRetry<T>(
    fn: () => Promise<T>,
    isRetryable: (error: Error) => boolean
  ): Promise<RetryResult<T>>;
  
  // Calculate delay for next retry
  calculateDelay(attemptNumber: number): number;
}
```

**Key Responsibilities**:
- Execute operations with configurable retry attempts
- Calculate exponential backoff delays
- Determine if errors are retryable
- Track attempt counts and timing

### 3. Health Monitor (`healthMonitor.ts`)

**Purpose**: Track and persist endpoint health metrics

**Interface**:
```typescript
interface HealthMetrics {
  successCount: number;
  failureCount: number;
  totalResponseTime: number;
  lastChecked: number;
}

interface CircuitBreakerState {
  isOpen: boolean;
  openedAt: number | null;
  failureCount: number;
}

class HealthMonitor {
  // Record successful request
  recordSuccess(url: string, responseTime: number): void;
  
  // Record failed request
  recordFailure(url: string, error: Error): void;
  
  // Check if endpoint is healthy
  isHealthy(url: string): boolean;
  
  // Get circuit breaker state
  getCircuitState(url: string): CircuitBreakerState;
  
  // Get health metrics
  getMetrics(url: string): HealthMetrics;
  
  // Persist health data
  save(): void;
  
  // Load health data
  load(): void;
}
```

**Key Responsibilities**:
- Track success/failure counts per endpoint
- Calculate average response times
- Implement circuit breaker pattern
- Persist health data to localStorage
- Provide health status queries

### 4. RPC Client Wrapper (`rpcClient.ts`)

**Purpose**: Low-level HTTP client for RPC calls

**Interface**:
```typescript
interface RPCRequest {
  jsonrpc: string;
  id: number;
  method: string;
  params: unknown[] | Record<string, unknown>;
}

interface RPCResponse<T> {
  jsonrpc: string;
  id: number;
  result?: T;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

class RPCClient {
  // Execute single RPC request
  async request<T>(
    url: string,
    method: string,
    params?: unknown[],
    timeout?: number
  ): Promise<T>;
  
  // Validate endpoint URL
  static validateEndpointUrl(url: string): boolean;
  
  // Map method names to RPC methods
  static mapMethodName(method: string, params?: unknown[]): {
    rpcMethod: string;
    rpcParams: unknown[] | Record<string, unknown>;
  };
}
```

**Key Responsibilities**:
- Execute HTTP POST requests to RPC endpoints
- Handle request/response serialization
- Implement request timeouts
- Validate endpoint URLs
- Map internal method names to RPC methods

### 5. UI Status Component (`RPCStatusIndicator.tsx`)

**Purpose**: Display RPC connection status to users

**Interface**:
```typescript
interface RPCStatusProps {
  manager: RPCManager;
  onTestConnection?: () => void;
}

const RPCStatusIndicator: React.FC<RPCStatusProps> = ({ manager, onTestConnection }) => {
  // Component implementation
};
```

**Key Responsibilities**:
- Display current endpoint and health status
- Show visual indicators (green/yellow/red)
- Provide manual test connection button
- Display error messages and troubleshooting tips

## Data Models

### Endpoint Health Data Structure
```typescript
interface EndpointHealthData {
  endpoints: {
    [url: string]: {
      priority: number;
      lastSuccess: number | null;
      lastFailure: number | null;
      consecutiveFailures: number;
      totalRequests: number;
      successfulRequests: number;
      totalResponseTime: number;
      circuitBreakerOpenedAt: number | null;
    };
  };
  lastUpdated: number;
}
```

### Request Context
```typescript
interface RequestContext {
  requestId: string;
  method: string;
  params: unknown[];
  startTime: number;
  attemptNumber: number;
  endpointUrl: string;
}
```

### Error Classification
```typescript
enum ErrorType {
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT = 'TIMEOUT',
  HTTP_ERROR = 'HTTP_ERROR',
  RPC_ERROR = 'RPC_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR'
}

interface ClassifiedError {
  type: ErrorType;
  isRetryable: boolean;
  originalError: Error;
  statusCode?: number;
  message: string;
}
```


## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Endpoint failover on 404 errors
*For any* RPC request that receives a 404 error from an endpoint, the system should attempt the next available endpoint in the configured list
**Validates: Requirements 1.1**

### Property 2: Request context preservation during failover
*For any* RPC request with specific method and parameters, switching to a different endpoint should preserve the exact method name and parameter values
**Validates: Requirements 1.5**

### Property 3: Endpoint selection prefers healthy endpoints
*For any* new RPC request when multiple endpoints are available, the system should select an endpoint with recent successful responses over endpoints with recent failures
**Validates: Requirements 4.2**

### Property 4: URL validation excludes malformed endpoints
*For any* endpoint URL that lacks HTTPS protocol or has invalid domain structure, the validation function should return false and exclude it from the rotation
**Validates: Requirements 2.2, 2.4**

### Property 5: All endpoint URLs validated at initialization
*For any* list of configured endpoint URLs, the initialization process should validate each URL and only include properly formatted URLs in the active rotation
**Validates: Requirements 2.1**

### Property 6: Network errors trigger retry attempts
*For any* RPC request that fails with a network error, the system should retry the request up to 3 times before moving to the next endpoint
**Validates: Requirements 3.1**

### Property 7: Exponential backoff delay calculation
*For any* retry attempt sequence, the delay before each retry should follow exponential backoff where delay(n) = baseDelay * (2 ^ (n-1))
**Validates: Requirements 3.2**

### Property 8: Exhausted retries trigger failover
*For any* RPC request that exhausts all retry attempts on one endpoint, the system should proceed to attempt the next endpoint in the failover list
**Validates: Requirements 3.6**

### Property 9: Success updates health metrics
*For any* successful RPC response, the system should record the success timestamp and response time in the endpoint's health metrics
**Validates: Requirements 4.1**

### Property 10: Circuit breaker deprioritizes failing endpoints
*For any* endpoint that accumulates consecutive failures exceeding the threshold, the system should mark it as deprioritized and avoid using it for the configured time period
**Validates: Requirements 4.3**

### Property 11: Circuit breaker reset after timeout
*For any* deprioritized endpoint where the deprioritization period has expired, the system should restore the endpoint to normal priority
**Validates: Requirements 4.4**

### Property 12: Health data persistence round-trip
*For any* endpoint health data state, saving to localStorage and then loading should produce equivalent health metrics
**Validates: Requirements 4.5**

### Property 13: Request initiation logging
*For any* RPC request that is initiated, the system should create a log entry containing the endpoint URL and request method
**Validates: Requirements 5.1**

### Property 14: Failure logging includes error details
*For any* RPC request that fails, the system should create a log entry containing the error type, status code (if applicable), and response body
**Validates: Requirements 5.2**

### Property 15: Success logging includes performance metrics
*For any* RPC request that succeeds, the system should create a log entry containing the response time and endpoint URL used
**Validates: Requirements 5.3**

### Property 16: Failover logging includes transition details
*For any* endpoint failover event, the system should create a log entry containing the reason for switching and the new endpoint URL
**Validates: Requirements 5.4**

### Property 17: Log entries include correlation data
*For any* log entry created by the RPC system, it should include a timestamp and request identifier for correlation
**Validates: Requirements 5.5**

### Property 18: UI reflects healthy endpoint status
*For any* endpoint state where isHealthy is true, the UI component should render a green status indicator
**Validates: Requirements 6.3**

### Property 19: UI reflects degraded endpoint status
*For any* endpoint state where failures are occurring but not all endpoints are down, the UI component should render a yellow warning indicator
**Validates: Requirements 6.4**

### Property 20: Cached height fallback on method failure
*For any* getblockheight request that fails when a cached height value exists, the system should return the cached value instead of throwing an error
**Validates: Requirements 7.1**

### Property 21: Partial block range failure continues processing
*For any* block range request that fails, the system should continue processing subsequent block ranges rather than aborting the entire sync
**Validates: Requirements 7.2**

### Property 22: Partial data processing marks sync incomplete
*For any* sync operation that retrieves only partial block data due to errors, the system should process available blocks and set a flag indicating incomplete sync
**Validates: Requirements 7.3**

### Property 23: Error sync displays success count
*For any* sync operation that completes with errors, the system should display both the number of successfully processed blocks and the error details
**Validates: Requirements 7.4**

### Property 24: Cached data usage shows indicator
*For any* operation that uses cached data instead of fresh data, the system should display an indicator to the user that the data may be incomplete
**Validates: Requirements 7.5**

### Property 25: Endpoint test displays real-time results
*For any* endpoint health test in progress, the UI should display results as each endpoint test completes
**Validates: Requirements 8.2**

### Property 26: Test completion shows response times
*For any* completed endpoint test where endpoints succeeded, the results should include the response time for each successful endpoint
**Validates: Requirements 8.3**

### Property 27: Test failure shows error messages
*For any* completed endpoint test where endpoints failed, the results should include the specific error message for each failed endpoint
**Validates: Requirements 8.4**

### Property 28: Test results recommend best endpoint
*For any* completed endpoint test with multiple successful endpoints, the system should identify and recommend the endpoint with the best combination of response time and reliability
**Validates: Requirements 8.5**

## Error Handling

### Error Classification

The system classifies errors into the following categories:

1. **Network Errors** (Retryable)
   - Connection refused
   - DNS resolution failure
   - Network timeout
   - Action: Retry with exponential backoff, then failover

2. **HTTP Errors** (Conditionally Retryable)
   - 404 Not Found: Failover immediately (endpoint doesn't exist)
   - 429 Too Many Requests: Retry with longer backoff
   - 500-503 Server Errors: Retry then failover
   - 400-499 Client Errors (except 404, 429): Do not retry, return error

3. **RPC Errors** (Non-Retryable)
   - Invalid method
   - Invalid parameters
   - Action: Return error to caller immediately

4. **Timeout Errors** (Retryable)
   - Request exceeds timeout threshold
   - Action: Retry with same or increased timeout, then failover

5. **Validation Errors** (Non-Retryable)
   - Malformed endpoint URL
   - Invalid configuration
   - Action: Log error, exclude endpoint, continue with valid endpoints

### Error Recovery Strategies

1. **Immediate Failover**
   - Triggered by: 404 errors, endpoint validation failures
   - Action: Skip to next endpoint without retry

2. **Retry with Backoff**
   - Triggered by: Network errors, timeouts, 5xx errors
   - Action: Retry up to 3 times with exponential backoff (1s, 2s, 4s)

3. **Circuit Breaker**
   - Triggered by: 5 consecutive failures on an endpoint
   - Action: Mark endpoint as unhealthy, deprioritize for 5 minutes

4. **Graceful Degradation**
   - Triggered by: All endpoints failing
   - Action: Use cached data if available, display clear error message

5. **Partial Success Handling**
   - Triggered by: Some block ranges fail during sync
   - Action: Process successful ranges, mark sync as incomplete

### User-Facing Error Messages

The system provides clear, actionable error messages:

1. **All Endpoints Failed**
   ```
   Unable to connect to Aleo network. All RPC endpoints are unavailable.
   
   Troubleshooting:
   - Check your internet connection
   - Try again in a few minutes
   - Visit status.aleo.org for network status
   ```

2. **Partial Sync Failure**
   ```
   Inbox sync completed with errors.
   Successfully processed: 350/500 blocks
   
   Some messages may be missing. Try syncing again later.
   ```

3. **Configuration Error**
   ```
   RPC configuration error: No valid endpoints configured.
   
   Please check your endpoint settings and ensure at least one valid HTTPS URL is provided.
   ```

4. **Cached Data Warning**
   ```
   ⚠️ Using cached blockchain height (may be outdated)
   Last successful sync: 5 minutes ago
   ```

## Testing Strategy

### Unit Testing

Unit tests will verify individual components in isolation:

1. **RPCClient Tests**
   - URL validation logic
   - Method name mapping
   - Request/response serialization
   - Timeout handling

2. **RetryHandler Tests**
   - Exponential backoff calculation
   - Retry attempt counting
   - Error classification (retryable vs non-retryable)

3. **HealthMonitor Tests**
   - Success/failure recording
   - Circuit breaker state transitions
   - localStorage persistence and loading
   - Metrics calculation

4. **RPCManager Tests**
   - Endpoint selection algorithm
   - Failover orchestration
   - Integration with retry handler
   - Health data updates

### Property-Based Testing

Property-based tests will verify universal properties across many randomly generated inputs using the **fast-check** library for TypeScript. Each property test will run a minimum of 100 iterations.

**Configuration**:
```typescript
import * as fc from 'fast-check';

// Configure all property tests to run 100+ iterations
const propertyTestConfig = { numRuns: 100 };
```

**Test Tagging**:
Each property-based test must include a comment tag in this exact format:
```typescript
// **Feature: rpc-endpoint-resilience, Property {number}: {property_text}**
```

**Property Test Coverage**:

1. **Endpoint Failover Properties**
   - Property 1: Failover on 404 errors
   - Property 2: Request context preservation
   - Property 3: Healthy endpoint preference

2. **Validation Properties**
   - Property 4: Malformed URL exclusion
   - Property 5: Initialization validation

3. **Retry Logic Properties**
   - Property 6: Network error retries
   - Property 7: Exponential backoff calculation
   - Property 8: Retry exhaustion failover

4. **Health Tracking Properties**
   - Property 9: Success metric updates
   - Property 10: Circuit breaker deprioritization
   - Property 11: Circuit breaker reset
   - Property 12: Health data persistence round-trip

5. **Logging Properties**
   - Property 13: Request initiation logging
   - Property 14: Failure logging
   - Property 15: Success logging
   - Property 16: Failover logging
   - Property 17: Log correlation data

6. **UI Properties**
   - Property 18: Healthy status indicator
   - Property 19: Degraded status indicator

7. **Graceful Degradation Properties**
   - Property 20: Cached height fallback
   - Property 21: Partial range processing
   - Property 22: Incomplete sync marking
   - Property 23: Error count display
   - Property 24: Cached data indicator

8. **Testing Feature Properties**
   - Property 25: Real-time test results
   - Property 26: Response time display
   - Property 27: Error message display
   - Property 28: Best endpoint recommendation

### Integration Testing

Integration tests will verify the complete RPC flow:

1. **End-to-End RPC Call**
   - Test complete flow from call initiation to response
   - Verify failover works across real endpoint failures
   - Test with actual network conditions (mocked endpoints)

2. **Health Monitoring Integration**
   - Verify health data updates during real RPC calls
   - Test circuit breaker triggers during failure sequences
   - Verify localStorage persistence across sessions

3. **UI Integration**
   - Test status indicator updates during RPC operations
   - Verify manual health check triggers correct backend calls
   - Test error message display for various failure scenarios

### Test Data Generators

For property-based testing, we'll create generators for:

1. **Endpoint URLs**
   ```typescript
   const validEndpointGen = fc.webUrl({ validSchemes: ['https'] });
   const invalidEndpointGen = fc.oneof(
     fc.webUrl({ validSchemes: ['http'] }), // Wrong protocol
     fc.string(), // Not a URL
     fc.constant('') // Empty string
   );
   ```

2. **RPC Requests**
   ```typescript
   const rpcMethodGen = fc.constantFrom('getHeight', 'getBlocks', 'getBlock');
   const rpcParamsGen = fc.array(fc.anything());
   ```

3. **Health Metrics**
   ```typescript
   const healthMetricsGen = fc.record({
     successCount: fc.nat(),
     failureCount: fc.nat(),
     totalResponseTime: fc.nat(),
     lastChecked: fc.date().map(d => d.getTime())
   });
   ```

4. **Error Responses**
   ```typescript
   const httpErrorGen = fc.integer({ min: 400, max: 599 });
   const networkErrorGen = fc.constantFrom(
     'ECONNREFUSED',
     'ETIMEDOUT',
     'ENOTFOUND'
   );
   ```

## Performance Considerations

1. **Request Timeout**: Default 10 seconds per endpoint, configurable
2. **Total Operation Timeout**: Maximum 30 seconds for all failover attempts
3. **Health Data Size**: Limit to 50 endpoints max to prevent localStorage bloat
4. **Logging**: Use console.debug for verbose logs, console.warn/error for important events
5. **UI Updates**: Debounce status updates to prevent excessive re-renders

## Security Considerations

1. **HTTPS Only**: Reject any non-HTTPS endpoints to prevent MITM attacks
2. **URL Validation**: Sanitize and validate all endpoint URLs before use
3. **No Sensitive Data in Logs**: Never log private keys, passwords, or sensitive user data
4. **localStorage Security**: Health data is non-sensitive, but implement size limits
5. **CORS**: Ensure endpoints support CORS for browser-based requests

## Deployment and Configuration

### Default Configuration

```typescript
const DEFAULT_CONFIG: RPCManagerConfig = {
  endpoints: [
    'https://api.explorer.aleo.org/v1',
    'https://testnetbeta.aleorpc.com',
    'https://api.explorer.provable.com/v1'
  ],
  maxRetries: 3,
  baseRetryDelay: 1000, // 1 second
  requestTimeout: 10000, // 10 seconds
  circuitBreakerThreshold: 5,
  circuitBreakerResetTime: 300000 // 5 minutes
};
```

### Environment-Specific Configuration

The system will support environment-specific endpoint lists:

- **Testnet**: Use testnet-specific endpoints
- **Mainnet**: Use mainnet-specific endpoints
- **Development**: Allow custom endpoint configuration for local testing

### Configuration Override

Users can override default configuration through:
1. Environment variables (for deployment)
2. Configuration file (for advanced users)
3. UI settings panel (future enhancement)
