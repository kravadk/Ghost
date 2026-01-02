# Implementation Plan

- [ ] 1. Set up project structure and core types
  - Create `frontend/src/services/rpc/` directory for RPC management code
  - Define TypeScript interfaces and types in `types.ts`
  - Set up error classification enums and types
  - Install fast-check library for property-based testing: `npm install --save-dev fast-check @types/fast-check`
  - _Requirements: 2.1, 5.1_

- [ ] 2. Implement RPC Client wrapper
  - [ ] 2.1 Create `rpcClient.ts` with basic HTTP request functionality
    - Implement `request()` method with fetch API
    - Add request timeout handling using AbortController
    - Implement JSON-RPC request/response serialization
    - _Requirements: 1.1, 1.4_

  - [ ] 2.2 Implement URL validation
    - Create `validateEndpointUrl()` static method
    - Check for HTTPS protocol requirement
    - Validate domain structure
    - _Requirements: 2.1, 2.2, 2.4_

  - [ ] 2.3 Write property test for URL validation
    - **Property 4: Malformed URL exclusion**
    - **Validates: Requirements 2.2, 2.4**

  - [ ] 2.4 Implement method name mapping
    - Create `mapMethodName()` to convert internal methods to RPC methods
    - Handle special cases (getblockheight -> getHeight, getblock -> getBlocks)
    - Map parameters correctly for each method type
    - _Requirements: 1.5_

  - [ ] 2.5 Write property test for request context preservation
    - **Property 2: Request context preservation during failover**
    - **Validates: Requirements 1.5**

  - [ ] 2.6 Write unit tests for RPC Client
    - Test timeout handling
    - Test request/response serialization
    - Test error response handling
    - _Requirements: 1.1, 1.5_

- [ ] 3. Implement Retry Handler
  - [ ] 3.1 Create `retryHandler.ts` with retry logic
    - Implement `executeWithRetry()` method
    - Add configurable retry attempts (default 3)
    - Implement error classification (retryable vs non-retryable)
    - _Requirements: 3.1, 3.6_

  - [ ] 3.2 Write property test for network error retries
    - **Property 6: Network errors trigger retry attempts**
    - **Validates: Requirements 3.1**

  - [ ] 3.3 Implement exponential backoff calculation
    - Create `calculateDelay()` method
    - Use formula: delay(n) = baseDelay * (2 ^ (n-1))
    - Add maximum delay cap
    - _Requirements: 3.2, 3.3, 3.4, 3.5_

  - [ ] 3.4 Write property test for exponential backoff
    - **Property 7: Exponential backoff delay calculation**
    - **Validates: Requirements 3.2**

  - [ ] 3.5 Write unit tests for specific retry delays
    - Test first retry waits 1 second
    - Test second retry waits 2 seconds
    - Test third retry waits 4 seconds
    - _Requirements: 3.3, 3.4, 3.5_

  - [ ] 3.6 Write property test for retry exhaustion
    - **Property 8: Exhausted retries trigger failover**
    - **Validates: Requirements 3.6**

- [ ] 4. Implement Health Monitor
  - [ ] 4.1 Create `healthMonitor.ts` with health tracking
    - Implement `recordSuccess()` method
    - Implement `recordFailure()` method
    - Track success/failure counts per endpoint
    - Calculate average response times
    - _Requirements: 4.1_

  - [ ] 4.2 Write property test for success metric updates
    - **Property 9: Success updates health metrics**
    - **Validates: Requirements 4.1**

  - [ ] 4.3 Implement circuit breaker logic
    - Add `getCircuitState()` method
    - Track consecutive failures per endpoint
    - Open circuit after threshold (default 5 failures)
    - Implement time-based circuit reset (default 5 minutes)
    - _Requirements: 4.3, 4.4_

  - [ ] 4.4 Write property test for circuit breaker deprioritization
    - **Property 10: Circuit breaker deprioritizes failing endpoints**
    - **Validates: Requirements 4.3**

  - [ ] 4.5 Write property test for circuit breaker reset
    - **Property 11: Circuit breaker reset after timeout**
    - **Validates: Requirements 4.4**

  - [ ] 4.6 Implement localStorage persistence
    - Create `save()` method to persist health data
    - Create `load()` method to restore health data
    - Handle localStorage quota errors gracefully
    - _Requirements: 4.5_

  - [ ] 4.7 Write property test for health data persistence
    - **Property 12: Health data persistence round-trip**
    - **Validates: Requirements 4.5**

  - [ ] 4.8 Write unit tests for health monitor
    - Test metrics calculation
    - Test circuit breaker state transitions
    - Test localStorage edge cases
    - _Requirements: 4.1, 4.3, 4.4, 4.5_

- [ ] 5. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 6. Implement RPC Manager
  - [ ] 6.1 Create `rpcManager.ts` with endpoint management
    - Initialize with endpoint list and configuration
    - Integrate RetryHandler and HealthMonitor
    - Implement endpoint validation on initialization
    - _Requirements: 2.1, 2.2_

  - [ ] 6.2 Write property test for initialization validation
    - **Property 5: All endpoint URLs validated at initialization**
    - **Validates: Requirements 2.1**

  - [ ] 6.3 Implement endpoint selection algorithm
    - Create `getBestEndpoint()` method
    - Prefer endpoints with recent successful responses
    - Exclude endpoints with open circuit breakers
    - Sort by priority and health metrics
    - _Requirements: 1.3, 4.2_

  - [ ] 6.4 Write property test for endpoint selection
    - **Property 3: Endpoint selection prefers healthy endpoints**
    - **Validates: Requirements 4.2**

  - [ ] 6.5 Implement main RPC call method with failover
    - Create `call()` method as main entry point
    - Attempt request on best endpoint
    - Handle 404 errors with immediate failover
    - Integrate retry logic for retryable errors
    - Move to next endpoint after retry exhaustion
    - _Requirements: 1.1, 1.2, 3.6_

  - [ ] 6.6 Write property test for 404 failover
    - **Property 1: Endpoint failover on 404 errors**
    - **Validates: Requirements 1.1**

  - [ ] 6.7 Implement endpoint testing functionality
    - Create `testAllEndpoints()` method
    - Test each endpoint with a simple request
    - Collect response times and errors
    - Return comprehensive test results
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

  - [ ] 6.8 Write property test for test result display
    - **Property 26: Test completion shows response times**
    - **Validates: Requirements 8.3**

  - [ ] 6.9 Write property test for error message display
    - **Property 27: Test failure shows error messages**
    - **Validates: Requirements 8.4**

  - [ ] 6.10 Write property test for endpoint recommendation
    - **Property 28: Test results recommend best endpoint**
    - **Validates: Requirements 8.5**

  - [ ] 6.11 Write integration tests for RPC Manager
    - Test complete RPC call flow with mocked endpoints
    - Test failover sequence with multiple endpoint failures
    - Test health data updates during operations
    - _Requirements: 1.1, 1.2, 1.3, 4.1_

- [ ] 7. Implement logging infrastructure
  - [ ] 7.1 Create `logger.ts` with structured logging
    - Implement log methods for different levels (debug, info, warn, error)
    - Add request ID generation for correlation
    - Include timestamps in all log entries
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

  - [ ] 7.2 Write property test for request initiation logging
    - **Property 13: Request initiation logging**
    - **Validates: Requirements 5.1**

  - [ ] 7.3 Write property test for failure logging
    - **Property 14: Failure logging includes error details**
    - **Validates: Requirements 5.2**

  - [ ] 7.4 Write property test for success logging
    - **Property 15: Success logging includes performance metrics**
    - **Validates: Requirements 5.3**

  - [ ] 7.5 Write property test for failover logging
    - **Property 16: Failover logging includes transition details**
    - **Validates: Requirements 5.4**

  - [ ] 7.6 Write property test for log correlation data
    - **Property 17: Log entries include correlation data**
    - **Validates: Requirements 5.5**

  - [ ] 7.7 Integrate logging into RPC Manager
    - Add logging calls at key points in RPC flow
    - Log request initiation with endpoint and method
    - Log failures with error details
    - Log successes with response time
    - Log failover events with reason
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

- [ ] 8. Implement graceful degradation features
  - [ ] 8.1 Add cached blockchain height fallback
    - Store last successful blockchain height in localStorage
    - Return cached value when getblockheight fails
    - Add timestamp to cached value
    - _Requirements: 7.1, 7.5_

  - [ ] 8.2 Write property test for cached height fallback
    - **Property 20: Cached height fallback on method failure**
    - **Validates: Requirements 7.1**

  - [ ] 8.3 Implement partial block range processing
    - Modify block scanning to handle individual range failures
    - Continue processing subsequent ranges after failure
    - Track which ranges succeeded and which failed
    - _Requirements: 7.2_

  - [ ] 8.4 Write property test for partial range processing
    - **Property 21: Partial block range failure continues processing**
    - **Validates: Requirements 7.2**

  - [ ] 8.5 Add incomplete sync marking
    - Add flag to sync results indicating completeness
    - Set flag when any block ranges fail
    - Include count of successful vs attempted blocks
    - _Requirements: 7.3, 7.4_

  - [ ] 8.6 Write property test for incomplete sync marking
    - **Property 22: Partial data processing marks sync incomplete**
    - **Validates: Requirements 7.3**

  - [ ] 8.7 Write property test for error count display
    - **Property 23: Error sync displays success count**
    - **Validates: Requirements 7.4**

  - [ ] 8.8 Write property test for cached data indicator
    - **Property 24: Cached data usage shows indicator**
    - **Validates: Requirements 7.5**

- [ ] 9. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 10. Create UI components
  - [ ] 10.1 Create `RPCStatusIndicator.tsx` component
    - Display current active endpoint URL
    - Show health status with color-coded indicator (green/yellow/red)
    - Add "Test Connection" button
    - Display last sync time
    - _Requirements: 6.1, 6.3, 6.4, 6.5_

  - [ ] 10.2 Write property test for healthy status indicator
    - **Property 18: UI reflects healthy endpoint status**
    - **Validates: Requirements 6.3**

  - [ ] 10.3 Write property test for degraded status indicator
    - **Property 19: UI reflects degraded endpoint status**
    - **Validates: Requirements 6.4**

  - [ ] 10.3 Implement test connection modal
    - Create modal to display endpoint test results
    - Show real-time progress as tests run
    - Display response times for successful endpoints
    - Display error messages for failed endpoints
    - Highlight recommended endpoint
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

  - [ ] 10.4 Write property test for real-time test results
    - **Property 25: Endpoint test displays real-time results**
    - **Validates: Requirements 8.2**

  - [ ] 10.5 Add error message display components
    - Create reusable error message component
    - Implement specific messages for different error scenarios
    - Add troubleshooting guidance for common issues
    - _Requirements: 1.2, 2.3, 6.5_

  - [ ] 10.6 Add cached data warning indicator
    - Display warning icon when using cached data
    - Show tooltip with last successful sync time
    - Make indicator dismissible
    - _Requirements: 7.5_

- [ ] 11. Integrate RPC Manager into existing App.tsx
  - [ ] 11.1 Replace existing callAleoRpc function
    - Import RPCManager
    - Initialize RPCManager with network-specific endpoints
    - Replace all callAleoRpc calls with manager.call()
    - _Requirements: 1.1, 1.2, 1.3_

  - [ ] 11.2 Update scanLedgerForUserRecords function
    - Integrate cached height fallback
    - Implement partial range processing
    - Add incomplete sync handling
    - Display appropriate user messages
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

  - [ ] 11.3 Add RPCStatusIndicator to UI
    - Import and render RPCStatusIndicator component
    - Position near network selector
    - Wire up test connection handler
    - _Requirements: 6.1, 6.3, 6.4, 6.5, 8.1_

  - [ ] 11.4 Update error handling throughout app
    - Replace generic error messages with specific ones
    - Use new error classification system
    - Display user-friendly messages from error handler
    - _Requirements: 1.2, 2.3_

- [ ] 12. Add configuration management
  - [ ] 12.1 Create configuration file structure
    - Define network-specific endpoint lists
    - Add configuration for retry settings
    - Add configuration for circuit breaker settings
    - Support environment variable overrides
    - _Requirements: 2.1_

  - [ ] 12.2 Implement configuration loading
    - Load default configuration
    - Override with environment-specific settings
    - Validate configuration on load
    - _Requirements: 2.1, 2.2_

  - [ ] 12.3 Write unit tests for configuration
    - Test default configuration loading
    - Test environment-specific overrides
    - Test validation of configuration values
    - _Requirements: 2.1, 2.2_

- [ ] 13. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 14. Manual testing and verification
  - [ ] 14.1 Test with real Aleo network
    - Verify connection to testnet endpoints
    - Test failover by blocking specific endpoints
    - Verify inbox sync works with new system
    - Test message sending with new RPC manager
    - _Requirements: 1.1, 1.2, 1.3_

  - [ ] 14.2 Test error scenarios
    - Disconnect network and verify error messages
    - Test with all endpoints down
    - Test with malformed endpoint configuration
    - Verify cached data fallback works
    - _Requirements: 1.2, 2.3, 7.1, 7.5_

  - [ ] 14.3 Test UI components
    - Verify status indicator updates correctly
    - Test connection test modal
    - Verify error messages display properly
    - Test cached data warning indicator
    - _Requirements: 6.1, 6.3, 6.4, 6.5, 8.1_

  - [ ] 14.4 Performance testing
    - Measure response times with different endpoints
    - Verify timeout handling works correctly
    - Test with slow network conditions
    - Verify circuit breaker prevents excessive retries
    - _Requirements: 1.4, 4.3_
